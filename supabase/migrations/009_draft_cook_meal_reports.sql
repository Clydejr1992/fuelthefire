-- DRAFT ONLY: Cook meal reporting and school assignments.
-- NOT applied to Supabase. Review before any use, especially status-transition enforcement.
-- Existing public.locations is an inventory storage location table, not a school catalog.

begin;

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 1 and 160),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.cook_school_assignments (
  id uuid primary key default gen_random_uuid(),
  cook_id uuid not null references public.profiles(id) on delete restrict,
  school_id uuid not null references public.schools(id) on delete restrict,
  assigned_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  revoked_at timestamptz,
  constraint cook_school_assignment_revocation check (revoked_at is null or revoked_at >= created_at)
);
create unique index if not exists cook_school_assignments_one_active
  on public.cook_school_assignments(cook_id, school_id) where revoked_at is null;

create table if not exists public.meal_reports (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete restrict,
  service_date date not null,
  meal_program text not null check (length(trim(meal_program)) between 1 and 80),
  cook_id uuid not null references public.profiles(id) on delete restrict,
  status text not null default 'draft' check (status in ('draft','submitted','returned','approved')),
  notes text,
  submitted_at timestamptz,
  approved_at timestamptz,
  approved_by uuid references public.profiles(id) on delete restrict,
  returned_at timestamptz,
  returned_by uuid references public.profiles(id) on delete restrict,
  return_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint meal_report_submission_state check (
    (status = 'draft' and submitted_at is null and approved_at is null and approved_by is null)
    or (status = 'returned' and submitted_at is not null and approved_at is null and approved_by is null)
    or (status = 'submitted' and submitted_at is not null and approved_at is null and approved_by is null)
    or (status = 'approved' and submitted_at is not null and approved_at is not null and approved_by is not null)
  )
);
create index if not exists meal_reports_school_date on public.meal_reports(school_id, service_date desc);
create index if not exists meal_reports_cook on public.meal_reports(cook_id, created_at desc);

create table if not exists public.meal_report_items (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.meal_reports(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  item_name text not null check (length(trim(item_name)) between 1 and 160),
  category text not null default 'Other' check (length(trim(category)) between 1 and 80),
  quantity_offered numeric(12,2) not null default 0 check (quantity_offered >= 0),
  quantity_reused numeric(12,2) not null default 0 check (quantity_reused >= 0),
  quantity_wasted numeric(12,2) not null default 0 check (quantity_wasted >= 0),
  unit_name text not null default 'servings' check (length(trim(unit_name)) between 1 and 40),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meal_report_items_report on public.meal_report_items(report_id);

create or replace function public.cook_has_school_access(p_school_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.cook_school_assignments a
    join public.profiles p on p.id = a.cook_id
    join public.schools s on s.id = a.school_id
    where a.cook_id = auth.uid() and a.school_id = p_school_id
      and a.revoked_at is null and p.active = true and p.role::text = 'cook'
      and s.active = true
  );
$$;

create or replace function public.meal_reports_is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.active = true and p.role::text = 'admin'
  );
$$;

alter table public.schools enable row level security;
alter table public.cook_school_assignments enable row level security;
alter table public.meal_reports enable row level security;
alter table public.meal_report_items enable row level security;

drop policy if exists schools_admin_manage on public.schools;
create policy schools_admin_manage on public.schools for all to authenticated
using (public.meal_reports_is_admin()) with check (public.meal_reports_is_admin());

drop policy if exists cook_assignments_admin_manage on public.cook_school_assignments;
create policy cook_assignments_admin_manage on public.cook_school_assignments for all to authenticated
using (public.meal_reports_is_admin())
with check (
  public.meal_reports_is_admin()
  and exists (select 1 from public.profiles p where p.id = cook_id and p.active = true and p.role::text = 'cook')
  and exists (select 1 from public.schools s where s.id = school_id and s.active)
  and exists (select 1 from public.profiles p where p.id = assigned_by and p.active = true and p.role::text = 'admin')
);

drop policy if exists cook_assignments_cook_read on public.cook_school_assignments;
create policy cook_assignments_cook_read on public.cook_school_assignments for select to authenticated
using (cook_id = auth.uid() and revoked_at is null);

drop policy if exists schools_assigned_cook_read on public.schools;
create policy schools_assigned_cook_read on public.schools for select to authenticated
using (active = true and exists (
  select 1 from public.cook_school_assignments a
  where a.school_id = schools.id and a.cook_id = auth.uid() and a.revoked_at is null
));

drop policy if exists meal_reports_admin_read on public.meal_reports;
create policy meal_reports_admin_read on public.meal_reports for select to authenticated
using (public.meal_reports_is_admin());

drop policy if exists meal_reports_cook_read on public.meal_reports;
create policy meal_reports_cook_read on public.meal_reports for select to authenticated
using (cook_id = auth.uid());

drop policy if exists meal_reports_cook_insert_draft on public.meal_reports;
create policy meal_reports_cook_insert_draft on public.meal_reports for insert to authenticated
with check (
  cook_id = auth.uid() and status = 'draft' and submitted_at is null
  and approved_at is null and approved_by is null
  and exists (select 1 from public.profiles p where p.id = auth.uid() and p.active = true and p.role::text = 'cook')
  and public.cook_has_school_access(school_id)
);

-- These policies are a draft only. Production-ready submission/approval needs
-- narrow RPCs to validate status transitions and prevent clients forging metadata.
drop policy if exists meal_reports_cook_update_draft on public.meal_reports;
create policy meal_reports_cook_update_draft on public.meal_reports for update to authenticated
using (cook_id = auth.uid() and status in ('draft','returned'))
with check (
  cook_id = auth.uid() and status in ('draft','returned')
  and approved_at is null and approved_by is null
  and public.cook_has_school_access(school_id)
);

drop policy if exists meal_reports_admin_update on public.meal_reports;
create policy meal_reports_admin_update on public.meal_reports for update to authenticated
using (public.meal_reports_is_admin()) with check (public.meal_reports_is_admin());

drop policy if exists meal_report_items_admin_read on public.meal_report_items;
create policy meal_report_items_admin_read on public.meal_report_items for select to authenticated
using (public.meal_reports_is_admin());

drop policy if exists meal_report_items_cook_read on public.meal_report_items;
create policy meal_report_items_cook_read on public.meal_report_items for select to authenticated
using (exists (select 1 from public.meal_reports r where r.id = report_id and r.cook_id = auth.uid()));

drop policy if exists meal_report_items_cook_insert on public.meal_report_items;
create policy meal_report_items_cook_insert on public.meal_report_items for insert to authenticated
with check (exists (
  select 1 from public.meal_reports r where r.id = report_id and r.cook_id = auth.uid()
    and r.status in ('draft','returned') and public.cook_has_school_access(r.school_id)
));

drop policy if exists meal_report_items_cook_update on public.meal_report_items;
create policy meal_report_items_cook_update on public.meal_report_items for update to authenticated
using (exists (select 1 from public.meal_reports r where r.id = report_id and r.cook_id = auth.uid() and r.status in ('draft','returned')))
with check (exists (select 1 from public.meal_reports r where r.id = report_id and r.cook_id = auth.uid() and r.status in ('draft','returned') and public.cook_has_school_access(r.school_id)));

drop policy if exists meal_report_items_cook_delete on public.meal_report_items;
create policy meal_report_items_cook_delete on public.meal_report_items for delete to authenticated
using (exists (select 1 from public.meal_reports r where r.id = report_id and r.cook_id = auth.uid() and r.status in ('draft','returned')));

drop policy if exists meal_report_items_admin_update on public.meal_report_items;
create policy meal_report_items_admin_update on public.meal_report_items for update to authenticated
using (public.meal_reports_is_admin()) with check (public.meal_reports_is_admin());

revoke all on public.schools, public.cook_school_assignments, public.meal_reports, public.meal_report_items from anon, public;
grant select on public.schools, public.cook_school_assignments, public.meal_reports, public.meal_report_items to authenticated;
grant insert, update on public.meal_reports to authenticated;
grant insert, update, delete on public.meal_report_items to authenticated;

revoke all on function public.cook_has_school_access(uuid) from public, anon;
revoke all on function public.meal_reports_is_admin() from public, anon;
grant execute on function public.cook_has_school_access(uuid) to authenticated;
grant execute on function public.meal_reports_is_admin() to authenticated;

commit;

-- REVIEW BLOCKERS before applying anywhere:
-- 1. Add and test RPCs for submit/return/approve; do not expose status updates to cooks directly.
-- 2. Review all existing policies/grants/functions to prove Cook has no inventory/purchasing access.
-- 3. Add/verify updated_at and audit triggers, report history, school deactivation behavior, and assignment revocation policy.
-- 4. Test RLS and direct RPC/API access using separate test accounts in non-production.
