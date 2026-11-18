-- Notifications sur téléphone (Web Push). Ajouts seulement.
create extension if not exists pg_net with schema extensions;

-- Un abonnement par appareil. On ne supprime jamais : on désactive.
create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  p256dh text not null,
  auth text not null,
  user_agent text not null default '',
  disabled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions (user_id) where disabled_at is null;
alter table public.push_subscriptions enable row level security;
create policy "push lisible" on public.push_subscriptions for select using (user_id = auth.uid());
create policy "push ajout" on public.push_subscriptions for insert with check (user_id = auth.uid());
create policy "push modif" on public.push_subscriptions for update using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Clés internes (ex. clés VAPID), lisibles seulement par le serveur : aucune règle d'accès.
create table if not exists public.app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

alter table public.notifications add column if not exists pushed_at timestamptz;

-- Chaque nouvelle notification part vers la fonction send-push, sans jamais bloquer l'insertion.
create or replace function public.push_notification()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
begin
  begin
    perform net.http_post(
      url := 'https://wwotsleenolxjduzxvzk.supabase.co/functions/v1/send-push',
      body := jsonb_build_object('id', new.id),
      headers := '{"Content-Type": "application/json"}'::jsonb
    );
  exception when others then
    null;
  end;
  return new;
end;
$$;
revoke execute on function public.push_notification() from public, anon, authenticated;

create trigger notifications_push after insert on public.notifications
  for each row execute function public.push_notification();
