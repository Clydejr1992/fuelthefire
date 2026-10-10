-- Fuel the Fire employee-held inventory migration.
-- Review the existing schema and back up before running this in Supabase.
-- Assumes products.cases_on_hand stores whole cases and products.units_on_hand stores loose units.
begin;
create table if not exists public.employee_inventory(
 id uuid primary key default gen_random_uuid(),
 employee_id uuid not null references public.profiles(id) on delete restrict,
 product_id uuid not null references public.products(id) on delete restrict,
 location_id uuid null references public.locations(id) on delete set null,
 cases_on_hand integer not null default 0 check(cases_on_hand>=0),
 units_on_hand integer not null default 0 check(units_on_hand>=0),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create unique index if not exists employee_inventory_unique_assignment
 on public.employee_inventory(employee_id,product_id,location_id) nulls not distinct;
alter table public.employee_inventory enable row level security;
drop policy if exists employee_inventory_read on public.employee_inventory;
create policy employee_inventory_read on public.employee_inventory for select to authenticated
 using(employee_id=auth.uid() or public.is_manager_or_admin());
drop policy if exists employee_inventory_manager_write on public.employee_inventory;
create policy employee_inventory_manager_write on public.employee_inventory for all to authenticated
 using(public.is_manager_or_admin()) with check(public.is_manager_or_admin());

create or replace view public.employee_inventory_detail with(security_invoker=true) as
select ei.id,ei.employee_id,p.full_name as employee_name,p.email as employee_email,
 ei.product_id,pr.name as product_name,pr.barcode,ei.location_id,l.name as location_name,
 ei.cases_on_hand,ei.units_on_hand as loose_units,
 (ei.cases_on_hand*greatest(coalesce(pr.units_per_case,1),1)+ei.units_on_hand) as total_units,ei.updated_at
from public.employee_inventory ei join public.profiles p on p.id=ei.employee_id
join public.products pr on pr.id=ei.product_id left join public.locations l on l.id=ei.location_id;

create or replace function public.record_inventory_movement(
 p_product_id uuid,p_movement_type public.inventory_transaction_type,
 p_cases integer default 0,p_loose_units integer default 0,p_location_id uuid default null,
 p_employee_id uuid default null,p_reference text default null,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare
 v_product public.products%rowtype; v_emp public.profiles%rowtype; v_assignment public.employee_inventory%rowtype;
 v_upc integer; v_qty integer; v_current integer; v_next integer;
begin
 if auth.uid() is null or not public.is_active_user() then raise exception 'Active sign-in required'; end if;
 if coalesce(p_cases,-1)<0 or coalesce(p_loose_units,-1)<0 then raise exception 'Quantity must be zero or greater'; end if;
 select * into v_product from public.products where id=p_product_id for update;
 if not found then raise exception 'Product not found'; end if;
 v_upc:=greatest(coalesce(v_product.units_per_case,1),1);
 v_qty:=p_cases*v_upc+p_loose_units;
 if v_qty<=0 then raise exception 'Enter a quantity greater than zero'; end if;
 if p_movement_type in ('receive','adjustment','transfer','count','correction') and not public.is_manager_or_admin() then raise exception 'Manager or administrator permission required'; end if;
 if p_movement_type='transfer' then
   if p_employee_id is null then raise exception 'Choose an employee'; end if;
   select * into v_emp from public.profiles where id=p_employee_id and active=true and role<>'admin';
   if not found then raise exception 'Employee is inactive or not eligible'; end if;
 end if;
 v_current:=coalesce(v_product.cases_on_hand,0)*v_upc+coalesce(v_product.units_on_hand,0);
 if p_movement_type in ('use','waste','transfer') then
   if v_qty>v_current then raise exception 'Not enough central stock'; end if; v_next:=v_current-v_qty;
 elsif p_movement_type='receive' then v_next:=v_current+v_qty;
 elsif p_movement_type in ('adjustment','correction') then
   if upper(coalesce(p_reference,'')) like 'REMOVE:%' then
     if v_qty>v_current then raise exception 'Cannot remove more than current stock'; end if; v_next:=v_current-v_qty;
   else v_next:=v_current+v_qty; end if;
 elsif p_movement_type='count' then v_next:=v_qty;
 else raise exception 'Unsupported movement type'; end if;
 update public.products set cases_on_hand=v_next/v_upc,units_on_hand=mod(v_next,v_upc),updated_at=now() where id=p_product_id;
 insert into public.inventory_transactions(user_id,product_id,transaction_type,quantity_units,cases_delta,units_delta,reference,notes,location_id)
 values(auth.uid(),p_product_id,p_movement_type,
  case when p_movement_type='count' then v_next else v_qty end,
  case when p_movement_type='receive' then p_cases when p_movement_type in ('use','waste','transfer') then -p_cases else 0 end,
  case when p_movement_type='receive' then p_loose_units when p_movement_type in ('use','waste','transfer') then -p_loose_units else 0 end,
  p_reference,p_notes,p_location_id);
 if p_movement_type='transfer' then
   select * into v_assignment from public.employee_inventory where employee_id=p_employee_id and product_id=p_product_id and location_id is not distinct from p_location_id for update;
   if found then
     v_current:=v_assignment.cases_on_hand*v_upc+v_assignment.units_on_hand+v_qty;
     update public.employee_inventory set cases_on_hand=v_current/v_upc,units_on_hand=mod(v_current,v_upc),updated_at=now() where id=v_assignment.id;
   else
     insert into public.employee_inventory(employee_id,product_id,location_id,cases_on_hand,units_on_hand) values(p_employee_id,p_product_id,p_location_id,v_qty/v_upc,mod(v_qty,v_upc));
   end if;
 end if;
 insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'inventory_movement','product',p_product_id,jsonb_build_object('movement_type',p_movement_type,'quantity_units',v_qty,'employee_id',p_employee_id,'product_name',v_product.name,'reference',p_reference,'notes',p_notes,'location_id',p_location_id,'central_total_after',v_next));
 return jsonb_build_object('success',true,'product_id',p_product_id,'movement_type',p_movement_type,'quantity_units',v_qty,'central_total_after',v_next);
end; $$;

create or replace function public.record_employee_stock_use(
 p_employee_inventory_id uuid,p_cases integer default 0,p_loose_units integer default 0,
 p_reference text default null,p_notes text default null
) returns jsonb language plpgsql security definer set search_path=public as $$
declare v_row public.employee_inventory%rowtype; v_product public.products%rowtype; v_upc integer; v_qty integer; v_current integer; v_next integer;
begin
 if auth.uid() is null or not public.is_active_user() then raise exception 'Active sign-in required'; end if;
 select * into v_row from public.employee_inventory where id=p_employee_inventory_id for update;
 if not found then raise exception 'Assignment not found'; end if;
 if v_row.employee_id<>auth.uid() and not public.is_manager_or_admin() then raise exception 'You may only use your own assigned stock'; end if;
 select * into v_product from public.products where id=v_row.product_id for update;
 v_upc:=greatest(coalesce(v_product.units_per_case,1),1);
 if coalesce(p_cases,-1)<0 or coalesce(p_loose_units,-1)<0 then raise exception 'Quantity cannot be negative'; end if;
 v_qty:=p_cases*v_upc+p_loose_units; if v_qty<=0 then raise exception 'Enter a quantity greater than zero'; end if;
 v_current:=v_row.cases_on_hand*v_upc+v_row.units_on_hand;
 if v_qty>v_current then raise exception 'Not enough assigned stock'; end if;
 v_next:=v_current-v_qty;
 update public.employee_inventory set cases_on_hand=v_next/v_upc,units_on_hand=mod(v_next,v_upc),updated_at=now() where id=v_row.id;
 insert into public.inventory_transactions(user_id,product_id,transaction_type,quantity_units,cases_delta,units_delta,reference,notes,location_id)
 values(auth.uid(),v_row.product_id,'use',-v_qty,-p_cases,-p_loose_units,p_reference,concat('Employee-held stock use. ',coalesce(p_notes,'')),v_row.location_id);
 insert into public.audit_logs(user_id,action,entity_type,entity_id,metadata)
 values(auth.uid(),'employee_stock_use','employee_inventory',v_row.id,jsonb_build_object('employee_id',v_row.employee_id,'product_id',v_row.product_id,'product_name',v_product.name,'quantity_units',v_qty,'reference',p_reference,'notes',p_notes));
 return jsonb_build_object('success',true,'remaining_units',v_next);
end; $$;
revoke all on function public.record_inventory_movement(uuid,public.inventory_transaction_type,integer,integer,uuid,uuid,text,text) from public;
grant execute on function public.record_inventory_movement(uuid,public.inventory_transaction_type,integer,integer,uuid,uuid,text,text) to authenticated;
revoke all on function public.record_employee_stock_use(uuid,integer,integer,text,text) from public;
grant execute on function public.record_employee_stock_use(uuid,integer,integer,text,text) to authenticated;
commit;