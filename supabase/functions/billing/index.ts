// Abonnements : ouvre Stripe Checkout (changer d'offre) ou le portail client (carte, factures, résiliation).
// Seul un admin du groupe peut payer. L'offre n'est écrite que par stripe-webhook, jamais ici.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import Stripe from 'npm:stripe@17.7.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

// Offres vendues → identifiant du prix Stripe (secrets de la fonction).
const PRICES: Record<string, string | undefined> = {
  team_month: Deno.env.get('STRIPE_PRICE_TEAM_MONTH'),
  team_year: Deno.env.get('STRIPE_PRICE_TEAM_YEAR'),
  founder: Deno.env.get('STRIPE_PRICE_FOUNDER'),
}
const FOUNDER_SEATS = 20
const TRIAL_DAYS = 30
const FOUNDER_END = new Date('2027-05-01T00:00:00Z')
const APP_URL = Deno.env.get('APP_URL') ?? 'https://kollab-tan-nu.vercel.app/app'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const key = Deno.env.get('STRIPE_SECRET_KEY')
  if (!key) return json({ error: 'paiement_non_configure' }, 503)
  const stripe = new Stripe(key)

  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await asUser.auth.getUser()
  const user = auth.user
  if (!user) return json({ error: 'non_connecte' }, 401)

  const { action, groupId, offer } = await req.json().catch(() => ({}))
  if (typeof groupId !== 'string') return json({ error: 'groupe_manquant' }, 400)

  const { data: isAdmin } = await asUser.rpc('is_admin', { gid: groupId })
  if (!isAdmin) return json({ error: 'admin_seulement' }, 403)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: billing } = await admin.from('group_billing').select('*').eq('group_id', groupId).maybeSingle()
  const back = `${APP_URL}?groupe=${groupId}`

  if (action === 'portal') {
    if (!billing?.stripe_customer_id) return json({ error: 'pas_de_client' }, 400)
    const s = await stripe.billingPortal.sessions.create({ customer: billing.stripe_customer_id, return_url: back })
    return json({ url: s.url })
  }

  if (action !== 'checkout') return json({ error: 'action_inconnue' }, 400)
  const price = PRICES[offer as string]
  if (!price) return json({ error: 'offre_inconnue' }, 400)

  // Déjà abonné : on change d'offre dans le portail, pas avec un second abonnement.
  if (billing?.stripe_subscription_id && billing.status !== 'canceled') {
    const s = await stripe.billingPortal.sessions.create({ customer: billing.stripe_customer_id, return_url: back })
    return json({ url: s.url })
  }

  if (offer === 'founder') {
    const { count } = await admin.from('group_billing').select('group_id', { count: 'exact', head: true })
      .eq('plan', 'founder').neq('status', 'canceled')
    if (new Date() >= FOUNDER_END || (count ?? 0) >= FOUNDER_SEATS) return json({ error: 'fondateur_complet' }, 409)
  }

  let customer = billing?.stripe_customer_id as string | undefined
  if (!customer) {
    const { data: group } = await admin.from('groups').select('name').eq('id', groupId).single()
    const c = await stripe.customers.create({
      email: user.email,
      name: group?.name ?? undefined,
      metadata: { group_id: groupId },
    })
    customer = c.id
    await admin.from('group_billing').upsert({ group_id: groupId, stripe_customer_id: customer, updated_at: new Date().toISOString() })
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    client_reference_id: groupId,
    metadata: { group_id: groupId, offer },
    // 30 jours d'essai sur Équipe, une seule fois par groupe. La carte est demandée au départ :
    // sans résiliation, l'abonnement se renouvelle tout seul (fin d'essai, puis chaque mois ou chaque année).
    ...(offer !== 'founder' && !billing?.stripe_subscription_id
      ? { subscription_data: { metadata: { group_id: groupId, offer }, trial_period_days: TRIAL_DAYS } }
      : { subscription_data: { metadata: { group_id: groupId, offer } } }),
    allow_promotion_codes: true,
    locale: 'fr',
    success_url: `${back}&paiement=ok`,
    cancel_url: `${back}&paiement=annule`,
  })
  return json({ url: session.url })
})
