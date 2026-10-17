-- DRAFT ONLY. Separate migration so the new enum value is committed before any policy/function references it.
-- Do not apply to production until the full Cook role design is reviewed.
ALTER TYPE public.user_role ADD VALUE IF NOT EXISTS 'cook';
