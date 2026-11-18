-- Création de projet préconfigurée : le modèle choisi fixe la liste des salons.
-- Sans liste, on garde les salons par défaut.
drop function if exists public.create_group(text);

create function public.create_group(group_name text, channel_names text[] default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  gid uuid;
  names text[] := coalesce(channel_names, array['général', 'revues-de-code', 'sprint']);
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;
  if length(trim(group_name)) = 0 or length(group_name) > 80 then raise exception 'nom de projet invalide'; end if;
  if cardinality(names) = 0 or cardinality(names) > 12 then names := array['général']; end if;
  insert into groups (name, created_by) values (trim(group_name), auth.uid()) returning id into gid;
  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), 'admin');
  insert into channels (group_id, name)
    select gid, left(trim(n), 40) from unnest(names) with ordinality as t(n, i)
    where length(trim(n)) > 0 order by i;
  return gid;
end;
$$;

revoke execute on function public.create_group(text, text[]) from public, anon;
grant execute on function public.create_group(text, text[]) to authenticated;

-- Un admin peut supprimer son projet (tâches, salons, messages partent en cascade).
create policy "groupe supprimable par admin" on public.groups for delete using (public.is_admin(id));
