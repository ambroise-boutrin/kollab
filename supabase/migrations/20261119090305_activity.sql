-- Historique des actions de l'équipe, rempli par la base elle-même (personne ne peut y écrire à la main).
create table if not exists public.activity (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  verb text not null,
  target text not null,
  target_id text,
  label text,
  meta jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists activity_group_time on public.activity (group_id, created_at desc);
alter table public.activity enable row level security;
create policy "historique lisible" on public.activity for select using (public.is_member(group_id));

-- Vrai si la ligne est à la corbeille (deleted_at rempli).
create or replace function public.activity_in_trash(j jsonb) returns boolean language sql immutable as $$
  select j is not null and (j ->> 'deleted_at') is not null
$$;

create or replace function public.log_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare
  n jsonb := to_jsonb(new);
  o jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else null end;
  verb text;
  tid text := n ->> 'id';
  label text := coalesce(n ->> 'title', n ->> 'name');
  meta jsonb := '{}';
begin
  if tg_table_name = 'group_members' then
    if tg_op <> 'INSERT' then return new; end if;
    verb := 'joined'; tid := n ->> 'user_id'; label := null;
  elsif tg_op = 'INSERT' then verb := 'created';
  elsif public.activity_in_trash(n) and not public.activity_in_trash(o) then verb := 'trashed';
  elsif public.activity_in_trash(o) and not public.activity_in_trash(n) then verb := 'restored';
  elsif tg_table_name = 'tasks' and (n ->> 'status') is distinct from (o ->> 'status') then
    verb := 'moved'; meta := jsonb_build_object('from', o ->> 'status', 'to', n ->> 'status');
  elsif tg_table_name = 'tasks' and (n -> 'assignee_ids') is distinct from (o -> 'assignee_ids') then verb := 'assigned';
  elsif tg_table_name = 'tasks' and (n ->> 'pr_url') is distinct from (o ->> 'pr_url') and (n ->> 'pr_url') is not null then
    verb := 'pr_linked'; meta := jsonb_build_object('pr', n ->> 'pr_url');
  elsif tg_table_name = 'sprints' and (n ->> 'status') is distinct from (o ->> 'status') then verb := 'sprint_' || (n ->> 'status');
  elsif tg_table_name = 'links' and ((n ->> 'title') is distinct from (o ->> 'title') or (n ->> 'url') is distinct from (o ->> 'url')) then verb := 'edited';
  elsif tg_table_name = 'groups' and (n ->> 'name') is distinct from (o ->> 'name') then verb := 'renamed';
  elsif tg_table_name = 'groups' and (n ->> 'logo_url') is distinct from (o ->> 'logo_url') then verb := 'logo';
  else return new;
  end if;
  insert into public.activity (group_id, actor_id, verb, target, target_id, label, meta)
  values (coalesce((n ->> 'group_id')::uuid, (n ->> 'id')::uuid), auth.uid(), verb, tg_table_name, tid, left(label, 200), meta);
  return new;
end
$$;
revoke all on function public.log_activity() from public, anon, authenticated;

create trigger activity_tasks after insert or update on public.tasks for each row execute function public.log_activity();
create trigger activity_links after insert or update on public.links for each row execute function public.log_activity();
create trigger activity_documents after insert or update on public.documents for each row execute function public.log_activity();
create trigger activity_sprints after insert or update on public.sprints for each row execute function public.log_activity();
create trigger activity_notes after insert or update of title on public.notes for each row execute function public.log_activity();
create trigger activity_members after insert on public.group_members for each row execute function public.log_activity();
create trigger activity_groups after update on public.groups for each row execute function public.log_activity();

-- Point de départ : ce qui existe déjà.
insert into public.activity (group_id, actor_id, verb, target, target_id, label, created_at)
select group_id, null, 'created', 'tasks', id::text, left(title, 200), created_at from public.tasks;
insert into public.activity (group_id, actor_id, verb, target, target_id, created_at)
select group_id, user_id, 'joined', 'group_members', user_id::text, joined_at from public.group_members;

alter publication supabase_realtime add table public.activity;
