-- Chat : réactions, modification et suppression de ses messages (suppression récupérable).

alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists deleted_at timestamptz;
alter table public.messages add column if not exists deleted_by uuid references auth.users (id) on delete set null;

-- Un message supprimé est seulement marqué (deleted_at) : il reste récupérable.
-- Seul l'auteur modifie son message, et seulement le texte.
create or replace function public.guard_message_update()
returns trigger language plpgsql set search_path = public as $$
begin
  new.id := old.id;
  new.group_id := old.group_id;
  new.channel_id := old.channel_id;
  new.author_id := old.author_id;
  new.created_at := old.created_at;
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  return new;
end;
$$;
create trigger messages_guard_update before update on public.messages for each row execute function public.guard_message_update();
create policy "messages modifiés par leur auteur" on public.messages for update using (author_id = auth.uid() and public.can_write(group_id));

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 16),
  created_at timestamptz not null default now(),
  primary key (message_id, user_id, emoji)
);
alter table public.message_reactions enable row level security;
create policy "réactions lisibles" on public.message_reactions for select using (public.is_member(group_id));
create policy "réactions ajoutées" on public.message_reactions for insert with check (
  user_id = auth.uid() and public.is_member(group_id)
  and exists (select 1 from public.messages m where m.id = message_id and m.group_id = message_reactions.group_id)
);

revoke execute on function public.guard_message_update() from public, anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions') then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
