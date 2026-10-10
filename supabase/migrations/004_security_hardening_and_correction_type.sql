-- Fuel the Fire security hardening and compatibility fixes.
-- Apply in Supabase migrations; live project was updated with this migration.
ALTER TYPE public.transaction_type ADD VALUE IF NOT EXISTS 'correction';

DROP POLICY IF EXISTS profiles_manager_read ON public.profiles;
CREATE POLICY profiles_manager_read ON public.profiles
  FOR SELECT TO authenticated USING (public.is_manager_or_admin());

DROP POLICY IF EXISTS profiles_update_self ON public.profiles;
REVOKE UPDATE ON public.profiles FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.products FROM authenticated;
GRANT INSERT (barcode, sku, name, description, category_id, vendor_id, location_id,
              units_per_case, minimum_units, expiration_date, lot_number, active,
              created_by, reorder_level, unit_name, notes)
  ON public.products TO authenticated;
GRANT UPDATE (barcode, sku, name, description, category_id, vendor_id, location_id,
              units_per_case, minimum_units, expiration_date, lot_number, active,
              reorder_level, unit_name, notes, updated_at)
  ON public.products TO authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.inventory_transactions FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.audit_logs FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.employee_inventory FROM authenticated;

REVOKE UPDATE, DELETE ON public.purchase_order_items FROM authenticated;
REVOKE UPDATE ON public.purchase_orders FROM authenticated;
GRANT SELECT, INSERT ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT ON public.purchase_order_items TO authenticated;

NOTIFY pgrst, 'reload schema';
