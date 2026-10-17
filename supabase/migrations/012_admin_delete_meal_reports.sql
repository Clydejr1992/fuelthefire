-- Admin-only meal report deletion with a retained deletion snapshot.
-- Apply this migration in Supabase SQL Editor only after reviewing the target project.

begin;

create table if not exists public.meal_report_deletions (
  id uuid primary key default gen_random_uuid(),
  deleted_report_id uuid not null,
  actor_id uuid not null references public.profiles(id) on delete restrict,
  report_snapshot jsonb not null,
  deleted_at timestamptz not null default now()
);

alter table public.meal_report_deletions enable row level security;
revoke all on public.meal_report_deletions from public, anon, authenticated;

create or replace function public.admin_delete_meal_report(p_report_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.meal_reports%rowtype;
  v_snapshot jsonb;
begin
  if auth.uid() is null or not public.is_active_user() or not public.meal_reports_is_admin() then
    raise exception 'Active administrator access required';
  end if;

  select * into r
  from public.meal_reports
  where id = p_report_id
  for update;

  if not found then
    raise exception 'Meal report not found';
  end if;

  v_snapshot := to_jsonb(r) || jsonb_build_object(
    'school_name', (select s.name from public.schools s where s.id = r.school_id),
    'items', coalesce((
      select jsonb_agg(to_jsonb(i) order by i.created_at)
      from public.meal_report_items i
      where i.report_id = r.id
    ), '[]'::jsonb)
  );

  insert into public.meal_report_deletions(deleted_report_id, actor_id, report_snapshot)
  values (r.id, auth.uid(), v_snapshot);

  delete from public.meal_report_events where report_id = r.id;
  delete from public.meal_report_items where report_id = r.id;
  delete from public.meal_reports where id = r.id;
end;
$$;

revoke all on function public.admin_delete_meal_report(uuid) from public, anon;
grant execute on function public.admin_delete_meal_report(uuid) to authenticated;

commit;
