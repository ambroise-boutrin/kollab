// Webhook Stripe : la seule porte qui change l'offre d'un groupe.
// Un essai (trialing) compte comme actif.
// Déployer avec --no-verify-jwt : Stripe n'a pas de jeton Supabase, la signature Stripe fait foi.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import Stripe from 'npm:stripe@17.7.0'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '')
const crypto = Stripe.createSubtleCryptoProvider()
const GRACE_DAYS = 7

const PLAN_BY_PRICE: Record<string, { plan: string; period: string }> = {}
const add = (env: string, plan: string, period: string) => {
  const id = Deno.env.get(env)
  if (id) PLAN_BY_PRICE[id] = { plan, period }
}
add('STRIPE_PRICE_TEAM_MONTH', 'team', 'month')
add('STRIPE_PRICE_TEAM_YEAR', 'team', 'year')
add('STRIPE_PRICE_FOUNDER', 'founder', 'year')

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

async function save(sub: Stripe.Subscription) {
  const groupId = sub.metadata?.group_id
  if (!groupId) return
  const item = sub.items.data[0]
  const known = item ? PLAN_BY_PRICE[item.price.id] : undefined
  const ended = sub.status === 'canceled' || sub.status === 'incomplete_expired' || sub.status === 'unpaid'
  const late = sub.status === 'past_due'
  const { data: prev } = await admin.from('group_billing').select('status, grace_until').eq('group_id', groupId).maybeSingle()
  // La grâce démarre au premier impayé et ne se rallonge pas à chaque relance.
  const grace = late
    ? (prev?.status === 'past_due' && prev.grace_until ? prev.grace_until : new Date(Date.now() + GRACE_DAYS * 864e5).toISOString())
    : null
  const periodEnd = (item as unknown as { current_period_end?: number })?.current_period_end ?? (sub as unknown as { current_period_end?: number }).current_period_end
  await admin.from('group_billing').upsert({
    group_id: groupId,
    plan: ended ? 'free' : known?.plan ?? 'team',
    status: ended ? 'canceled' : late ? 'past_due' : 'active',
    billing_period: known?.period ?? null,
    current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
    grace_until: grace,
    trial_end: sub.status === 'trialing' && sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
    stripe_subscription_id: sub.id,
    updated_at: new Date().toISOString(),
  })
}

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature')
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  if (!signature || !secret) return new Response('signature manquante', { status: 400 })
  const body = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, crypto)
  } catch {
    return new Response('signature invalide', { status: 400 })
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session
      if (s.subscription) await save(await stripe.subscriptions.retrieve(s.subscription as string))
      break
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted':
      await save(event.data.object as Stripe.Subscription)
      break
    case 'invoice.payment_failed':
    case 'invoice.paid': {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string; parent?: { subscription_details?: { subscription?: string } } }
      const subId = inv.subscription ?? inv.parent?.subscription_details?.subscription
      if (subId) await save(await stripe.subscriptions.retrieve(subId))
      break
    }
  }
  return new Response('ok')
})
