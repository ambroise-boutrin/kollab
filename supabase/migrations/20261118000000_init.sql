-- Kollab : schéma initial (profils, groupes, tâches, chat, liens).
-- Chaque table est protégée par RLS : on ne voit que les données de ses groupes,
-- et les invités (role = 'guest') sont en lecture seule.


-- Profils -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Nouveau membre',
  color text not null default '#5546E0',
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1),
      'Nouveau membre'
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Groupes -------------------------------------------------------------------
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  invite_code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10)),
  discord_webhook_set boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('admin', 'member', 'guest')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

-- Le webhook Discord est un secret : seule la fonction serveur le lit.
create table public.group_secrets (
  group_id uuid primary key references public.groups (id) on delete cascade,
  discord_webhook text
);

create or replace function public.is_member(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from group_members where group_id = gid and user_id = auth.uid());
$$;

create or replace function public.can_write(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members
    where group_id = gid and user_id = auth.uid() and role in ('admin', 'member')
  );
$$;

create or replace function public.is_admin(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members where group_id = gid and user_id = auth.uid() and role = 'admin'
  );
$$;

-- Tâches --------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  description text not null default '',
  status text not null default 'todo' check (status in ('todo', 'doing', 'review', 'done')),
  kind text not null default 'feature' check (kind in ('feature', 'bug', 'research')),
  points int check (points >= 0),
  assignee_id uuid references auth.users (id) on delete set null,
  pr_url text,
  position double precision not null default 0,
  created_at timestamptz not null default now()
);
create index tasks_group_idx on public.tasks (group_id);

-- Chat ----------------------------------------------------------------------
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  created_at timestamptz not null default now()
);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  channel_id uuid not null references public.channels (id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  body text not null check (char_length(body) between 1 and 4000),
  created_at timestamptz not null default now()
);
create index messages_channel_idx on public.messages (channel_id, created_at);

-- Liens importants ----------------------------------------------------------
create table public.links (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  title text not null,
  url text not null check (url ~* '^https?://'),
  created_at timestamptz not null default now()
);

-- RLS -----------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_secrets enable row level security;
alter table public.tasks enable row level security;
alter table public.channels enable row level security;
alter table public.messages enable row level security;
alter table public.links enable row level security;

-- Un profil est visible par soi-même et par les membres de ses groupes.
create policy "profil lisible" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from group_members a join group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = profiles.id
  )
);
create policy "profil modifiable par soi" on public.profiles for update using (id = auth.uid());

create policy "groupe lisible" on public.groups for select using (public.is_member(id));
create policy "groupe modifiable par admin" on public.groups for update using (public.is_admin(id));

create policy "membres lisibles" on public.group_members for select using (public.is_member(group_id));
create policy "membres gérés par admin" on public.group_members for update using (public.is_admin(group_id));
create policy "quitter ou exclure" on public.group_members for delete
  using (user_id = auth.uid() or public.is_admin(group_id));
-- group_secrets : aucune policy, donc inaccessible depuis le client.

create policy "tâches lisibles" on public.tasks for select using (public.is_member(group_id));
create policy "tâches créées" on public.tasks for insert with check (public.can_write(group_id));
create policy "tâches modifiées" on public.tasks for update using (public.can_write(group_id));
create policy "tâches supprimées" on public.tasks for delete using (public.can_write(group_id));

create policy "salons lisibles" on public.channels for select using (public.is_member(group_id));
create policy "salons créés" on public.channels for insert with check (public.can_write(group_id));

create policy "messages lisibles" on public.messages for select using (public.is_member(group_id));
create policy "messages envoyés" on public.messages for insert with check (
  public.can_write(group_id) and author_id = auth.uid()
  and exists (select 1 from channels c where c.id = channel_id and c.group_id = messages.group_id)
);

create policy "liens lisibles" on public.links for select using (public.is_member(group_id));
create policy "liens ajoutés" on public.links for insert with check (public.can_write(group_id));
create policy "liens supprimés" on public.links for delete using (public.can_write(group_id));

-- Fonctions appelées par l'app ---------------------------------------------
create or replace function public.create_group(group_name text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  insert into groups (name, created_by) values (group_name, auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'admin');
  insert into channels (group_id, name) values (gid, 'général'), (gid, 'revues-de-code'), (gid, 'sprint');
  return gid;
end;
$$;

create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare gid uuid;
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  select id into gid from groups where invite_code = upper(trim(code));
  if gid is null then raise exception 'code d''invitation inconnu'; end if;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'member')
  on conflict do nothing;
  return gid;
end;
$$;

create or replace function public.set_discord_webhook(gid uuid, webhook text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(gid) then raise exception 'réservé aux admins'; end if;
  if webhook is not null and webhook !~ '^https://(discord\.com|discordapp\.com)/api/webhooks/' then
    raise exception 'lien de webhook Discord invalide';
  end if;
  insert into group_secrets (group_id, discord_webhook) values (gid, webhook)
  on conflict (group_id) do update set discord_webhook = excluded.discord_webhook;
  update groups set discord_webhook_set = webhook is not null where id = gid;
end;
$$;

revoke execute on function public.create_group(text) from anon;
revoke execute on function public.join_group(text) from anon;
revoke execute on function public.set_discord_webhook(uuid, text) from anon;

-- Temps réel ----------------------------------------------------------------
alter publication supabase_realtime add table public.tasks, public.messages;
