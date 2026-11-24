-- Présence façon Teams : Ne pas déranger et Invisible, avec une durée. Ajouts seulement.
-- L'ancienne colonne status (available/busy/away) reste remplie pour les apps déjà installées.
alter table public.profiles add column if not exists presence text;
alter table public.profiles add column if not exists presence_until timestamptz;
