-- Documents texte écrits à plusieurs : l'état Yjs est gardé en base (base64), le texte brut sert à l'aperçu et à la recherche.

create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null default 'Sans titre' check (char_length(title) between 1 and 200),
  ystate text not null default '',
  preview text not null default '' check (char_length(preview) <= 2000),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index if not exists notes_group_idx on public.notes (group_id, updated_at desc);
alter table public.notes enable row level security;
create policy "notes lisibles" on public.notes for select using (public.is_member(group_id));
create policy "notes créées" on public.notes for insert with check (public.can_write(group_id) and created_by = auth.uid());
create policy "notes modifiées" on public.notes for update using (public.can_write(group_id)) with check (public.can_write(group_id));

create or replace function public.guard_note_update()
returns trigger language plpgsql set search_path = public as $$
begin
  new.id := old.id;
  new.group_id := old.group_id;
  new.created_by := old.created_by;
  new.created_at := old.created_at;
  if new.ystate is distinct from old.ystate or new.title is distinct from old.title then
    new.updated_at := now();
    new.updated_by := auth.uid();
  end if;
  return new;
end;
$$;
create trigger notes_guard_update before update on public.notes for each row execute function public.guard_note_update();
revoke execute on function public.guard_note_update() from public, anon, authenticated;

-- Corbeille : les notes s'ajoutent.
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
  else
    raise exception 'type inconnu';
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notes') then
    alter publication supabase_realtime add table public.notes;
  end if;
end $$;
