-- Abonnements : l'offre de chaque groupe (Gratuit, Équipe, Fondateur).
-- Seul le webhook Stripe (clé service) écrit dans group_billing : aucun client ne peut se donner une offre.
-- Migration additive : une table, des fonctions, un déclencheur. Rien n'est supprimé.

create table if not exists public.group_billing (
  group_id uuid primary key references public.groups (id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'team', 'founder')),
  status text not null default 'active' check (status in ('active', 'past_due', 'canceled')),
  billing_period text check (billing_period in ('month', 'year')),
  current_period_end timestamptz,
  grace_until timestamptz,
  trial_end timestamptz,
  stripe_customer_id text,
  stripe_subscription_id text,
  updated_at timestamptz not null default now()
);

alter table public.group_billing enable row level security;

drop policy if exists "offre lisible par les membres" on public.group_billing;
create policy "offre lisible par les membres" on public.group_billing
  for select using (public.is_member(group_id));
-- Pas de politique insert/update/delete : seule la clé service écrit.

-- Les identifiants Stripe ne sont pas utiles au client.
revoke select (stripe_customer_id, stripe_subscription_id) on public.group_billing from anon, authenticated;

do $$ begin
  alter publication supabase_realtime add table public.group_billing;
exception when duplicate_object then null; when undefined_object then null;
end $$;

-- Offre en vigueur : payante si active, ou impayée mais encore dans les 7 jours de grâce.
create or replace function public.group_plan(gid uuid)
returns text language sql stable security definer set search_path = public as $$
  select coalesce((
    select b.plan from group_billing b
    where b.group_id = gid
      and b.plan <> 'free'
      and (b.status = 'active' or (b.status = 'past_due' and b.grace_until > now()))
  ), 'free');
$$;

-- Nombre de membres permis par l'offre.
create or replace function public.plan_member_limit(p text)
returns int language sql immutable as $$
  select case p when 'free' then 5 else 25 end;
$$;

-- Un groupe est en lecture seule quand il a plus de membres que son offre n'en permet
-- (par exemple après une résiliation). Rien n'est supprimé : tout revient au paiement.
create or replace function public.group_locked(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select (select count(*) from group_members where group_id = gid) > plan_member_limit(group_plan(gid));
$$;

-- Écrire demande maintenant aussi un groupe non verrouillé.
create or replace function public.can_write(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from group_members m join groups g on g.id = m.group_id
    where m.group_id = gid and m.user_id = auth.uid() and m.role in ('admin', 'member') and g.deleted_at is null
  ) and not public.group_locked(gid);
$$;

-- Plus personne ne rejoint un groupe plein (lien, code ou invitation par email).
create or replace function public.check_member_limit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from group_members where group_id = new.group_id) >= plan_member_limit(group_plan(new.group_id)) then
    raise exception 'limite_membres' using hint = 'Ce groupe est plein pour son offre.';
  end if;
  return new;
end;
$$;

drop trigger if exists members_limit on public.group_members;
create trigger members_limit before insert on public.group_members
  for each row execute function public.check_member_limit();

-- Ce que le client lit : offre, état, limites, sans les identifiants Stripe.
create or replace function public.group_billing_info(gid uuid)
returns json language sql stable security definer set search_path = public as $$
  select case when not is_member(gid) then null else json_build_object(
    'plan', group_plan(gid),
    'paidPlan', coalesce(b.plan, 'free'),
    'status', coalesce(b.status, 'active'),
    'period', b.billing_period,
    'periodEnd', b.current_period_end,
    'graceUntil', b.grace_until,
    'trialEnd', case when b.trial_end > now() then b.trial_end end,
    'trialUsed', b.stripe_subscription_id is not null,
    'hasCustomer', b.stripe_customer_id is not null,
    'members', (select count(*) from group_members where group_id = gid),
    'memberLimit', plan_member_limit(group_plan(gid)),
    'locked', group_locked(gid),
    'founderLeft', greatest(0, 20 - (select count(*) from group_billing where plan = 'founder' and status <> 'canceled'))
  ) end
  from (select 1) one left join group_billing b on b.group_id = gid;
$$;

revoke execute on function public.group_plan(uuid) from public, anon;
revoke execute on function public.group_locked(uuid) from public, anon;
revoke execute on function public.group_billing_info(uuid) from public, anon;
grant execute on function public.group_plan(uuid) to authenticated;
grant execute on function public.group_locked(uuid) to authenticated;
grant execute on function public.group_billing_info(uuid) to authenticated;
