-- Fix enum mismatch between RPC argument and inventory_transactions.transaction_type.
CREATE OR REPLACE FUNCTION public.record_inventory_movement(
 p_product_id uuid,
 p_movement_type public.inventory_transaction_type,
 p_cases integer DEFAULT 0,
 p_loose_units integer DEFAULT 0,
 p_location_id uuid DEFAULT NULL,
 p_employee_id uuid DEFAULT NULL,
 p_reference text DEFAULT NULL,
 p_notes text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
 v_product public.products%rowtype;
 v_emp public.profiles%rowtype;
 v_assignment public.employee_inventory%rowtype;
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
   if v_qty>v_current then raise exception 'Not enough central stock'; end if;
   v_next:=v_current-v_qty;
 elsif p_movement_type='receive' then v_next:=v_current+v_qty;
 elsif p_movement_type in ('adjustment','correction') then
   if upper(coalesce(p_reference,'')) like 'REMOVE:%' then
     if v_qty>v_current then raise exception 'Cannot remove more than current stock'; end if;
     v_next:=v_current-v_qty;
   else v_next:=v_current+v_qty; end if;
 elsif p_movement_type='count' then v_next:=v_qty;
 else raise exception 'Unsupported movement type'; end if;
 update public.products set cases_on_hand=v_next/v_upc,units_on_hand=mod(v_next,v_upc),updated_at=now() where id=p_product_id;
 insert into public.inventory_transactions(user_id,product_id,transaction_type,quantity_units,quantity_before,quantity_after,cases_delta,units_delta,reference,reason,notes,location_id)
 values(auth.uid(),p_product_id,p_movement_type::text::public.transaction_type,
 case when p_movement_type='count' then v_next else v_qty end,v_current,v_next,
 case when p_movement_type='receive' then p_cases when p_movement_type in ('use','waste','transfer') then -p_cases else 0 end,
 case when p_movement_type='receive' then p_loose_units when p_movement_type in ('use','waste','transfer') then -p_loose_units else 0 end,
 p_reference,p_movement_type::text,p_notes,p_location_id);
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
end;
$function$;
NOTIFY pgrst, 'reload schema';
