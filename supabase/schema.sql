-- ShiftBoard Lite Supabase schema.
-- Run only against a new, empty project. This file mirrors the schema used by this app.

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  name text not null default 'My Workspace' check (char_length(trim(name)) between 2 and 100),
  created_at timestamptz not null default now()
);

create table public.staff_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 100),
  role text not null default 'Service specialist' check (char_length(trim(role)) between 1 and 100),
  initials text not null default '',
  color text not null default '#dce5d9' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
create index staff_members_workspace_idx on public.staff_members(workspace_id);

create table public.shifts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  staff_member_id uuid references public.staff_members(id) on delete set null,
  shift_date date not null,
  shift_type text not null check (shift_type in ('opening', 'day', 'closing')),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shifts_workspace_date_idx on public.shifts(workspace_id, shift_date);
create index shifts_staff_date_idx on public.shifts(staff_member_id, shift_date);

create or replace function public.prevent_overlapping_shift_assignments()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  new_start integer;
  new_end integer;
begin
  if new.staff_member_id is null then
    new.updated_at := now();
    return new;
  end if;

  case new.shift_type
    when 'opening' then new_start := 480; new_end := 720;
    when 'day' then new_start := 720; new_end := 960;
    when 'closing' then new_start := 960; new_end := 1200;
    else raise exception 'Invalid shift type';
  end case;

  if exists (
    select 1
    from public.shifts s
    where s.workspace_id = new.workspace_id
      and s.shift_date = new.shift_date
      and s.staff_member_id = new.staff_member_id
      and s.id <> new.id
      and (case s.shift_type
        when 'opening' then 480 when 'day' then 720 when 'closing' then 960 else -1 end) < new_end
      and new_start < (case s.shift_type
        when 'opening' then 720 when 'day' then 960 when 'closing' then 1200 else -1 end)
  ) then
    raise exception using errcode = '23P01',
      message = 'This team member already has an overlapping shift on this date.';
  end if;

  if not exists (
    select 1 from public.staff_members m
    where m.id = new.staff_member_id and m.workspace_id = new.workspace_id
  ) then
    raise exception using errcode = '23503',
      message = 'The selected team member does not belong to this workspace.';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create trigger shifts_prevent_overlapping_assignments
before insert or update on public.shifts
for each row execute function public.prevent_overlapping_shift_assignments();

alter table public.workspaces enable row level security;
alter table public.staff_members enable row level security;
alter table public.shifts enable row level security;

create policy "Owners can read their workspace"
on public.workspaces for select to authenticated
using (owner_id = (select auth.uid()));
create policy "Owners can create their workspace"
on public.workspaces for insert to authenticated
with check (owner_id = (select auth.uid()));
create policy "Owners can update their workspace"
on public.workspaces for update to authenticated
using (owner_id = (select auth.uid()))
with check (owner_id = (select auth.uid()));
create policy "Owners can delete their workspace"
on public.workspaces for delete to authenticated
using (owner_id = (select auth.uid()));

create policy "Owners can manage their staff"
on public.staff_members for all to authenticated
using (exists (
  select 1 from public.workspaces w
  where w.id = staff_members.workspace_id and w.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.workspaces w
  where w.id = staff_members.workspace_id and w.owner_id = (select auth.uid())
));

create policy "Owners can manage their shifts"
on public.shifts for all to authenticated
using (exists (
  select 1 from public.workspaces w
  where w.id = shifts.workspace_id and w.owner_id = (select auth.uid())
))
with check (exists (
  select 1 from public.workspaces w
  where w.id = shifts.workspace_id and w.owner_id = (select auth.uid())
));

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.workspaces to authenticated;
grant select, insert, update, delete on public.staff_members to authenticated;
grant select, insert, update, delete on public.shifts to authenticated;
