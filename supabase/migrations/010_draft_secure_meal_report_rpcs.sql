-- DRAFT ONLY: secure meal-report workflow RPCs.
-- Must be tested on a disposable database before any production rollout.
begin;

-- Clients may read reports and assigned schools, but all writes go through narrow RPCs.

-- Append-only history for report state and school assignment changes.
create table if not exists public.meal_report_events (
 id uuid primary key default gen_random_uuid(),
 report_id uuid not null references public.meal_reports(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete restrict,
 event_type text not null check (event_type in ('created','updated','submitted','approved','returned')),
 old_status text,
 new_status text,
 event_note text,
 event_data jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
create index if not exists meal_report_events_report_created on public.meal_report_events(report_id,created_at desc);
alter table public.meal_report_events enable row level security;
revoke all on public.meal_report_events from public,anon,authenticated;
grant select on public.meal_report_events to authenticated;
drop policy if exists meal_report_events_admin_read on public.meal_report_events;
create policy meal_report_events_admin_read on public.meal_report_events for select to authenticated using (public.meal_reports_is_admin());
drop policy if exists meal_report_events_cook_read on public.meal_report_events;
create policy meal_report_events_cook_read on public.meal_report_events for select to authenticated using (exists(select 1 from public.meal_reports r where r.id=report_id and r.cook_id=auth.uid()));

create or replace function public.log_meal_report_event()
returns trigger language plpgsql security definer set search_path=public
as $$
declare
 v_event text;
begin
 if tg_op='INSERT' then
   v_event:=case when new.status='draft' then 'created' else new.status end;
   insert into public.meal_report_events(report_id,actor_id,event_type,old_status,new_status,event_note,event_data)
   values(new.id,auth.uid(),v_event,null,new.status,new.return_note,jsonb_build_object('school_id',new.school_id,'service_date',new.service_date,'meal_program',new.meal_program));
   return new;
 end if;
 if old.status is distinct from new.status then
   v_event:=case new.status when 'submitted' then 'submitted' when 'approved' then 'approved' when 'returned' then 'returned' else 'updated' end;
   insert into public.meal_report_events(report_id,actor_id,event_type,old_status,new_status,event_note,event_data)
   values(new.id,auth.uid(),v_event,old.status,new.status,new.return_note,jsonb_build_object('school_id',new.school_id,'service_date',new.service_date,'meal_program',new.meal_program));
 elsif old.school_id is distinct from new.school_id or old.service_date is distinct from new.service_date or old.meal_program is distinct from new.meal_program or old.notes is distinct from new.notes then
   insert into public.meal_report_events(report_id,actor_id,event_type,old_status,new_status,event_note,event_data)
   values(new.id,auth.uid(),'updated',old.status,new.status,null,jsonb_build_object('school_id',new.school_id,'service_date',new.service_date,'meal_program',new.meal_program));
 end if;
 return new;
end;
$$;
drop trigger if exists meal_report_event_log on public.meal_reports;
create trigger meal_report_event_log after insert or update on public.meal_reports for each row execute function public.log_meal_report_event();

create table if not exists public.cook_school_assignment_events (
 id uuid primary key default gen_random_uuid(),
 assignment_id uuid not null,
 cook_id uuid not null references public.profiles(id) on delete restrict,
 school_id uuid not null references public.schools(id) on delete restrict,
 actor_id uuid references public.profiles(id) on delete restrict,
 event_type text not null check (event_type in ('assigned','revoked')),
 created_at timestamptz not null default now()
);
alter table public.cook_school_assignment_events enable row level security;
revoke all on public.cook_school_assignment_events from public,anon,authenticated;
grant select on public.cook_school_assignment_events to authenticated;
drop policy if exists cook_school_assignment_events_admin_read on public.cook_school_assignment_events;
create policy cook_school_assignment_events_admin_read on public.cook_school_assignment_events for select to authenticated using (public.meal_reports_is_admin());

create or replace function public.log_cook_school_assignment_event()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if tg_op='INSERT' then
   insert into public.cook_school_assignment_events(assignment_id,cook_id,school_id,actor_id,event_type)
   values(new.id,new.cook_id,new.school_id,auth.uid(),'assigned');
 elsif old.revoked_at is null and new.revoked_at is not null then
   insert into public.cook_school_assignment_events(assignment_id,cook_id,school_id,actor_id,event_type)
   values(new.id,new.cook_id,new.school_id,auth.uid(),'revoked');
 end if;
 return new;
end;
$$;
drop trigger if exists cook_school_assignment_event_log on public.cook_school_assignments;
create trigger cook_school_assignment_event_log after insert or update of revoked_at on public.cook_school_assignments for each row execute function public.log_cook_school_assignment_event();

revoke insert, update, delete on public.meal_reports from authenticated;
revoke insert, update, delete on public.meal_report_items from authenticated;
revoke insert, update, delete on public.cook_school_assignments from authenticated;
revoke insert, update, delete on public.schools from authenticated;

create or replace function public.cook_save_meal_report(
 p_report_id uuid,
 p_school_id uuid,
 p_service_date date,
 p_meal_program text,
 p_notes text,
 p_items jsonb
) returns uuid
language plpgsql security definer set search_path=public
as $$
declare
 v_report_id uuid;
 v_status text;
 v_item jsonb;
begin
 if auth.uid() is null or not public.is_active_user() then raise exception 'Active sign-in required'; end if;
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role::text='cook') then
   raise exception 'Active Cook account required';
 end if;
 if not public.cook_has_school_access(p_school_id) then raise exception 'You are not assigned to this school'; end if;
 if p_service_date is null or p_service_date > current_date then raise exception 'Choose a valid service date'; end if;
 if p_meal_program is null or length(trim(p_meal_program)) not between 1 and 80 then raise exception 'Meal program is required'; end if;
 if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) > 200 then raise exception 'Provide up to 200 food items'; end if;
 if exists(select 1 from jsonb_array_elements(p_items) as x(i) where
   length(trim(coalesce(i->>'item_name',''))) not between 1 and 160
   or length(trim(coalesce(i->>'category','Other'))) not between 1 and 80
   or length(trim(coalesce(i->>'unit_name','servings'))) not between 1 and 40
   or coalesce((i->>'quantity_offered')::numeric,-1)<0
   or coalesce((i->>'quantity_reused')::numeric,-1)<0
   or coalesce((i->>'quantity_wasted')::numeric,-1)<0
 ) then raise exception 'Each item needs a name and valid non-negative quantities'; end if;

 if p_report_id is null then
   insert into public.meal_reports(school_id,service_date,meal_program,cook_id,status,notes)
   values(p_school_id,p_service_date,trim(p_meal_program),auth.uid(),'draft',nullif(trim(coalesce(p_notes,'')),''))
   returning id into v_report_id;
 else
   select status into v_status from public.meal_reports
   where id=p_report_id and cook_id=auth.uid() for update;
   if not found then raise exception 'Report not found'; end if;
   if v_status not in ('draft','returned') then raise exception 'Only draft or returned reports can be edited'; end if;
   update public.meal_reports set school_id=p_school_id,service_date=p_service_date,
     meal_program=trim(p_meal_program),notes=nullif(trim(coalesce(p_notes,'')),''),
     status='draft',submitted_at=null,returned_at=null,returned_by=null,return_note=null,updated_at=now()
   where id=p_report_id returning id into v_report_id;
   delete from public.meal_report_items where report_id=v_report_id;
 end if;

 for v_item in select value from jsonb_array_elements(p_items) loop
   insert into public.meal_report_items(report_id,product_id,item_name,category,quantity_offered,quantity_reused,quantity_wasted,unit_name)
   values(v_report_id,case when coalesce(v_item->>'product_id','')='' then null else (v_item->>'product_id')::uuid end,trim(v_item->>'item_name'),
     coalesce(nullif(trim(v_item->>'category'),''),'Other'),
     coalesce((v_item->>'quantity_offered')::numeric,0),
     coalesce((v_item->>'quantity_reused')::numeric,0),
     coalesce((v_item->>'quantity_wasted')::numeric,0),
     coalesce(nullif(trim(v_item->>'unit_name'),''),'servings'));
 end loop;
 return v_report_id;
end;
$$;

create or replace function public.cook_submit_meal_report(p_report_id uuid)
returns void language plpgsql security definer set search_path=public
as $$
declare r public.meal_reports%rowtype;
begin
 if auth.uid() is null or not public.is_active_user() then raise exception 'Active sign-in required'; end if;
 if not exists(select 1 from public.profiles p where p.id=auth.uid() and p.active and p.role::text='cook') then raise exception 'Active Cook account required'; end if;
 select * into r from public.meal_reports where id=p_report_id and cook_id=auth.uid() for update;
 if not found then raise exception 'Report not found'; end if;
 if r.status not in ('draft','returned') then raise exception 'Only draft or returned reports can be submitted'; end if;
 if not public.cook_has_school_access(r.school_id) then raise exception 'School assignment is no longer active'; end if;
 if not exists(select 1 from public.meal_report_items i where i.report_id=r.id) then raise exception 'Add at least one food item'; end if;
 update public.meal_reports set status='submitted',submitted_at=now(),approved_at=null,approved_by=null,returned_at=null,returned_by=null,return_note=null,updated_at=now() where id=r.id;
end;
$$;

create or replace function public.admin_review_meal_report(p_report_id uuid,p_decision text,p_note text default null)
returns void language plpgsql security definer set search_path=public
as $$
declare r public.meal_reports%rowtype;
begin
 if auth.uid() is null or not public.is_active_user() or not public.meal_reports_is_admin() then raise exception 'Active administrator access required'; end if;
 if p_decision not in ('approve','return') then raise exception 'Decision must be approve or return'; end if;
 if p_decision='return' and length(trim(coalesce(p_note,'')))=0 then raise exception 'Provide a reason when returning a report'; end if;
 select * into r from public.meal_reports where id=p_report_id for update;
 if not found then raise exception 'Report not found'; end if;
 if r.status<>'submitted' then raise exception 'Only submitted reports can be reviewed'; end if;
 if p_decision='approve' then
   update public.meal_reports set status='approved',approved_at=now(),approved_by=auth.uid(),updated_at=now(),return_note=null where id=r.id;
 else
   update public.meal_reports set status='returned',returned_at=now(),returned_by=auth.uid(),return_note=left(trim(p_note),1000),approved_at=null,approved_by=null,updated_at=now() where id=r.id;
 end if;
end;
$$;

create or replace function public.admin_assign_cook_school(p_cook_id uuid,p_school_id uuid,p_assign boolean)
returns void language plpgsql security definer set search_path=public
as $$
begin
 if auth.uid() is null or not public.is_active_user() or not public.meal_reports_is_admin() then raise exception 'Active administrator access required'; end if;
 if not exists(select 1 from public.profiles p where p.id=p_cook_id and p.active and p.role::text='cook') then raise exception 'Choose an active Cook account'; end if;
 if not exists(select 1 from public.schools s where s.id=p_school_id and s.active) then raise exception 'Choose an active school'; end if;
 if p_assign then
   insert into public.cook_school_assignments(cook_id,school_id,assigned_by)
   values(p_cook_id,p_school_id,auth.uid())
   on conflict (cook_id,school_id) where revoked_at is null do nothing;
 else
   update public.cook_school_assignments set revoked_at=now()
   where cook_id=p_cook_id and school_id=p_school_id and revoked_at is null;
 end if;
end;
$$;

create or replace function public.admin_save_school(p_school_id uuid,p_name text,p_active boolean)
returns uuid language plpgsql security definer set search_path=public
as $$
declare v_id uuid;
begin
 if auth.uid() is null or not public.is_active_user() or not public.meal_reports_is_admin() then raise exception 'Active administrator access required'; end if;
 if length(trim(coalesce(p_name,''))) not between 1 and 160 then raise exception 'School name is required'; end if;
 if p_school_id is null then
   insert into public.schools(name,active) values(trim(p_name),coalesce(p_active,true)) returning id into v_id;
 else
   update public.schools set name=trim(p_name),active=coalesce(p_active,true),updated_at=now() where id=p_school_id returning id into v_id;
   if v_id is null then raise exception 'School not found'; end if;
 end if;
 return v_id;
end;
$$;

revoke all on function public.cook_save_meal_report(uuid,uuid,date,text,text,jsonb) from public,anon;
revoke all on function public.cook_submit_meal_report(uuid) from public,anon;
revoke all on function public.admin_review_meal_report(uuid,text,text) from public,anon;
revoke all on function public.admin_assign_cook_school(uuid,uuid,boolean) from public,anon;
revoke all on function public.admin_save_school(uuid,text,boolean) from public,anon;
grant execute on function public.cook_save_meal_report(uuid,uuid,date,text,text,jsonb) to authenticated;
grant execute on function public.cook_submit_meal_report(uuid) to authenticated;
grant execute on function public.admin_review_meal_report(uuid,text,text) to authenticated;
grant execute on function public.admin_assign_cook_school(uuid,uuid,boolean) to authenticated;
grant execute on function public.admin_save_school(uuid,text,boolean) to authenticated;

commit;

-- Important: this migration secures core write transitions but is not release-approved
-- until tested against a disposable database with Cook, Admin, Manager, and Employee users.
-- Still required: full audit/history for every transition, duplicate/conflict detection,
-- school catalog UI, PDF/print summary, and exhaustive grants/RLS tests.
