// Notifications sur téléphone (Web Push).
// - GET : clé publique VAPID (créée au premier appel, gardée dans app_secrets, jamais exposée en privé).
// - POST { action: 'subscribe' | 'unsubscribe' | 'test' } : gère les appareils de l'utilisateur connecté.
// - POST { id } : appelé par la base à chaque nouvelle notification ; envoie une seule fois, sur tous ses appareils.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import webpush from 'npm:web-push@3.6.7'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Services de push des navigateurs : on n'envoie nulle part ailleurs.
const PUSH_HOSTS = [/(^|\.)fcm\.googleapis\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)notify\.windows\.com$/]
const validEndpoint = (e: unknown): e is string => {
  try {
    const u = new URL(String(e))
    return u.protocol === 'https:' && PUSH_HOSTS.some((r) => r.test(u.hostname))
  } catch {
    return false
  }
}

let keys: { publicKey: string; privateKey: string } | null = null
async function vapid() {
  if (keys) return keys
  const read = async () => {
    const { data } = await admin.from('app_secrets').select('name, value').in('name', ['vapid_public', 'vapid_private'])
    const m = new Map((data ?? []).map((r) => [r.name, r.value]))
    return m.get('vapid_public') && m.get('vapid_private') ? { publicKey: m.get('vapid_public')!, privateKey: m.get('vapid_private')! } : null
  }
  let k = await read()
  if (!k) {
    const g = webpush.generateVAPIDKeys()
    // Deux premiers appels simultanés : un seul jeu de clés gagne.
    await admin.from('app_secrets').upsert(
      [{ name: 'vapid_public', value: g.publicKey }, { name: 'vapid_private', value: g.privateKey }],
      { onConflict: 'name', ignoreDuplicates: true },
    )
    k = await read()
  }
  if (!k) throw new Error('vapid')
  keys = k
  webpush.setVapidDetails('https://kollab-tan-nu.vercel.app', k.publicKey, k.privateKey)
  return k
}

type Sub = { endpoint: string; p256dh: string; auth: string }

async function sendTo(userId: string, payload: Record<string, unknown>) {
  await vapid()
  const { data: subs } = await admin.from('push_subscriptions').select('endpoint, p256dh, auth').eq('user_id', userId).is('disabled_at', null)
  let sent = 0
  await Promise.all(
    ((subs ?? []) as Sub[]).map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 60 * 60 * 24, urgency: 'high' })
        sent++
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode
        // Appareil désabonné ou expiré : on le désactive.
        if (code === 404 || code === 410) await admin.from('push_subscriptions').update({ disabled_at: new Date().toISOString() }).eq('endpoint', s.endpoint)
      }
    }),
  )
  return sent
}

async function userFrom(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin.auth.getUser(token)
  return data.user ?? null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    if (req.method === 'GET') return json({ publicKey: (await vapid()).publicKey })
    if (req.method !== 'POST') return json({ error: 'method' }, 405)
    const body = await req.json().catch(() => ({}))

    if (body.action) {
      const user = await userFrom(req)
      if (!user) return json({ error: 'auth' }, 401)
      if (body.action === 'subscribe') {
        const s = body.subscription ?? {}
        if (!validEndpoint(s.endpoint) || typeof s.keys?.p256dh !== 'string' || typeof s.keys?.auth !== 'string') return json({ error: 'subscription' }, 400)
        const { error } = await admin.from('push_subscriptions').upsert({
          endpoint: s.endpoint,
          user_id: user.id,
          p256dh: s.keys.p256dh,
          auth: s.keys.auth,
          user_agent: String(req.headers.get('User-Agent') ?? '').slice(0, 300),
          disabled_at: null,
          updated_at: new Date().toISOString(),
        })
        return error ? json({ error: 'save' }, 500) : json({ ok: true })
      }
      if (body.action === 'unsubscribe') {
        await admin.from('push_subscriptions').update({ disabled_at: new Date().toISOString() }).eq('endpoint', String(body.endpoint ?? '')).eq('user_id', user.id)
        return json({ ok: true })
      }
      if (body.action === 'test') {
        const sent = await sendTo(user.id, { title: 'Kollab', body: 'Les notifications arrivent bien sur cet appareil.', url: '/app/', tag: 'kollab-test' })
        return json({ sent })
      }
      return json({ error: 'action' }, 400)
    }

    // Appel de la base : on « réserve » la notification pour ne l'envoyer qu'une fois, et seulement si elle est récente.
    if (typeof body.id !== 'string') return json({ error: 'id' }, 400)
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: n } = await admin
      .from('notifications')
      .update({ pushed_at: new Date().toISOString() })
      .eq('id', body.id)
      .is('pushed_at', null)
      .gte('created_at', since)
      .select('id, user_id, title, body, kind')
      .maybeSingle()
    if (!n) return new Response(null, { status: 204, headers: cors })
    // Ne pas déranger : la notification reste dans la cloche, sans push sur le téléphone.
    const { data: prof } = await admin.from('profiles').select('presence, presence_until').eq('id', n.user_id).maybeSingle()
    if (prof?.presence === 'dnd' && (!prof.presence_until || new Date(prof.presence_until).getTime() > Date.now())) return new Response(null, { status: 204, headers: cors })
    const sent = await sendTo(n.user_id, { id: n.id, title: n.title, body: n.body, url: `/app/?notif=${n.id}`, tag: n.id })
    return json({ sent })
  } catch (e) {
    console.error(e)
    return json({ error: 'server' }, 500)
  }
})
