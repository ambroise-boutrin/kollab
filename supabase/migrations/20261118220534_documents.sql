-- Espace documents : PDF, images et fichiers du projet, lisibles par les membres.
-- Les fichiers ne sont jamais effacés : supprimer met le document à la corbeille.

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 200),
  path text not null unique,
  mime text not null default 'application/octet-stream',
  size bigint not null default 0,
  uploaded_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  deleted_by uuid references auth.users (id) on delete set null
);
create index if not exists documents_group_idx on public.documents (group_id, created_at desc);
alter table public.documents enable row level security;

create policy "documents lisibles" on public.documents for select using (public.is_member(group_id));
create policy "documents ajoutés" on public.documents for insert with check (
  public.can_write(group_id) and uploaded_by = auth.uid() and path like group_id::text || '/%'
);
create policy "documents modifiés" on public.documents for update using (public.can_write(group_id)) with check (public.can_write(group_id));

-- Seuls le nom et la corbeille changent.
create or replace function public.guard_document_update()
returns trigger language plpgsql set search_path = public as $$
begin
  new.id := old.id;
  new.group_id := old.group_id;
  new.path := old.path;
  new.mime := old.mime;
  new.size := old.size;
  new.uploaded_by := old.uploaded_by;
  new.created_at := old.created_at;
  return new;
end;
$$;
create trigger documents_guard_update before update on public.documents for each row execute function public.guard_document_update();
revoke execute on function public.guard_document_update() from public, anon, authenticated;

-- Fichiers : dossier = id du projet.
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 26214400)
on conflict (id) do nothing;

create policy "documents du projet lus" on storage.objects for select to authenticated
  using (bucket_id = 'documents' and public.is_member(((storage.foldername(name))[1])::uuid));
create policy "documents du projet envoyés" on storage.objects for insert to authenticated
  with check (bucket_id = 'documents' and public.can_write(((storage.foldername(name))[1])::uuid));

-- Corbeille : les documents s'ajoutent aux tâches et liens.
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
  else
    raise exception 'type inconnu';
  end if;
end;
$$;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'documents') then
    alter publication supabase_realtime add table public.documents;
  end if;
end $$;
