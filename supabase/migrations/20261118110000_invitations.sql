-- Invitations avec droits : l'admin choisit le rôle donné à la personne invitée.
create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  code text not null unique default upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12)),
  role text not null default 'member' check (role in ('admin', 'member', 'guest')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  expires_at timestamptz not null default now() + interval '7 days',
  max_uses int check (max_uses is null or max_uses > 0),
  uses int not null default 0,
  created_at timestamptz not null default now()
);

alter table public.invitations enable row level security;
create policy "invitations vues par admin" on public.invitations for select using (public.is_admin(group_id));
create policy "invitations créées par admin" on public.invitations for insert with check (public.is_admin(group_id));
create policy "invitations révoquées par admin" on public.invitations for delete using (public.is_admin(group_id));

-- Rejoindre : d'abord une invitation nominative (avec son rôle), sinon le code général du groupe (membre).
create or replace function public.join_group(code text)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  inv invitations%rowtype;
  gid uuid;
  given_role text := 'member';
  clean text := upper(trim(code));
begin
  if auth.uid() is null then raise exception 'non connecté'; end if;

  select * into inv from invitations where invitations.code = clean for update;
  if found then
    if inv.expires_at < now() then raise exception 'cette invitation a expiré'; end if;
    if inv.max_uses is not null and inv.uses >= inv.max_uses then raise exception 'cette invitation a déjà été utilisée'; end if;
    gid := inv.group_id;
    given_role := inv.role;
    update invitations set uses = uses + 1 where id = inv.id;
  else
    select id into gid from groups where invite_code = clean;
    if gid is null then raise exception 'code d''invitation inconnu'; end if;
  end if;

  insert into group_members (group_id, user_id, role) values (gid, auth.uid(), given_role)
  on conflict do nothing;
  return gid;
end;
$$;

-- Un admin ne peut pas se retirer ses propres droits s'il est le dernier admin.
create or replace function public.set_member_role(gid uuid, member uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin(gid) then raise exception 'réservé aux admins'; end if;
  if new_role not in ('admin', 'member', 'guest') then raise exception 'rôle inconnu'; end if;
  if new_role <> 'admin' and (select count(*) from group_members where group_id = gid and role = 'admin' and user_id <> member) = 0 then
    raise exception 'le groupe doit garder au moins un admin';
  end if;
  update group_members set role = new_role where group_id = gid and user_id = member;
end;
$$;

revoke execute on function public.set_member_role(uuid, uuid, text) from anon;
