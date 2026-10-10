-- Supabase default grants included dangerous table-level rights for anon (including TRUNCATE).
-- The application uses signed-in sessions only; public pages do not need database table access.
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM anon;
REVOKE ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon;

REVOKE TRUNCATE, REFERENCES, TRIGGER ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;

REVOKE INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;

REVOKE UPDATE, DELETE ON public.purchase_orders FROM authenticated;
REVOKE UPDATE, DELETE ON public.purchase_order_items FROM authenticated;
GRANT SELECT, INSERT ON public.purchase_orders TO authenticated;
GRANT SELECT, INSERT ON public.purchase_order_items TO authenticated;

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
NOTIFY pgrst, 'reload schema';
