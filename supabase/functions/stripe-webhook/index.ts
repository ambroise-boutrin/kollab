// Webhook Stripe : la seule porte qui change l'offre d'un groupe.
// Un essai (trialing) compte comme actif.
// Déployer avec --no-verify-jwt : Stripe n'a pas de jeton Supabase, la signature Stripe fait foi.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import Stripe from 'npm:stripe@17.7.0'
import { appUrl, sendEmail } from '../_shared/email.ts'

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

/** Email à l'admin qui paie (adresse du client Stripe), une seule fois par événement. */
async function mail(event: Stripe.Event, sub: Stripe.Subscription, template: string, extra: Record<string, unknown> = {}) {
  const groupId = sub.metadata?.group_id
  if (!groupId) return
  const customer = typeof sub.customer === 'string' ? await stripe.customers.retrieve(sub.customer) : sub.customer
  const to = 'deleted' in customer && customer.deleted ? null : (customer as Stripe.Customer).email
  if (!to) return
  const { data: group } = await admin.from('groups').select('name').eq('id', groupId).maybeSingle()
  const item = sub.items.data[0]
  const known = item ? PLAN_BY_PRICE[item.price.id] : undefined
  const data = {
    group: group?.name ?? 'ton groupe',
    plan: known?.plan ?? 'team',
    period: known?.period ?? 'month',
    amount: item?.price.unit_amount ?? 0,
    currency: item?.price.currency ?? 'eur',
    url: `${appUrl()}?groupe=${groupId}`,
    ...extra,
  }
  try {
    await sendEmail({ to, template: template as never, data, groupId, key: event.id })
  } catch (err) {
    console.error('email abonnement', template, err)
  }
}

const iso = (t?: number | null) => (t ? new Date(t * 1000).toISOString() : null)

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
      await save(event.data.object as Stripe.Subscription)
      break
    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription
      await save(sub)
      await mail(event, sub, 'subscription_canceled', { endedOn: iso(sub.ended_at) ?? new Date().toISOString() })
      break
    }
    case 'customer.subscription.trial_will_end': {
      const sub = event.data.object as Stripe.Subscription
      await mail(event, sub, 'trial_ending', { trialEnd: iso(sub.trial_end) })
      break
    }
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.upcoming': {
      const inv = event.data.object as Stripe.Invoice & { subscription?: string; parent?: { subscription_details?: { subscription?: string } } }
      const subId = inv.subscription ?? inv.parent?.subscription_details?.subscription
      if (!subId) break
      const sub = await stripe.subscriptions.retrieve(subId)
      if (event.type !== 'invoice.upcoming') await save(sub)
      const money = { amount: event.type === 'invoice.paid' ? inv.amount_paid : inv.amount_due, currency: inv.currency }
      if (event.type === 'invoice.paid' && inv.amount_paid > 0) {
        const periodEnd = (sub.items.data[0] as unknown as { current_period_end?: number })?.current_period_end
        await mail(event, sub, 'payment_succeeded', { ...money, invoiceUrl: inv.hosted_invoice_url, pdfUrl: inv.invoice_pdf, periodEnd: iso(periodEnd) })
      } else if (event.type === 'invoice.payment_failed') {
        const { data: b } = await admin.from('group_billing').select('grace_until').eq('group_id', sub.metadata?.group_id ?? '').maybeSingle()
        await mail(event, sub, 'payment_failed', { ...money, graceUntil: b?.grace_until ?? null })
      } else if (event.type === 'invoice.upcoming' && inv.amount_due > 0) {
        await mail(event, sub, 'renewal_upcoming', { ...money, renewOn: iso(inv.next_payment_attempt ?? inv.period_end) })
      }
      break
    }
  }
  return new Response('ok')
})
