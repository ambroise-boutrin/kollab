-- Jeton GitHub chiffré dans Supabase Vault, jamais lisible depuis l'app. Ajout seulement.
-- L'app n'a plus accès qu'à la fonction « github » (edge function), qui lit le jeton côté serveur.

create table if not exists public.github_secrets (
  user_id uuid primary key,
  oauth_secret uuid,          -- jeton de l'ancienne connexion GitHub (accès complet), dans vault.secrets
  app_secret uuid,            -- jeton de l'appli GitHub Kollab (accès par dépôt)
  app_refresh_secret uuid,
  app_expires_at timestamptz,
  login text,
  updated_at timestamptz not null default now()
);
alter table public.github_secrets enable row level security;
-- Aucune règle d'accès : ni anon ni les comptes connectés ne lisent cette table.
revoke all on public.github_secrets from anon, authenticated;

-- Range une valeur dans Vault (nouvelle ou remplacée) et renvoie son identifiant.
create or replace function public.github_vault_put(cur uuid, val text)
returns uuid language plpgsql security definer set search_path = '' as $$
begin
  if val is null then return cur; end if;
  if cur is null then return vault.create_secret(val); end if;
  perform vault.update_secret(cur, val);
  return cur;
end $$;

-- Enregistre un jeton pour une personne. kind = 'oauth' ou 'app'. Un jeton vide l'oublie.
create or replace function public.github_save(uid uuid, kind text, token text, refresh text default null, expires timestamptz default null, gh_login text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare r public.github_secrets;
begin
  insert into public.github_secrets (user_id) values (uid) on conflict (user_id) do nothing;
  select * into r from public.github_secrets where user_id = uid for update;
  if kind = 'app' then
    update public.github_secrets set
      app_secret = public.github_vault_put(r.app_secret, token),
      app_refresh_secret = public.github_vault_put(r.app_refresh_secret, case when token = '' then '' else refresh end),
      app_expires_at = expires,
      -- Appli GitHub reliée : l'ancien jeton à accès complet ne sert plus, on l'oublie.
      oauth_secret = case when token <> '' and r.oauth_secret is not null then public.github_vault_put(r.oauth_secret, '') else r.oauth_secret end,
      login = coalesce(gh_login, r.login),
      updated_at = now()
    where user_id = uid;
  else
    update public.github_secrets set
      oauth_secret = public.github_vault_put(r.oauth_secret, token),
      login = coalesce(gh_login, r.login),
      updated_at = now()
    where user_id = uid;
  end if;
end $$;

-- Lecture déchiffrée, pour la fonction serveur seulement.
create or replace function public.github_read(uid uuid)
returns table (oauth text, app text, app_refresh text, app_expires_at timestamptz, login text, updated_at timestamptz)
language sql security definer set search_path = '' stable as $$
  select
    nullif((select decrypted_secret from vault.decrypted_secrets where id = g.oauth_secret), ''),
    nullif((select decrypted_secret from vault.decrypted_secrets where id = g.app_secret), ''),
    nullif((select decrypted_secret from vault.decrypted_secrets where id = g.app_refresh_secret), ''),
    g.app_expires_at, g.login, g.updated_at
  from public.github_secrets g where g.user_id = uid
$$;

-- Réglages de l'appli GitHub Kollab (identifiant, secret, nom), rangés dans Vault à sa création.
create or replace function public.github_app_config()
returns jsonb language sql security definer set search_path = '' stable as $$
  select decrypted_secret::jsonb from vault.decrypted_secrets where name = 'github_app' order by created_at desc limit 1
$$;
create or replace function public.github_app_config_set(cfg jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare cur uuid;
begin
  select id into cur from vault.secrets where name = 'github_app' order by created_at desc limit 1;
  if cur is null then perform vault.create_secret(cfg::text, 'github_app');
  else perform vault.update_secret(cur, cfg::text); end if;
end $$;

revoke all on function public.github_vault_put(uuid, text) from public, anon, authenticated;
revoke all on function public.github_save(uuid, text, text, text, timestamptz, text) from public, anon, authenticated;
revoke all on function public.github_read(uuid) from public, anon, authenticated;
revoke all on function public.github_app_config() from public, anon, authenticated;
revoke all on function public.github_app_config_set(jsonb) from public, anon, authenticated;
grant execute on function public.github_save(uuid, text, text, text, timestamptz, text) to service_role;
grant execute on function public.github_read(uuid) to service_role;
grant execute on function public.github_app_config() to service_role;
grant execute on function public.github_app_config_set(jsonb) to service_role;

-- Les anciennes versions de l'app écrivent encore le jeton en clair dans github_tokens :
-- on le chiffre au passage et la table ne garde qu'une valeur vide.
create or replace function public.github_tokens_encrypt()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.token, '') <> '' then
    -- Appli GitHub déjà reliée : on n'y remet pas un jeton à accès complet.
    if not exists (select 1 from public.github_secrets where user_id = new.user_id and app_secret is not null
                   and (select decrypted_secret from vault.decrypted_secrets where id = app_secret) <> '') then
      perform public.github_save(new.user_id, 'oauth', new.token);
    end if;
    new.token := '';
  end if;
  return new;
end $$;
revoke all on function public.github_tokens_encrypt() from public, anon, authenticated;
create or replace trigger github_tokens_encrypt before insert or update on public.github_tokens
  for each row execute function public.github_tokens_encrypt();

-- Jetons déjà enregistrés : chiffrés maintenant, sans rien perdre.
update public.github_tokens set token = token where token <> '';

-- Clés de la fonction « github » : signature de la connexion, code de création de l'appli.
insert into public.app_secrets (name, value) values ('github_key', encode(extensions.gen_random_bytes(32), 'hex')) on conflict do nothing;
insert into public.app_secrets (name, value) values ('github_setup', encode(extensions.gen_random_bytes(16), 'hex')) on conflict do nothing;
