-- Messages Discord rangés du côté de la personne qui a relié son compte.
-- L'auteur reste figé pour les utilisateurs ; seul le serveur (fonction discord) peut l'attribuer.
create or replace function public.guard_message_update()
returns trigger language plpgsql set search_path = public as $$
begin
  new.id := old.id;
  new.group_id := old.group_id;
  new.channel_id := old.channel_id;
  if auth.uid() is not null then new.author_id := old.author_id; end if;
  new.created_at := old.created_at;
  if new.body is distinct from old.body then new.edited_at := now(); end if;
  return new;
end;
$$;

-- Rattrapage : les anciens messages Discord des comptes déjà reliés.
update public.messages m set author_id = a.user_id
from public.discord_accounts a
where m.author_id is null
  and m.discord_author->>'id' = a.discord_id
  and exists (select 1 from public.group_members g where g.group_id = m.group_id and g.user_id = a.user_id);
