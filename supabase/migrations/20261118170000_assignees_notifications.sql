-- Plusieurs personnes par tâche, notifications (attribution, mention, invitation) et temps réel partout.

-- Attribution multiple ---------------------------------------------------------
-- assignee_id reste rempli (première personne) pour les apps déjà installées.
alter table public.tasks add column if not exists assignee_ids uuid[] not null default '{}';
update public.tasks set assignee_ids = array[assignee_id] where assignee_id is not null and assignee_ids = '{}';

create or replace function public.sync_assignees()
returns trigger language plpgsql set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.assignee_id is distinct from old.assignee_id and new.assignee_ids = old.assignee_ids then
    -- Ancienne app : elle ne connaît qu'une personne.
    new.assignee_ids := case when new.assignee_id is null then '{}' else array[new.assignee_id] end;
  elsif tg_op = 'INSERT' and new.assignee_ids = '{}' and new.assignee_id is not null then
    new.assignee_ids := array[new.assignee_id];
  end if;
  new.assignee_ids := coalesce(array(select distinct x from unnest(new.assignee_ids) x where x is not null), '{}');
  new.assignee_id := new.assignee_ids[1];
  return new;
end;
$$;
create trigger tasks_sync_assignees before insert or update on public.tasks
  for each row execute function public.sync_assignees();

-- Notifications ----------------------------------------------------------------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  group_id uuid references public.groups (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  kind text not null check (kind in ('assigned', 'mention', 'invited', 'joined')),
  title text not null,
  body text not null default '',
  link text,
  data jsonb not null default '{}',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
alter table public.notifications enable row level security;
-- Chacun ne voit, ne lit et ne supprime que les siennes. Elles sont créées par le serveur uniquement.
create policy "notifs lisibles" on public.notifications for select using (user_id = auth.uid());
create policy "notifs marquées lues" on public.notifications for update using (user_id = auth.uid());
create policy "notifs supprimées" on public.notifications for delete using (user_id = auth.uid());

create or replace function public.actor_name()
returns text language sql stable security definer set search_path = public as $$
  select coalesce((select name from profiles where id = auth.uid()), 'Quelqu''un');
$$;

-- Tâche attribuée : prévient chaque nouvelle personne (sauf soi-même).
create or replace function public.notify_assigned()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, group_id, actor_id, kind, title, body, link)
  select x, new.group_id, auth.uid(), 'assigned', new.title, actor_name() || ' t''a attribué cette tâche', '/tableau?tache=' || new.id
  from unnest(new.assignee_ids) x
  where x is distinct from auth.uid()
    and (tg_op = 'INSERT' or not (x = any (old.assignee_ids)))
    and exists (select 1 from group_members m where m.group_id = new.group_id and m.user_id = x);
  return null;
end;
$$;
create trigger tasks_notify_assigned after insert or update of assignee_ids on public.tasks
  for each row execute function public.notify_assigned();

-- Mention dans le chat : « @Prénom Nom » ou « @Prénom ».
create or replace function public.notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  low text := lower(new.body);
  salon text;
begin
  if position('@' in new.body) = 0 then return null; end if;
  select name into salon from channels where id = new.channel_id;
  insert into notifications (user_id, group_id, actor_id, kind, title, body, link)
  select p.id, new.group_id, new.author_id, 'mention', actor_name() || ' t''a mentionné dans #' || coalesce(salon, 'chat'),
         left(new.body, 140), '/chat?salon=' || new.channel_id
  from group_members m join profiles p on p.id = m.user_id
  where m.group_id = new.group_id and p.id <> new.author_id
    and (low ~ ('@' || regexp_replace(lower(p.name), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^[:alnum:]])')
      or low ~ ('@' || regexp_replace(lower(split_part(p.name, ' ', 1)), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^[:alnum:]])'));
  return null;
end;
$$;
create trigger messages_notify_mentions after insert on public.messages
  for each row execute function public.notify_mentions();

-- Arrivée d'un membre : prévient les admins.
create or replace function public.notify_joined()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (user_id, group_id, actor_id, kind, title, body, link)
  select a.user_id, new.group_id, new.user_id, 'joined', g.name,
         coalesce((select name from profiles where id = new.user_id), 'Quelqu''un') || ' a rejoint le projet', '/equipe'
  from group_members a join groups g on g.id = new.group_id
  where a.group_id = new.group_id and a.role = 'admin' and a.user_id <> new.user_id;
  return null;
end;
$$;
create trigger members_notify_joined after insert on public.group_members
  for each row execute function public.notify_joined();

-- Inviter quelqu'un qui a déjà un compte : il reçoit une notification avec une invitation à usage unique.
-- Renvoie true si la personne a été prévenue (false : pas de compte avec cet email).
create or replace function public.invite_by_email(gid uuid, email text, new_role text default 'member')
returns boolean language plpgsql security definer set search_path = public as $$
declare
  target uuid;
  inv_code text;
  gname text;
begin
  if not is_admin(gid) then raise exception 'réservé aux admins'; end if;
  if new_role not in ('admin', 'member', 'guest') then raise exception 'rôle inconnu'; end if;
  select id into target from auth.users where lower(auth.users.email) = lower(trim(invite_by_email.email));
  if target is null then return false; end if;
  if exists (select 1 from group_members where group_id = gid and user_id = target) then raise exception 'déjà membre du projet'; end if;
  insert into invitations (group_id, role, max_uses, expires_at) values (gid, new_role, 1, now() + interval '14 days')
  returning code into inv_code;
  select name into gname from groups where id = gid;
  insert into notifications (user_id, group_id, actor_id, kind, title, body, data)
  values (target, gid, auth.uid(), 'invited', gname, actor_name() || ' t''invite dans ce projet', jsonb_build_object('code', inv_code));
  return true;
end;
$$;
revoke execute on function public.invite_by_email(uuid, text, text) from anon;

-- Les fonctions internes ne sont pas appelables depuis l'API.
revoke execute on function public.notify_assigned() from anon, authenticated;
revoke execute on function public.notify_mentions() from anon, authenticated;
revoke execute on function public.notify_joined() from anon, authenticated;
revoke execute on function public.sync_assignees() from anon, authenticated;
revoke execute on function public.actor_name() from anon;

-- Temps réel -------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array['notifications', 'links', 'channels', 'group_members', 'profiles', 'groups'] loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
