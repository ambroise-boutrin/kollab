-- Un membre propose son rôle dans l'équipe ; un admin le valide ou le refuse.
alter table public.group_members add column if not exists title_request text;

create or replace function public.request_member_title(gid uuid, new_title text)
returns void language plpgsql security definer set search_path = public as $$
declare t text := nullif(left(btrim(coalesce(new_title, '')), 60), '');
begin
  if auth.uid() is null or not public.is_member(gid) then raise exception 'Réservé aux membres du projet'; end if;
  update group_members set title_request = t where group_id = gid and user_id = auth.uid();
  if t is null then return; end if;
  delete from notifications where group_id = gid and actor_id = auth.uid() and kind = 'joined' and data ->> 'titleRequest' is not null and read_at is null;
  insert into notifications (user_id, group_id, actor_id, kind, title, body, link, data)
  select m.user_id, gid, auth.uid(), 'joined', actor_name() || ' propose son rôle : ' || t, 'À valider dans Équipe', '/equipe', jsonb_build_object('titleRequest', t)
  from group_members m where m.group_id = gid and m.role = 'admin' and m.user_id <> auth.uid();
end;
$$;
revoke execute on function public.request_member_title(uuid, text) from public, anon;
grant execute on function public.request_member_title(uuid, text) to authenticated;

-- Attribuer un rôle efface la proposition en attente ; un admin peut aussi refuser (titre inchangé).
create or replace function public.set_member_title(gid uuid, member uuid, new_title text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(gid) then raise exception 'Seul un admin du projet peut attribuer les rôles'; end if;
  update public.group_members set title = left(coalesce(new_title, ''), 60), title_request = null where group_id = gid and user_id = member;
end
$$;

create or replace function public.decline_member_title(gid uuid, member uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(gid) then raise exception 'Seul un admin du projet peut refuser une proposition'; end if;
  update public.group_members set title_request = null where group_id = gid and user_id = member;
end
$$;
revoke execute on function public.decline_member_title(uuid, uuid) from public, anon;
grant execute on function public.decline_member_title(uuid, uuid) to authenticated;
