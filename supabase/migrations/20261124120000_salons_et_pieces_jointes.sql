-- Salons modifiables (renommer, supprimer vers la corbeille) et pièces jointes dans le chat.
-- Ajout seulement : un salon supprimé garde ses messages et se restaure depuis la corbeille.

alter table public.channels add column if not exists deleted_at timestamptz;
alter table public.channels add column if not exists deleted_by uuid references auth.users (id) on delete set null;

-- Les admins renomment et suppriment les salons (la suppression est un simple marquage).
drop policy if exists "salons modifiés" on public.channels;
create policy "salons modifiés" on public.channels for update
  using (public.is_admin(group_id)) with check (public.is_admin(group_id));

-- Pièces jointes : [{ path, name, size, mime }] ; fichiers dans le stockage « documents », dossier du projet.
alter table public.messages add column if not exists attachments jsonb;
-- Un message peut n'être qu'une pièce jointe (texte vide).
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check (char_length(body) <= 4000);

-- Corbeille : les salons s'ajoutent au reste.
create or replace function public.list_trash(gid uuid)
returns table (kind text, id uuid, title text, deleted_at timestamptz, deleted_by uuid)
language plpgsql security definer set search_path = public as $$
begin
  if not is_member(gid) then raise exception 'accès refusé'; end if;
  return query
    select 'task'::text, t.id, t.title, t.deleted_at, t.deleted_by from tasks t where t.group_id = gid and t.deleted_at > now() - interval '30 days'
    union all
    select 'link'::text, l.id, l.title, l.deleted_at, l.deleted_by from links l where l.group_id = gid and l.deleted_at > now() - interval '30 days'
    union all
    select 'document'::text, d.id, d.name, d.deleted_at, d.deleted_by from documents d where d.group_id = gid and d.deleted_at > now() - interval '30 days'
    union all
    select 'note'::text, n.id, n.title, n.deleted_at, n.deleted_by from notes n where n.group_id = gid and n.deleted_at > now() - interval '30 days'
    union all
    select 'channel'::text, c.id, '#' || c.name, c.deleted_at, c.deleted_by from channels c where c.group_id = gid and c.deleted_at > now() - interval '30 days'
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
  elsif item_kind = 'document' then
    select group_id into gid from documents where id = item_id;
    if gid is null or not can_write(gid) then raise exception 'accès refusé'; end if;
    update documents set deleted_at = null, deleted_by = null where id = item_id;
  elsif item_kind = 'note' then
    select group_id into gid from notes where id = item_id;
    if gid is null or not can_write(gid) then raise exception 'accès refusé'; end if;
    update notes set deleted_at = null, deleted_by = null where id = item_id;
  elsif item_kind = 'channel' then
    select group_id into gid from channels where id = item_id;
    if gid is null or not is_admin(gid) then raise exception 'accès refusé'; end if;
    update channels set deleted_at = null, deleted_by = null where id = item_id;
  else
    raise exception 'type inconnu';
  end if;
end;
$$;

-- Compte Discord de chaque personne (relié une fois, dans une petite fenêtre Discord).
-- Ses messages écrits sur Discord sont rangés à son nom dans Kollab.
create table if not exists public.discord_accounts (
  user_id uuid primary key references auth.users (id) on delete cascade,
  discord_id text not null unique,
  discord_name text not null,
  discord_avatar text,
  linked_at timestamptz not null default now()
);
alter table public.discord_accounts enable row level security;
drop policy if exists "mon compte discord" on public.discord_accounts;
create policy "mon compte discord" on public.discord_accounts for select using (user_id = auth.uid());
drop policy if exists "je délie mon compte discord" on public.discord_accounts;
create policy "je délie mon compte discord" on public.discord_accounts for delete using (user_id = auth.uid());

create or replace function public.discord_member(discord_id text, gid uuid)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select coalesce(
    (select a.user_id from public.discord_accounts a
       join public.group_members m on m.user_id = a.user_id and m.group_id = gid
     where a.discord_id = discord_member.discord_id limit 1),
    (select i.user_id from auth.identities i
       join public.group_members m on m.user_id = i.user_id and m.group_id = gid
     where i.provider = 'discord' and i.provider_id = discord_member.discord_id limit 1)
  );
$$;
revoke execute on function public.discord_member(text, uuid) from public, anon, authenticated;
