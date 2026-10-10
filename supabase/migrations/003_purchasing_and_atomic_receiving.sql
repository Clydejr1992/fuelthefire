-- Purchasing and atomic receiving for Fuel the Fire.
create table if not exists public.purchase_orders (
 id uuid primary key default gen_random_uuid(),
 order_number text not null unique,
 vendor_id uuid references public.vendors(id) on delete restrict,
 location_id uuid references public.locations(id) on delete set null,
 status text not null default 'draft' check (status in ('draft','submitted','partially_received','received','cancelled')),
 order_date date not null default current_date,
 expected_date date,
 received_at timestamptz,
 reference text,
 notes text,
 created_by uuid references public.profiles(id) on delete set null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.purchase_order_items (
 id uuid primary key default gen_random_uuid(),
 purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
 product_id uuid not null references public.products(id) on delete restrict,
 cases_ordered integer not null default 0 check (cases_ordered >= 0),
 cases_received integer not null default 0 check (cases_received >= 0 and cases_received <= cases_ordered),
 unit_cost numeric(12,4) not null default 0 check (unit_cost >= 0),
 vendor_item_code text,
 notes text,
 created_at timestamptz not null default now(),
 unique(purchase_order_id, product_id)
);
create index if not exists purchase_orders_status_date_idx on public.purchase_orders(status, order_date desc);
create index if not exists purchase_order_items_product_idx on public.purchase_order_items(product_id);
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
drop policy if exists "Managers view purchase orders" on public.purchase_orders;
create policy "Managers view purchase orders" on public.purchase_orders for select to authenticated using (public.is_manager_or_admin());
drop policy if exists "Managers create purchase orders" on public.purchase_orders;
create policy "Managers create purchase orders" on public.purchase_orders for insert to authenticated with check (public.is_manager_or_admin() and (created_by is null or created_by=auth.uid()));
drop policy if exists "Managers update purchase orders" on public.purchase_orders;
create policy "Managers update purchase orders" on public.purchase_orders for update to authenticated using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
drop policy if exists "Managers view purchase order items" on public.purchase_order_items;
create policy "Managers view purchase order items" on public.purchase_order_items for select to authenticated using (public.is_manager_or_admin());
drop policy if exists "Managers create purchase order items" on public.purchase_order_items;
create policy "Managers create purchase order items" on public.purchase_order_items for insert to authenticated with check (public.is_manager_or_admin());
drop policy if exists "Managers update purchase order items" on public.purchase_order_items;
create policy "Managers update purchase order items" on public.purchase_order_items for update to authenticated using (public.is_manager_or_admin()) with check (public.is_manager_or_admin());
drop policy if exists "Managers delete draft purchase order items" on public.purchase_order_items;
create policy "Managers delete draft purchase order items" on public.purchase_order_items for delete to authenticated using (public.is_manager_or_admin());
grant select, insert, update on public.purchase_orders to authenticated;
grant select, insert, update, delete on public.purchase_order_items to authenticated;
create or replace function public.receive_purchase_order(p_order_id uuid, p_items jsonb, p_reference text default null, p_notes text default null)
returns jsonb language plpgsql security definer set search_path=public
as $function$
declare v_order public.purchase_orders%rowtype; v_item jsonb; v_line public.purchase_order_items%rowtype; v_product public.products%rowtype; v_cases integer; v_upc integer; v_before integer; v_after integer; v_received integer := 0;
begin
 if auth.uid() is null or not public.is_active_user() or not public.is_manager_or_admin() then raise exception 'Active manager or administrator sign-in required'; end if;
 select * into v_order from public.purchase_orders where id=p_order_id for update;
 if not found then raise exception 'Purchase order not found'; end if;
 if v_order.status in ('received','cancelled') then raise exception 'This purchase order cannot be received in its current status'; end if;
 if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items)=0 then raise exception 'Select at least one received item'; end if;
 for v_item in select value from jsonb_array_elements(p_items) loop
  v_cases := coalesce((v_item->>'cases_received')::integer,0);
  if v_cases < 0 then raise exception 'Received cases cannot be negative'; end if;
  if v_cases=0 then continue; end if;
  select * into v_line from public.purchase_order_items where id=(v_item->>'item_id')::uuid and purchase_order_id=p_order_id for update;
  if not found then raise exception 'Purchase order line not found'; end if;
  if v_line.cases_received + v_cases > v_line.cases_ordered then raise exception 'Cannot receive more cases than ordered'; end if;
  select * into v_product from public.products where id=v_line.product_id for update;
  v_upc := greatest(coalesce(v_product.units_per_case,1),1);
  v_before := coalesce(v_product.cases_on_hand,0)*v_upc + coalesce(v_product.units_on_hand,0);
  v_after := v_before + v_cases*v_upc;
  update public.products set cases_on_hand=v_after/v_upc, units_on_hand=mod(v_after,v_upc), updated_at=now() where id=v_product.id;
  update public.purchase_order_items set cases_received=cases_received+v_cases where id=v_line.id;
  insert into public.inventory_transactions(user_id,product_id,transaction_type,quantity_units,quantity_before,quantity_after,cases_delta,units_delta,reference,reason,notes,location_id)
  values(auth.uid(),v_product.id,'receive',v_cases*v_upc,v_before,v_after,v_cases,0,coalesce(p_reference,v_order.order_number),'purchase_order_receive',p_notes,v_order.location_id);
  insert into public.audit_logs(user_id,action,entity_type,entity_id,description,metadata)
  values(auth.uid(),'purchase_order_receive','purchase_order',p_order_id,'Received '||v_cases||' cases of '||v_product.name,jsonb_build_object('product_id',v_product.id,'cases',v_cases,'order_number',v_order.order_number,'reference',p_reference,'notes',p_notes));
  v_received := v_received + 1;
 end loop;
 if v_received=0 then raise exception 'Enter at least one positive received quantity'; end if;
 update public.purchase_orders po set status=case when not exists(select 1 from public.purchase_order_items i where i.purchase_order_id=p_order_id and i.cases_received<i.cases_ordered) then 'received' else 'partially_received' end, received_at=case when not exists(select 1 from public.purchase_order_items i where i.purchase_order_id=p_order_id and i.cases_received<i.cases_ordered) then now() else po.received_at end, updated_at=now() where po.id=p_order_id;
 return jsonb_build_object('success',true,'lines_received',v_received,'status',(select status from public.purchase_orders where id=p_order_id));
end;
$function$;
revoke all on function public.receive_purchase_order(uuid,jsonb,text,text) from public;
grant execute on function public.receive_purchase_order(uuid,jsonb,text,text) to authenticated;
NOTIFY pgrst, 'reload schema';
