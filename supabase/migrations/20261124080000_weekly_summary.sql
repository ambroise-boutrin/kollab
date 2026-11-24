-- Résumé du lundi par email : on peut le couper dans Réglages, il part chaque lundi matin.
alter table public.profiles add column if not exists weekly_email boolean not null default true;

create extension if not exists pg_cron;

-- Clé partagée entre la tâche planifiée et la fonction weekly-summary.
insert into public.app_secrets (name, value)
values ('weekly_key', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

create or replace function public.send_weekly_summary()
returns void language plpgsql security definer set search_path = public, extensions as $$
declare k text;
begin
  select value into k from public.app_secrets where name = 'weekly_key';
  perform net.http_post(
    url := 'https://wwotsleenolxjduzxvzk.supabase.co/functions/v1/weekly-summary',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-weekly-key', k),
    timeout_milliseconds := 60000
  );
end;
$$;
revoke execute on function public.send_weekly_summary() from public, anon, authenticated;

-- Lundi 8 h à Paris (7 h UTC en hiver, 9 h en été).
select cron.schedule('kollab-weekly-summary', '0 7 * * 1', 'select public.send_weekly_summary()');
