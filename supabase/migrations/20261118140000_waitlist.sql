-- Liste d'attente du site vitrine : emails des personnes qui veulent être prévenues
-- (app de bureau, nouveautés). Le site peut seulement AJOUTER une adresse, jamais lire la liste.
create table if not exists public.waitlist (
  id bigint generated always as identity primary key,
  email text not null unique check (email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' and length(email) <= 254),
  source text not null default 'site' check (length(source) <= 40),
  created_at timestamptz not null default now()
);

alter table public.waitlist enable row level security;

drop policy if exists "waitlist_insert_anyone" on public.waitlist;
create policy "waitlist_insert_anyone" on public.waitlist
  for insert to anon, authenticated
  with check (true);

-- Aucune politique SELECT/UPDATE/DELETE : seule la clé de service (tableau de bord Supabase) lit la liste.
revoke all on public.waitlist from anon, authenticated;
grant insert (email, source) on public.waitlist to anon, authenticated;
