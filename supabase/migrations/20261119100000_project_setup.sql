-- Création de projet en étapes : couleur, rythme des sprints, rôle donné dès l'invitation. Ajouts seulement.
alter table public.groups add column if not exists color text;
alter table public.groups add column if not exists sprint_days int;
alter table public.groups add column if not exists daily_time text;
alter table public.invitations add column if not exists title text not null default '';

-- Rôle dans l'équipe prévu pour une invitation par email encore en attente.
create or replace function public.set_invite_title(gid uuid, email text, new_title text) returns void
language plpgsql security definer set search_path = public as $$
declare addr text := lower(trim(set_invite_title.email));
begin
  if not public.is_admin(gid) then raise exception 'réservé aux admins'; end if;
  update public.invitations i set title = left(coalesce(new_title, ''), 60)
  from public.email_invites e
  where e.group_id = gid and lower(e.email) = addr and e.cancelled_at is null and i.code = e.code and i.group_id = gid;
end
$$;
revoke all on function public.set_invite_title(uuid, text, text) from public, anon;
grant execute on function public.set_invite_title(uuid, text, text) to authenticated;

-- Rejoindre : le rôle prévu dans l'invitation est appliqué.
create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv invitations%rowtype;
  gid uuid;
  given_role text := 'member';
  given_title text := '';
  clean text := upper(trim(code));
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;

  select * into inv from invitations where invitations.code = clean for update;
  if found then
    if inv.expires_at < now() then raise exception 'cette invitation a expiré'; end if;
    if inv.max_uses is not null and inv.uses >= inv.max_uses then raise exception 'cette invitation a déjà été utilisée'; end if;
    gid := inv.group_id;
    given_role := inv.role;
    given_title := coalesce(inv.title, '');
    update invitations set uses = uses + 1 where id = inv.id;
  else
    select id into gid from groups where invite_code = clean;
    if gid is null then raise exception 'code d''invitation inconnu'; end if;
  end if;

  insert into group_members (group_id, user_id, role, title) values (gid, auth.uid(), given_role, given_title)
  on conflict do nothing;
  return gid;
end;
$$;
revoke execute on function public.join_group(text) from public, anon;
grant execute on function public.join_group(text) to authenticated;
