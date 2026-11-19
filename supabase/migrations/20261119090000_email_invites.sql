-- Invitations par email, façon Canva : la personne reçoit un email et, une fois connectée,
-- une notification « Rejoindre / Refuser ». Ajouts seulement.
create table if not exists public.email_invites (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups (id) on delete cascade,
  email text not null,
  role text not null default 'member' check (role in ('admin', 'member', 'guest')),
  code text not null,
  invited_by uuid default auth.uid() references auth.users (id) on delete set null,
  claimed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists email_invites_email_idx on public.email_invites (lower(email)) where claimed_at is null and cancelled_at is null;
alter table public.email_invites enable row level security;
create policy "invitations email lisibles par les admins" on public.email_invites for select using (is_admin(group_id));
create policy "invitations email annulables par les admins" on public.email_invites for update using (is_admin(group_id)) with check (is_admin(group_id));

-- Invite une adresse : crée le code à usage unique, l'invitation en attente,
-- et la notification tout de suite si la personne a déjà un compte. Renvoie le code et s'il y a un compte.
create or replace function public.invite_email(gid uuid, email text, new_role text default 'member')
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  addr text := lower(trim(invite_email.email));
  target uuid;
  inv_code text;
  gname text;
begin
  if not is_admin(gid) then raise exception 'réservé aux admins'; end if;
  if new_role not in ('admin', 'member', 'guest') then raise exception 'rôle inconnu'; end if;
  if addr !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'adresse invalide'; end if;
  select id into target from auth.users u where lower(u.email) = addr;
  if target is not null and exists (select 1 from group_members where group_id = gid and user_id = target) then
    raise exception 'déjà dans l''équipe';
  end if;
  -- Une seule invitation en attente par adresse et par projet.
  update email_invites set cancelled_at = now() where group_id = gid and lower(email_invites.email) = addr and claimed_at is null and cancelled_at is null;
  insert into invitations (group_id, role, max_uses, expires_at) values (gid, new_role, 1, now() + interval '30 days')
  returning code into inv_code;
  select name into gname from groups where id = gid;
  if target is not null then
    insert into notifications (user_id, group_id, actor_id, kind, title, body, data)
    values (target, gid, auth.uid(), 'invited', gname, actor_name() || ' t''invite à rejoindre l''équipe', jsonb_build_object('code', inv_code));
    insert into email_invites (group_id, email, role, code, claimed_at) values (gid, addr, new_role, inv_code, now());
  else
    insert into email_invites (group_id, email, role, code) values (gid, addr, new_role, inv_code);
  end if;
  return jsonb_build_object('code', inv_code, 'account', target is not null, 'group', gname, 'inviter', actor_name());
end;
$$;
revoke execute on function public.invite_email(uuid, text, text) from public, anon;
grant execute on function public.invite_email(uuid, text, text) to authenticated;

-- À la connexion : les invitations reçues avant d'avoir un compte deviennent des notifications.
create or replace function public.claim_email_invites()
returns int language plpgsql security definer set search_path = public as $$
declare
  addr text := lower(coalesce(auth.jwt() ->> 'email', ''));
  r record;
  n int := 0;
begin
  if auth.uid() is null or addr = '' then return 0; end if;
  -- Seulement une adresse vérifiée.
  if not exists (select 1 from auth.users u where u.id = auth.uid() and u.email_confirmed_at is not null) then return 0; end if;
  for r in
    select e.*, g.name as gname, coalesce(p.name, 'Quelqu''un') as inviter
    from email_invites e
    join groups g on g.id = e.group_id and g.deleted_at is null
    left join profiles p on p.id = e.invited_by
    where lower(e.email) = addr and e.claimed_at is null and e.cancelled_at is null
  loop
    if not exists (select 1 from group_members where group_id = r.group_id and user_id = auth.uid()) then
      insert into notifications (user_id, group_id, actor_id, kind, title, body, data)
      values (auth.uid(), r.group_id, r.invited_by, 'invited', r.gname, r.inviter || ' t''invite à rejoindre l''équipe', jsonb_build_object('code', r.code));
      n := n + 1;
    end if;
    update email_invites set claimed_at = now() where id = r.id;
  end loop;
  return n;
end;
$$;
revoke execute on function public.claim_email_invites() from public, anon;
grant execute on function public.claim_email_invites() to authenticated;

-- Annuler une invitation par email : elle disparaît de la liste et son code ne marche plus.
create or replace function public.cancel_email_invite(invite_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r email_invites;
begin
  select * into r from email_invites where id = invite_id;
  if r.id is null or not is_admin(r.group_id) then raise exception 'réservé aux admins'; end if;
  update email_invites set cancelled_at = now() where id = invite_id;
  update invitations set expires_at = now() where code = r.code and group_id = r.group_id;
end;
$$;
revoke execute on function public.cancel_email_invite(uuid) from public, anon;
grant execute on function public.cancel_email_invite(uuid) to authenticated;
