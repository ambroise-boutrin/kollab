-- Jeton GitHub gardé sur le compte (et pas seulement sur l'appareil), lisible par son seul propriétaire. Ajout seulement.
create table if not exists public.github_tokens (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  token text not null,
  updated_at timestamptz not null default now()
);
alter table public.github_tokens enable row level security;
create policy "jeton github lu par son propriétaire" on public.github_tokens for select to authenticated using (user_id = auth.uid());
create policy "jeton github ajouté par son propriétaire" on public.github_tokens for insert to authenticated with check (user_id = auth.uid());
create policy "jeton github remplacé par son propriétaire" on public.github_tokens for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "jeton github retiré par son propriétaire" on public.github_tokens for delete to authenticated using (user_id = auth.uid());
revoke all on public.github_tokens from anon;
