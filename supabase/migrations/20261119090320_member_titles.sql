-- Rôle dans l'équipe (Product Owner, Dév front…) propre à chaque projet, choisi par un admin.
alter table public.group_members add column if not exists title text not null default '';
update public.group_members gm set title = coalesce(p.title, '') from public.profiles p where p.id = gm.user_id and gm.title = '';

create or replace function public.set_member_title(gid uuid, member uuid, new_title text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(gid) then raise exception 'Seul un admin du projet peut attribuer les rôles'; end if;
  update public.group_members set title = left(coalesce(new_title, ''), 60) where group_id = gid and user_id = member;
end
$$;
revoke all on function public.set_member_title(uuid, uuid, text) from public, anon;
grant execute on function public.set_member_title(uuid, uuid, text) to authenticated;

-- L'historique note aussi la mise à la corbeille des documents texte.
create or replace trigger activity_notes after insert or update of title, deleted_at on public.notes for each row execute function public.log_activity();
