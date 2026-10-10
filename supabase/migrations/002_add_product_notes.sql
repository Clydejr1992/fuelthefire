-- Keep the product form and Supabase products table in sync.
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS notes text;

-- Refresh PostgREST's schema cache so the new column is immediately visible.
NOTIFY pgrst, 'reload schema';
