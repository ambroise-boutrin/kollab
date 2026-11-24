-- Salons Discord reliés au chat, dans les deux sens. Ajout seulement : rien n'est supprimé ni renommé.

-- Serveur Discord du projet (relié une seule fois, par un admin). Lisible par les membres, aucun secret dedans.
create table if not exists public.group_discord (
  group_id uuid primary key references public.groups (id) on delete cascade,
  guild_id text not null,
  guild_name text not null,
  guild_icon text,
  linked_by uuid references auth.users (id) on delete set null,
  linked_at timestamptz not null default now()
);
alter table public.group_discord enable row level security;
create policy "serveur discord lisible" on public.group_discord for select using (public.is_member(group_id));

-- Salon Kollab ↔ salon Discord. Le jeton du webhook est un secret : aucune lecture côté navigateur,
-- les membres passent par la fonction discord_links.
create table if not exists public.channel_discord (
  channel_id uuid primary key references public.channels (id) on delete cascade,
  group_id uuid not null references public.groups (id) on delete cascade,
  discord_channel_id text not null unique,
  discord_channel_name text not null,
  webhook_id text not null,
  webhook_token text not null,
  -- Dernier message Discord déjà repris dans Kollab (identifiant Discord, croissant).
  last_message_id text,
  linked_by uuid references auth.users (id) on delete set null,
  linked_at timestamptz not null default now()
);
alter table public.channel_discord enable row level security;
revoke all on public.channel_discord from anon, authenticated;

create or replace function public.discord_links(gid uuid)
returns table (channel_id uuid, discord_channel_id text, discord_channel_name text)
language sql stable security definer set search_path = public as $$
  select c.channel_id, c.discord_channel_id, c.discord_channel_name
  from channel_discord c where c.group_id = gid and public.is_member(gid);
$$;
revoke execute on function public.discord_links(uuid) from anon;

-- Messages venus de Discord : auteur Discord (nom, avatar) et identifiant du message d'origine.
-- Si l'auteur a relié son compte Discord à Kollab, le message est rangé à son nom (author_id).
alter table public.messages add column if not exists discord_message_id text;
alter table public.messages add column if not exists discord_author jsonb;
create unique index if not exists messages_discord_id_idx on public.messages (discord_message_id) where discord_message_id is not null;
-- Un message Discord d'une personne sans compte Kollab n'a pas d'auteur Kollab.
alter table public.messages alter column author_id drop not null;

-- Seul le serveur écrit l'origine Discord d'un message : personne ne peut se faire passer pour un compte Discord.
create or replace function public.guard_message_discord()
returns trigger language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      new.discord_author := null;
      new.discord_message_id := null;
    else
      new.discord_author := old.discord_author;
      new.discord_message_id := old.discord_message_id;
    end if;
  end if;
  return new;
end;
$$;
create or replace trigger messages_guard_discord before insert or update on public.messages
  for each row execute function public.guard_message_discord();

-- Compte Kollab d'une personne Discord (si elle a relié Discord à Kollab et fait partie du projet). Serveur seulement.
create or replace function public.discord_member(discord_id text, gid uuid)
returns uuid language sql stable security definer set search_path = public, auth as $$
  select i.user_id from auth.identities i
  join public.group_members m on m.user_id = i.user_id and m.group_id = gid
  where i.provider = 'discord' and i.provider_id = discord_id
  limit 1;
$$;
revoke execute on function public.discord_member(text, uuid) from public, anon, authenticated;

-- Les mentions venues de Discord préviennent aussi (auteur sans compte Kollab).
create or replace function public.notify_mentions()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  low text := lower(new.body);
  salon text;
  who text := coalesce(new.discord_author ->> 'name', (select name from profiles where id = new.author_id), 'Quelqu''un');
begin
  if position('@' in new.body) = 0 then return null; end if;
  select name into salon from channels where id = new.channel_id;
  insert into notifications (user_id, group_id, actor_id, kind, title, body, link)
  select p.id, new.group_id, new.author_id, 'mention', who || ' t''a mentionné dans #' || coalesce(salon, 'chat'),
         left(new.body, 140), '/chat?salon=' || new.channel_id
  from group_members m join profiles p on p.id = m.user_id
  where m.group_id = new.group_id and p.id is distinct from new.author_id
    and (low ~ ('@' || regexp_replace(lower(p.name), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^[:alnum:]])')
      or low ~ ('@' || regexp_replace(lower(split_part(p.name, ' ', 1)), '([.^$*+?()\[\]{}|\\])', '\\\1', 'g') || '($|[^[:alnum:]])'));
  return null;
end;
$$;

-- Clé partagée entre la base et les fonctions Discord.
insert into public.app_secrets (name, value)
values ('discord_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- Kollab → Discord : chaque message d'un salon relié (nouveau, modifié ou supprimé) part vers la fonction discord.
-- Les messages venus de Discord (discord_author) ne repartent pas.
create or replace function public.relay_to_discord()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare k text; op text;
begin
  if new.discord_author is not null then return null; end if;
  if tg_op = 'INSERT' then
    if new.discord_message_id is not null then return null; end if;
    op := 'insert';
  else
    if new.discord_message_id is null then return null; end if;
    if new.deleted_at is not null and old.deleted_at is null then op := 'delete';
    elsif new.body is distinct from old.body and new.deleted_at is null then op := 'update';
    else return null;
    end if;
  end if;
  if not exists (select 1 from channel_discord where channel_id = new.channel_id) then return null; end if;
  select value into k from app_secrets where name = 'discord_key';
  perform net.http_post(
    url := 'https://wwotsleenolxjduzxvzk.supabase.co/functions/v1/discord/relay',
    body := jsonb_build_object('messageId', new.id, 'op', op),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-discord-key', k),
    timeout_milliseconds := 10000
  );
  return null;
end;
$$;
revoke execute on function public.relay_to_discord() from public, anon, authenticated;
create or replace trigger messages_relay_discord after insert or update of body, deleted_at on public.messages
  for each row execute function public.relay_to_discord();

-- Discord → Kollab : chaque minute, la fonction discord-poll lit les salons reliés pendant ~55 s.
-- Rien n'est appelé tant qu'aucun salon n'est relié.
create or replace function public.poll_discord()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare k text;
begin
  if not exists (select 1 from channel_discord) then return; end if;
  select value into k from app_secrets where name = 'discord_key';
  perform net.http_post(
    url := 'https://wwotsleenolxjduzxvzk.supabase.co/functions/v1/discord/poll',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-discord-key', k),
    timeout_milliseconds := 5000
  );
end;
$$;
revoke execute on function public.poll_discord() from public, anon, authenticated;
select cron.schedule('kollab-discord-poll', '* * * * *', 'select public.poll_discord()');

alter publication supabase_realtime add table public.group_discord;
