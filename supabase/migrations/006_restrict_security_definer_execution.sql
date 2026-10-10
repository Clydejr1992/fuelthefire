-- Restrict exposed SECURITY DEFINER RPCs to signed-in users; trigger-only functions are not API-callable.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_profile_security_fields() FROM PUBLIC, anon, authenticated;

REVOKE EXECUTE ON FUNCTION public.is_active_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_manager_or_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_active_user() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_manager_or_admin() TO authenticated;

REVOKE EXECUTE ON FUNCTION public.complete_password_setup() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.receive_purchase_order(uuid,jsonb,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_employee_stock_use(uuid,integer,integer,text,text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.record_inventory_movement(uuid,public.inventory_transaction_type,integer,integer,uuid,uuid,text,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_password_setup() TO authenticated;
GRANT EXECUTE ON FUNCTION public.receive_purchase_order(uuid,jsonb,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_employee_stock_use(uuid,integer,integer,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_inventory_movement(uuid,public.inventory_transaction_type,integer,integer,uuid,uuid,text,text) TO authenticated;
