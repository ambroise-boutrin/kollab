-- Emails : journal des envois, « Pendant ton absence » et réglage pour le couper. Ajouts seulement.

-- Journal : chaque email envoyé ou raté, pour vérifier que tout part bien.
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  to_email text not null,
  user_id uuid references auth.users (id) on delete set null,
  group_id uuid references public.groups (id) on delete set null,
  key text,
  status text not null check (status in ('sent', 'failed')),
  provider_id text,
  error text,
  created_at timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
create index if not exists email_log_key_idx on public.email_log (key) where key is not null;
-- Lisible et modifiable seulement par les fonctions serveur (clé service) : aucune politique.
alter table public.email_log enable row level security;

-- Une notification ne part qu'une fois par email.
alter table public.notifications add column if not exists emailed_at timestamptz;
create index if not exists notifications_to_email_idx on public.notifications (created_at) where read_at is null and emailed_at is null;

-- « Pendant ton absence » par email : activé par défaut, coupable dans Réglages.
alter table public.profiles add column if not exists missed_email boolean not null default true;

-- Tâche planifiée toutes les 30 min, avec sa clé partagée.
insert into public.app_secrets (name, value)
values ('notify_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create or replace function public.send_missed_emails()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare k text;
begin
  select value into k from public.app_secrets where name = 'notify_key';
  perform net.http_post(
    url := 'https://wwotsleenolxjduzxvzk.supabase.co/functions/v1/notify-email',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-notify-key', k),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function public.send_missed_emails() from public, anon, authenticated;

select cron.schedule('kollab-missed-emails', '*/30 * * * *', 'select public.send_missed_emails()');
