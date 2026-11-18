-- Scrum : sprints, backlog (tâches sans sprint) et date de fin des tâches pour le burndown.

create table if not exists public.sprints (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 80),
  goal text not null default '' check (char_length(goal) <= 300),
  starts_on date not null default current_date,
  ends_on date not null default current_date + 14,
  status text not null default 'planned' check (status in ('planned', 'active', 'done')),
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null,
  check (ends_on >= starts_on)
);
create index if not exists sprints_group_idx on public.sprints (group_id, starts_on);
-- Un seul sprint en cours par projet.
create unique index if not exists sprints_one_active on public.sprints (group_id) where status = 'active' and deleted_at is null;
alter table public.sprints enable row level security;
create policy "sprints lisibles" on public.sprints for select using (public.is_member(group_id));
create policy "sprints créés" on public.sprints for insert with check (public.can_write(group_id));
create policy "sprints modifiés" on public.sprints for update using (public.can_write(group_id)) with check (public.can_write(group_id));

alter table public.tasks add column if not exists sprint_id uuid references public.sprints (id) on delete set null;
alter table public.tasks add column if not exists done_at timestamptz;
create index if not exists tasks_sprint_idx on public.tasks (sprint_id);

-- Date de fin : posée quand la tâche passe en « Terminé », retirée si elle en sort.
create or replace function public.task_done_at()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.status = 'done' then
    if tg_op = 'INSERT' or old.status is distinct from 'done' or new.done_at is null then new.done_at := coalesce(new.done_at, now()); end if;
  else
    new.done_at := null;
  end if;
  return new;
end;
$$;
create trigger tasks_done_at before insert or update of status on public.tasks for each row execute function public.task_done_at();
revoke execute on function public.task_done_at() from public, anon, authenticated;

-- Une tâche ne peut aller que dans un sprint de son projet.
create or replace function public.task_sprint_same_group()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.sprint_id is not null and not exists (select 1 from sprints s where s.id = new.sprint_id and s.group_id = new.group_id) then
    new.sprint_id := null;
  end if;
  return new;
end;
$$;
create trigger tasks_sprint_same_group before insert or update of sprint_id on public.tasks for each row execute function public.task_sprint_same_group();
revoke execute on function public.task_sprint_same_group() from public, anon, authenticated;

update public.tasks set done_at = created_at where status = 'done' and done_at is null;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'sprints') then
    alter publication supabase_realtime add table public.sprints;
  end if;
end $$;
