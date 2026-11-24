-- Documents : un type (compte rendu, spec, rétro…) pour la couleur et les filtres, et l'épinglage d'équipe.
-- Additif uniquement : aucune donnée existante n'est modifiée (les anciens documents prennent le type « page »).
alter table public.notes add column if not exists kind text not null default 'page';
alter table public.notes add column if not exists pinned boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'notes_kind_check') then
    alter table public.notes add constraint notes_kind_check check (kind in ('page', 'cr', 'daily', 'spec', 'retro', 'cdc', 'idee'));
  end if;
end $$;
