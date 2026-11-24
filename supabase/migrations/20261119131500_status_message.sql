-- Statut perso façon Teams : un message et une heure où il s'efface. Ajouts seulement.
alter table public.profiles add column if not exists status_text text not null default '';
alter table public.profiles add column if not exists status_until timestamptz;
alter table public.profiles add column if not exists status_color text;
