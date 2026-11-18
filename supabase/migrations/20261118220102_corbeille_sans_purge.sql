-- Corbeille : supprimer une tâche, un lien ou un projet le marque (deleted_at) au lieu de l'effacer.
-- Restaurable pendant 30 jours depuis les réglages du projet.

alter table public.tasks add column if not exists deleted_at timestamptz;
alter table public.links add column if not exists deleted_at timestamptz;
alter table public.groups add column if not exists deleted_at timestamptz;
alter table public.tasks add column if not exists deleted_by uuid references auth.users (id) on delete set null;
alter table public.links add column if not exists deleted_by uuid references auth.users (id) on delete set null;
alter table public.groups add column if not exists deleted_by uuid references auth.users (id) on delete set null;

-- Un projet à la corbeille n'est plus accessible (sauf pour le restaurer).
create or replace function public.is_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members m join groups g on g.id = m.group_id
    where m.group_id = gid and m.user_id = auth.uid() and g.deleted_at is null
  );
$$;
create or replace function public.can_write(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members m join groups g on g.id = m.group_id
    where m.group_id = gid and m.user_id = auth.uid() and m.role in ('admin', 'member') and g.deleted_at is null
  );
$$;
create or replace function public.is_admin(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members m join groups g on g.id = m.group_id
    where m.group_id = gid and m.user_id = auth.uid() and m.role = 'admin' and g.deleted_at is null
  );
$$;

create or replace function public.list_trash(gid uuid)
returns table (kind text, id uuid, title text, deleted_at timestamptz, deleted_by uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(gid) then raise exception 'accès refusé'; end if;
  return query
    select 'task'::text, t.id, t.title, t.deleted_at, t.deleted_by from tasks t where t.group_id = gid and t.deleted_at > now() - interval '30 days'
    union all
    select 'link'::text, l.id, l.title, l.deleted_at, l.deleted_by from links l where l.group_id = gid and l.deleted_at > now() - interval '30 days'
    order by 4 desc;
end;
$$;

create or replace function public.restore_item(item_kind text, item_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if item_kind = 'task' then
    select group_id into gid from tasks where id = item_id;
    if gid is null or not can_write(gid) then raise exception 'accès refusé'; end if;
    update tasks set deleted_at = null, deleted_by = null where id = item_id;
  elsif item_kind = 'link' then
    select group_id into gid from links where id = item_id;
    if gid is null or not can_write(gid) then raise exception 'accès refusé'; end if;
    update links set deleted_at = null, deleted_by = null where id = item_id;
  else
    raise exception 'type inconnu';
  end if;
end;
$$;

-- Mettre un projet à la corbeille (admin seulement).
create or replace function public.trash_group(gid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin(gid) then raise exception 'accès refusé'; end if;
  update groups set deleted_at = now(), deleted_by = auth.uid() where id = gid;
end;
$$;

create or replace function public.list_deleted_groups()
returns table (id uuid, name text, deleted_at timestamptz)
language plpgsql security definer set search_path = public as $$
begin
  return query
    select g.id, g.name, g.deleted_at from groups g join group_members m on m.group_id = g.id
    where m.user_id = auth.uid() and m.role = 'admin' and g.deleted_at > now() - interval '30 days'
    order by g.deleted_at desc;
end;
$$;

create or replace function public.restore_group(gid uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from group_members where group_id = gid and user_id = auth.uid() and role = 'admin') then
    raise exception 'accès refusé';
  end if;
  update groups set deleted_at = null, deleted_by = null where id = gid;
end;
$$;

revoke execute on function public.list_trash(uuid) from public, anon;
revoke execute on function public.restore_item(text, uuid) from public, anon;
revoke execute on function public.trash_group(uuid) from public, anon;
revoke execute on function public.list_deleted_groups() from public, anon;
revoke execute on function public.restore_group(uuid) from public, anon;
grant execute on function public.list_trash(uuid) to authenticated;
grant execute on function public.restore_item(text, uuid) to authenticated;
grant execute on function public.trash_group(uuid) to authenticated;
grant execute on function public.list_deleted_groups() to authenticated;
grant execute on function public.restore_group(uuid) to authenticated;
