-- Retours des testeurs : échéance sur les tâches et fil de commentaires.
alter table public.tasks add column if not exists due_on date;

create table if not exists public.task_comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null check (length(body) between 1 and 4000),
  created_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists task_comments_task_idx on public.task_comments (task_id, created_at);
alter table public.task_comments enable row level security;
create policy "commentaires lisibles" on public.task_comments for select using (is_member(group_id));
create policy "commentaires écrits" on public.task_comments for insert with check (
  can_write(group_id) and author_id = auth.uid()
  and exists (select 1 from tasks t where t.id = task_id and t.group_id = task_comments.group_id)
);
create policy "commentaires modifiés par leur auteur" on public.task_comments for update using (author_id = auth.uid() and can_write(group_id));

-- Mention dans un commentaire : même règle que le chat (« @Prénom » ou « @Prénom Nom »).
create or replace function public.notify_comment_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  low text := lower(new.body);
  titre text;
begin
  if position('@' in new.body) = 0 then return null; end if;
  select title into titre from tasks where id = new.task_id;
  insert into notifications (user_id, group_id, actor_id, kind, title, body, link)
  select p.id, new.group_id, new.author_id, 'mention', actor_name() || ' t''a mentionné sur « ' || left(coalesce(titre, 'une tâche'), 60) || ' »',
         left(new.body, 140), '/tableau?tache=' || new.task_id
  from group_members m join profiles p on p.id = m.user_id
  where m.group_id = new.group_id and p.id <> new.author_id
    and (low ~ ('@' || regexp_replace(lower(p.name), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^[:alnum:]])')
      or low ~ ('@' || regexp_replace(lower(split_part(p.name, ' ', 1)), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^[:alnum:]])'));
  return null;
end;
$$;
revoke execute on function public.notify_comment_mentions() from public, anon, authenticated;
create trigger task_comments_notify_mentions after insert on public.task_comments
  for each row execute function public.notify_comment_mentions();

alter publication supabase_realtime add table public.task_comments;
