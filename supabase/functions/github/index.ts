// Accès GitHub de Kollab, côté serveur. Le jeton GitHub ne quitte jamais cette fonction :
// il est chiffré dans Supabase Vault (table github_secrets, illisible depuis l'app).
// Entrées :
// - POST { action } avec la session de la personne : status, connect, install, api, forget ;
// - GET /config : l'appli GitHub Kollab est-elle prête ?
// - GET /setup : retour de GitHub après la création de l'appli (une seule fois, code à usage unique) ;
// - GET /callback : retour de GitHub après « Autoriser » (accès par dépôt) ;
// - GET /installed : retour de GitHub après le choix des dépôts.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const SELF = `${Deno.env.get('SUPABASE_URL')}/functions/v1/github`
const APP = (Deno.env.get('APP_URL') ?? 'https://kollab-tan-nu.vercel.app/app').replace(/\/$/, '')
const API = 'https://api.github.com'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (message: string, status = 400) => json({ error: message }, status)
const go = (to: string) => new Response(null, { status: 302, headers: { Location: to } })
const done = (ok: boolean) => go(`${APP}/?gh-popup=1${ok ? '&github=ok' : '&error=github'}`)

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

type AppConfig = { client_id: string; client_secret: string; slug: string; html_url?: string }
type Secrets = { oauth: string | null; app: string | null; app_refresh: string | null; app_expires_at: string | null; login: string | null; updated_at: string }

async function appConfig(db: SupabaseClient): Promise<AppConfig | null> {
  const { data } = await db.rpc('github_app_config')
  const c = data as AppConfig | null
  return c?.client_id && c.client_secret ? c : null
}
async function secretValue(db: SupabaseClient, name: string) {
  const { data } = await db.from('app_secrets').select('value').eq('name', name).order('created_at', { ascending: false }).limit(1).maybeSingle()
  return (data?.value as string | undefined) ?? ''
}
async function readSecrets(db: SupabaseClient, uid: string): Promise<Secrets | null> {
  const { data } = await db.rpc('github_read', { uid })
  return ((data as Secrets[] | null) ?? [])[0] ?? null
}
async function save(db: SupabaseClient, uid: string, kind: 'oauth' | 'app', token: string, extra: { refresh?: string | null; expires?: string | null; login?: string | null } = {}) {
  const { error } = await db.rpc('github_save', { uid, kind, token, refresh: extra.refresh ?? null, expires: extra.expires ?? null, gh_login: extra.login ?? null })
  if (error) throw new Error(error.message)
}

// Signature de l'état OAuth (qui se connecte), avec la clé de la base.
async function hmac(text: string, db: SupabaseClient) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(await secretValue(db, 'github_key')), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text)))
  return btoa(String.fromCharCode(...sig)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
}
async function makeState(db: SupabaseClient, uid: string) {
  const payload = `${uid}.${Date.now()}`
  return `${payload}.${await hmac(payload, db)}`
}
async function readState(db: SupabaseClient, state: string | null): Promise<string | null> {
  const [uid, t, sig] = (state ?? '').split('.')
  if (!uid || !t || !sig || Date.now() - Number(t) > 15 * 60e3) return null
  return (await hmac(`${uid}.${t}`, db)) === sig ? uid : null
}

/** Échange un code (ou un jeton de renouvellement) contre un jeton de l'appli GitHub. */
async function exchange(cfg: AppConfig, params: Record<string, string>) {
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: cfg.client_id, client_secret: cfg.client_secret, ...params }),
  })
  const j = (await res.json().catch(() => ({}))) as { access_token?: string; refresh_token?: string; expires_in?: number; error?: string }
  if (!j.access_token) throw new Error(j.error ?? 'échange refusé')
  return { token: j.access_token, refresh: j.refresh_token ?? null, expires: j.expires_in ? new Date(Date.now() + (j.expires_in - 60) * 1000).toISOString() : null }
}

const ghFetch = (token: string | null, path: string, init: RequestInit = {}, accept = 'application/vnd.github+json') =>
  fetch(API + path, {
    ...init,
    headers: {
      Accept: accept, 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'Kollab',
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })

/** Le jeton à utiliser : celui de l'appli GitHub (renouvelé s'il expire), sinon l'ancien. */
async function tokenFor(db: SupabaseClient, uid: string, force = false): Promise<{ token: string; kind: 'app' | 'oauth' } | null> {
  const s = await readSecrets(db, uid)
  if (s?.app) {
    const expired = s.app_expires_at && Date.parse(s.app_expires_at) < Date.now()
    if ((expired || force) && s.app_refresh) {
      const cfg = await appConfig(db)
      if (cfg) {
        try {
          const t = await exchange(cfg, { grant_type: 'refresh_token', refresh_token: s.app_refresh })
          await save(db, uid, 'app', t.token, t)
          return { token: t.token, kind: 'app' }
        } catch {
          // Renouvellement refusé (révoqué sur GitHub) : il faudra autoriser de nouveau.
          await save(db, uid, 'app', '')
          return s.oauth ? { token: s.oauth, kind: 'oauth' } : null
        }
      }
    }
    if (!expired) return { token: s.app, kind: 'app' }
  }
  return s?.oauth ? { token: s.oauth, kind: 'oauth' } : null
}

// Seuls les appels dont Kollab a besoin passent. Rien sur les réglages, les clés ou les secrets du dépôt.
const R = String.raw`/repos/[\w.-]+/[\w.-]+`
const ALLOWED: [string, RegExp][] = [
  ['GET', /^\/user$/], ['GET', /^\/user\/repos$/], ['GET', /^\/user\/installations$/],
  ['GET', new RegExp(`^${R}$`)],
  ['GET', new RegExp(`^${R}/(pulls|branches|actions/runs)$`)],
  ['POST', new RegExp(`^${R}/pulls$`)],
  ['GET', new RegExp(`^${R}/pulls/\\d+(/(files|comments|reviews|commits))?$`)],
  ['POST', new RegExp(`^${R}/pulls/\\d+/(reviews|comments)$`)],
  ['PUT', new RegExp(`^${R}/pulls/\\d+/merge$`)],
  ['PATCH', new RegExp(`^${R}/pulls/\\d+$`)],
  ['GET', new RegExp(`^${R}/issues/\\d+/comments$`)], ['POST', new RegExp(`^${R}/issues/\\d+/comments$`)],
  ['GET', new RegExp(`^${R}/commits/[\\w.-]+/(check-runs|status|statuses)$`)],
  ['GET', new RegExp(`^${R}/check-runs/\\d+(/annotations)?$`)],
  ['POST', new RegExp(`^${R}/actions/runs/\\d+/(rerun|rerun-failed-jobs)$`)],
  ['GET', new RegExp(`^${R}/git/ref/heads/[^?#]+$`)], ['GET', new RegExp(`^${R}/git/commits/\\w+$`)],
  ['POST', new RegExp(`^${R}/git/(commits|refs)$`)],
  ['PATCH', new RegExp(`^${R}/git/refs/heads/[^?#]+$`)], ['DELETE', new RegExp(`^${R}/git/refs/heads/[^?#]+$`)],
]
const allowed = (method: string, path: string) => {
  const bare = path.split('?')[0]
  return !bare.includes('..') && ALLOWED.some(([m, re]) => m === method && re.test(bare))
}

async function api(db: SupabaseClient, uid: string, b: { method?: string; path?: string; body?: unknown; accept?: string }) {
  const method = (b.method ?? 'GET').toUpperCase()
  const path = b.path ?? ''
  if (!path.startsWith('/') || !allowed(method, path)) return fail('Appel GitHub non autorisé par Kollab.', 403)
  const accept = /^application\/vnd\.github[\w.+-]*$/.test(b.accept ?? '') ? b.accept! : 'application/vnd.github+json'
  const init: RequestInit = { method, ...(b.body !== undefined ? { body: JSON.stringify(b.body) } : {}) }
  let t = await tokenFor(db, uid)
  let res = await ghFetch(t?.token ?? null, path, init, accept)
  if (res.status === 401 && t?.kind === 'app') {
    // Jeton expiré plus tôt que prévu : on le renouvelle une fois.
    t = await tokenFor(db, uid, true)
    res = await ghFetch(t?.token ?? null, path, init, accept)
  }
  if (res.status === 401 && t) await save(db, uid, t.kind, '')
  return json({ status: res.status, body: await res.text(), remaining: res.headers.get('x-ratelimit-remaining') })
}

async function installations(token: string) {
  const res = await ghFetch(token, '/user/installations?per_page=1')
  if (!res.ok) return 0
  return ((await res.json()) as { total_count?: number }).total_count ?? 0
}

// Retours de GitHub ------------------------------------------------------------

async function getRoute(db: SupabaseClient, url: URL) {
  const route = url.pathname.split('/').pop()
  if (route === 'config') return json({ app: !!(await appConfig(db)) })

  if (route === 'installed') return done(true)

  if (route === 'setup') {
    // Création de l'appli GitHub Kollab : code à usage unique, et seulement si elle n'existe pas encore.
    const code = await secretValue(db, 'github_setup')
    if (!code || url.searchParams.get('state') !== code || (await appConfig(db))) return new Response('Lien de création déjà utilisé.', { status: 403 })
    const res = await fetch(`${API}/app-manifests/${encodeURIComponent(url.searchParams.get('code') ?? '')}/conversions`, {
      method: 'POST', headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Kollab' },
    })
    if (!res.ok) return new Response(`Création refusée par GitHub (${res.status}).`, { status: 502 })
    const app = (await res.json()) as { id: number; slug: string; client_id: string; client_secret: string; pem: string; webhook_secret: string | null; html_url: string }
    const { error } = await db.rpc('github_app_config_set', {
      cfg: { id: app.id, slug: app.slug, client_id: app.client_id, client_secret: app.client_secret, pem: app.pem, webhook_secret: app.webhook_secret, html_url: app.html_url },
    })
    if (error) return new Response('Enregistrement impossible.', { status: 500 })
    await db.from('app_secrets').update({ value: '' }).eq('name', 'github_setup')
    return go(`${app.html_url}/installations/new`)
  }

  if (route === 'callback') {
    const uid = await readState(db, url.searchParams.get('state'))
    const cfg = await appConfig(db)
    const code = url.searchParams.get('code')
    if (!uid || !cfg || !code) return done(false)
    try {
      const t = await exchange(cfg, { code, redirect_uri: `${SELF}/callback` })
      const me = await ghFetch(t.token, '/user')
      const login = me.ok ? ((await me.json()) as { login?: string }).login ?? null : null
      await save(db, uid, 'app', t.token, { ...t, login })
      // Aucun dépôt choisi encore : on enchaîne sur le choix des dépôts, dans la même fenêtre.
      if (!(await installations(t.token))) return go(`https://github.com/apps/${cfg.slug}/installations/new`)
      return done(true)
    } catch (e) {
      console.error('callback', e)
      return done(false)
    }
  }
  return fail('introuvable', 404)
}

// Entrées ----------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const db = admin()
  const url = new URL(req.url)
  if (req.method === 'GET') return getRoute(db, url)

  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  const { data: me } = await db.auth.getUser(jwt)
  if (!me.user) return fail('Connecte-toi d’abord.', 401)
  const uid = me.user.id
  const body = (await req.json().catch(() => ({}))) as { action?: string; method?: string; path?: string; body?: unknown; accept?: string; check?: boolean }

  try {
    switch (body.action) {
      case 'status': {
        const s = await readSecrets(db, uid)
        const cfg = await appConfig(db)
        const mode = s?.app ? 'app' : s?.oauth ? 'oauth' : null
        let installs: number | undefined
        if (body.check && mode === 'app') {
          const t = await tokenFor(db, uid)
          installs = t ? await installations(t.token) : 0
        }
        return json({ linked: !!mode, mode, app: !!cfg, login: s?.login ?? null, updatedAt: s?.updated_at ?? null, installs, slug: cfg?.slug ?? null })
      }
      case 'connect': {
        const cfg = await appConfig(db)
        if (!cfg) return json({ fallback: true })
        const q = new URLSearchParams({ client_id: cfg.client_id, redirect_uri: `${SELF}/callback`, state: await makeState(db, uid) })
        return json({ url: `https://github.com/login/oauth/authorize?${q}` })
      }
      case 'install': {
        const cfg = await appConfig(db)
        return cfg ? json({ url: `https://github.com/apps/${cfg.slug}/installations/new` }) : fail('Appli GitHub pas encore créée.', 503)
      }
      case 'api':
        return await api(db, uid, body)
      case 'forget': {
        await save(db, uid, 'app', '')
        await save(db, uid, 'oauth', '')
        return json({ ok: true })
      }
      default:
        return fail('action inconnue')
    }
  } catch (e) {
    console.error('github', e)
    return fail('GitHub ne répond pas pour le moment.', 502)
  }
})
