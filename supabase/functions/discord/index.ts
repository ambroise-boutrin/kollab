// Salons Discord reliés au chat Kollab, dans les deux sens. Une seule fonction, plusieurs entrées :
// - POST { action } avec la session de l'utilisateur : start, channels, link, unlink, disconnect ;
// - GET  ?code&state : retour de Discord après « Autoriser » (ajout du bot au serveur) ;
// - POST /relay (clé x-discord-key) : un message Kollab part sur Discord (créé, modifié ou supprimé) ;
// - POST /poll  (clé x-discord-key) : lit les nouveaux messages Discord pendant ~55 s (appelée chaque minute).
// Secrets : DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, DISCORD_BOT_TOKEN (portail développeur Discord), APP_URL.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2.45.4'

const API = 'https://discord.com/api/v10'
const SELF = `${Deno.env.get('SUPABASE_URL')}/functions/v1/discord`
const APP = (Deno.env.get('APP_URL') ?? 'https://kollab-tan-nu.vercel.app/app').replace(/\/$/, '')
// Voir les salons, envoyer, lire l'historique, gérer les webhooks, créer des salons.
const PERMISSIONS = String(1024 + 2048 + 65536 + 536870912 + 16)

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const fail = (message: string, status = 400) => json({ error: message }, status)

const admin = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

// Discord ----------------------------------------------------------------------

type DChannel = { id: string; name: string; type: number; position: number; parent_id: string | null; last_message_id?: string | null }
type DUser = { id: string; username: string; global_name?: string | null; avatar?: string | null; bot?: boolean }
type DMessage = {
  id: string; type: number; content: string; timestamp: string; webhook_id?: string
  author: DUser; mentions: DUser[]; attachments: { url: string; filename: string }[]
  member?: { nick?: string | null }
}

async function bot<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bot ${Deno.env.get('DISCORD_BOT_TOKEN')}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
  if (res.status === 429 && retry) {
    const wait = Number((await res.json().catch(() => ({}))).retry_after ?? 1)
    await new Promise((r) => setTimeout(r, Math.min(wait, 5) * 1000))
    return bot(path, init, false)
  }
  if (!res.ok) throw new Error(`discord ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300))
  return (res.status === 204 ? null : await res.json()) as T
}

const nameOf = (u: DUser, nick?: string | null) => nick || u.global_name || u.username
const avatarOf = (u: DUser) =>
  u.avatar ? `https://cdn.discordapp.com/avatars/${u.id}/${u.avatar}.png?size=64` : `https://cdn.discordapp.com/embed/avatars/${Number(BigInt(u.id) >> 22n) % 6}.png`
/** Nom de salon accepté par Discord : minuscules, tirets. */
const slug = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 90) || 'kollab'

// Signature de l'état OAuth (projet + personne), avec la clé partagée de la base.
async function key(db: SupabaseClient) {
  const { data } = await db.from('app_secrets').select('value').eq('name', 'discord_key').single()
  return data!.value as string
}
async function hmac(secret: string, text: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(text)))
  return btoa(String.fromCharCode(...sig)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]!)
}

// Entrées ----------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const url = new URL(req.url)
  const db = admin()

  if (req.method === 'GET') return callback(db, url)

  if (url.pathname.endsWith('/relay') || url.pathname.endsWith('/poll')) {
    if (req.headers.get('x-discord-key') !== (await key(db))) return fail('forbidden', 403)
    if (url.pathname.endsWith('/relay')) return relay(db, (await req.json()) as RelayBody)
    // Lecture en tâche de fond : la base n'attend pas la réponse.
    const work = poll(db).catch((e) => console.error('poll', e))
    ;(globalThis as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime?.waitUntil(work)
    return json({ ok: true }, 202)
  }

  // Appels de l'app, avec la session de la personne.
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: me } = await asUser.auth.getUser()
  if (!me.user) return fail('Connecte-toi d’abord.', 401)
  const body = (await req.json()) as { action: string; groupId: string; channelId?: string; discordChannelId?: string; create?: boolean }
  const { data: isMember } = await asUser.rpc('is_member', { gid: body.groupId })
  if (!isMember) return fail('forbidden', 403)
  const { data: isAdmin } = await asUser.rpc('is_admin', { gid: body.groupId })
  if (!Deno.env.get('DISCORD_BOT_TOKEN') || !Deno.env.get('DISCORD_CLIENT_ID')) return fail('Discord n’est pas encore activé sur Kollab.', 503)

  try {
    switch (body.action) {
      case 'start': {
        if (!isAdmin) return fail('Seul un admin relie Discord.', 403)
        const payload = btoa(JSON.stringify({ g: body.groupId, u: me.user.id, t: Date.now() }))
        const state = `${payload}.${await hmac(await key(db), payload)}`
        const q = new URLSearchParams({
          client_id: Deno.env.get('DISCORD_CLIENT_ID')!, scope: 'identify bot', permissions: PERMISSIONS,
          response_type: 'code', redirect_uri: SELF, state, prompt: 'consent', integration_type: '0',
        })
        return json({ url: `https://discord.com/oauth2/authorize?${q}` })
      }
      case 'channels': {
        const guild = await guildOf(db, body.groupId)
        if (!guild) return json({ channels: [] })
        const all = await bot<DChannel[]>(`/guilds/${guild}/channels`)
        const cats = new Map(all.filter((c) => c.type === 4).map((c) => [c.id, c.name]))
        const channels = all
          .filter((c) => c.type === 0 || c.type === 5)
          .sort((a, b) => a.position - b.position)
          .map((c) => ({ id: c.id, name: c.name, category: c.parent_id ? cats.get(c.parent_id) ?? null : null }))
        return json({ channels })
      }
      case 'link': {
        if (!isAdmin) return fail('Seul un admin relie un salon.', 403)
        const guild = await guildOf(db, body.groupId)
        if (!guild) return fail('Relie d’abord ton serveur Discord.')
        const { data: channel } = await db.from('channels').select('id, name').eq('id', body.channelId!).eq('group_id', body.groupId).maybeSingle()
        if (!channel) return fail('Salon introuvable.', 404)
        let target: DChannel
        if (body.create) {
          target = await bot<DChannel>(`/guilds/${guild}/channels`, { method: 'POST', body: JSON.stringify({ name: slug(channel.name), type: 0 }) })
        } else {
          target = await bot<DChannel>(`/channels/${body.discordChannelId}`)
          if ((target as DChannel & { guild_id?: string }).guild_id !== guild) return fail('Ce salon n’est pas sur ton serveur.')
        }
        const { data: taken } = await db.from('channel_discord').select('channel_id').eq('discord_channel_id', target.id).maybeSingle()
        if (taken && taken.channel_id !== channel.id) return fail('Ce salon Discord est déjà relié à un autre salon.')
        await attach(db, body.groupId, channel.id, target, me.user.id)
        return json({ channelId: channel.id, discordChannelId: target.id, discordChannelName: target.name })
      }
      case 'import': {
        // Tous les salons Discord deviennent des salons Kollab reliés ; même nom = même salon.
        if (!isAdmin) return fail('Seul un admin importe les salons.', 403)
        const guild = await guildOf(db, body.groupId)
        if (!guild) return fail('Relie d’abord ton serveur Discord.')
        const all = (await bot<DChannel[]>(`/guilds/${guild}/channels`)).filter((c) => c.type === 0 || c.type === 5).sort((a, b) => a.position - b.position)
        const { data: linked } = await db.from('channel_discord').select('channel_id, discord_channel_id').eq('group_id', body.groupId)
        const { data: mine } = await db.from('channels').select('id, name').eq('group_id', body.groupId).order('created_at')
        const usedK = new Set((linked ?? []).map((l) => l.channel_id as string))
        const usedD = new Set((linked ?? []).map((l) => l.discord_channel_id as string))
        let merged = 0, created = 0, failed = 0
        for (const d of all) {
          if (usedD.has(d.id)) continue
          try {
            let k = (mine ?? []).find((c) => !usedK.has(c.id) && same(c.name, d.name))
            if (k) merged++
            else {
              const { data, error } = await db.from('channels').insert({ group_id: body.groupId, name: d.name.slice(0, 40) }).select('id, name').single()
              if (error) throw error
              k = data
              created++
            }
            await attach(db, body.groupId, k!.id, d, me.user.id)
            usedK.add(k!.id)
            usedD.add(d.id)
          } catch (e) {
            failed++
            console.error('import', d.id, String(e))
          }
        }
        return json({ merged, created, failed })
      }
      case 'unlink': {
        if (!isAdmin) return fail('Seul un admin délie un salon.', 403)
        await unlink(db, body.groupId, body.channelId!)
        return json({ ok: true })
      }
      case 'disconnect': {
        if (!isAdmin) return fail('Seul un admin délie Discord.', 403)
        const { data: rows } = await db.from('channel_discord').select('channel_id').eq('group_id', body.groupId)
        for (const r of rows ?? []) await unlink(db, body.groupId, r.channel_id)
        const guild = await guildOf(db, body.groupId)
        await db.from('group_discord').delete().eq('group_id', body.groupId)
        // Le bot quitte le serveur s'il ne sert plus à aucun projet.
        const { count } = await db.from('group_discord').select('group_id', { count: 'exact', head: true }).eq('guild_id', guild ?? '')
        if (guild && !count) await bot(`/users/@me/guilds/${guild}`, { method: 'DELETE' }).catch(() => undefined)
        return json({ ok: true })
      }
      default:
        return fail('action inconnue')
    }
  } catch (e) {
    console.error(body.action, e)
    const m = String((e as Error).message ?? e)
    if (/discord 403/.test(m)) return fail('Le bot Kollab n’a pas le droit de faire ça sur ce salon.', 502)
    if (/discord 404/.test(m)) return fail('Discord ne trouve plus ce serveur ou ce salon.', 502)
    return fail('Discord ne répond pas, réessaie dans un instant.', 502)
  }
})

async function guildOf(db: SupabaseClient, groupId: string) {
  const { data } = await db.from('group_discord').select('guild_id').eq('group_id', groupId).maybeSingle()
  return (data?.guild_id as string | undefined) ?? null
}

/** Même salon des deux côtés : casse, accents, espaces et tirets ignorés. */
const same = (a: string, b: string) => {
  const n = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '-').replace(/^-|-$/g, '')
  return n(a) === n(b)
}

/** Relie un salon Kollab à un salon Discord : webhook « Kollab » créé, ancien webhook retiré. */
async function attach(db: SupabaseClient, groupId: string, channelId: string, target: DChannel, userId: string) {
  const old = await db.from('channel_discord').select('webhook_id, webhook_token').eq('channel_id', channelId).maybeSingle()
  const hook = await bot<{ id: string; token: string }>(`/channels/${target.id}/webhooks`, { method: 'POST', body: JSON.stringify({ name: 'Kollab' }) })
  const { error } = await db.from('channel_discord').upsert({
    channel_id: channelId, group_id: groupId, discord_channel_id: target.id, discord_channel_name: target.name,
    webhook_id: hook.id, webhook_token: hook.token, last_message_id: target.last_message_id ?? null, linked_by: userId, linked_at: new Date().toISOString(),
  })
  if (error) throw error
  if (old.data) await fetch(`${API}/webhooks/${old.data.webhook_id}/${old.data.webhook_token}`, { method: 'DELETE' }).catch(() => undefined)
}

async function unlink(db: SupabaseClient, groupId: string, channelId: string) {
  const { data } = await db.from('channel_discord').select('webhook_id, webhook_token').eq('channel_id', channelId).eq('group_id', groupId).maybeSingle()
  if (!data) return
  await fetch(`${API}/webhooks/${data.webhook_id}/${data.webhook_token}`, { method: 'DELETE' }).catch(() => undefined)
  await db.from('channel_discord').delete().eq('channel_id', channelId)
}

// Retour de Discord ----------------------------------------------------------------

async function callback(db: SupabaseClient, url: URL) {
  const back = (ok: boolean) => Response.redirect(`${APP}/?gh-popup=1&discord=${ok ? 'ok' : 'fail'}`, 302)
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state') ?? ''
  if (!code || url.searchParams.get('error')) return back(false)
  const [payload, sig] = state.split('.')
  if (!payload || sig !== (await hmac(await key(db), payload))) return back(false)
  const { g, u, t } = JSON.parse(atob(payload)) as { g: string; u: string; t: number }
  if (Date.now() - t > 15 * 60e3) return back(false)
  const { data: role } = await db.from('group_members').select('role').eq('group_id', g).eq('user_id', u).maybeSingle()
  if (role?.role !== 'admin') return back(false)

  // Le code ne vaut que pour Kollab : Discord confirme ainsi le serveur choisi.
  const res = await fetch(`${API}/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${btoa(`${Deno.env.get('DISCORD_CLIENT_ID')}:${Deno.env.get('DISCORD_CLIENT_SECRET')}`)}`,
    },
    body: new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: SELF }),
  })
  if (!res.ok) {
    console.error('token', res.status, await res.text().catch(() => ''))
    return back(false)
  }
  const token = (await res.json()) as { guild?: { id: string; name: string; icon: string | null } }
  if (!token.guild) return back(false)
  const { error } = await db.from('group_discord').upsert({
    group_id: g, guild_id: token.guild.id, guild_name: token.guild.name, guild_icon: token.guild.icon, linked_by: u, linked_at: new Date().toISOString(),
  })
  return back(!error)
}

// Kollab → Discord -----------------------------------------------------------------

type RelayBody = { messageId: string; op?: 'insert' | 'update' | 'delete' }

/** Texte Kollab lisible sur Discord : les tâches citées deviennent du gras. */
const toDiscord = (body: string) => body.replace(/\[#([^\]]{1,200})\]\(tache:[\w-]+\)/g, '**#$1**').slice(0, 2000)

async function relay(db: SupabaseClient, { messageId, op = 'insert' }: RelayBody) {
  const { data: m } = await db.from('messages').select('id, channel_id, author_id, body, deleted_at, discord_message_id, discord_author').eq('id', messageId).maybeSingle()
  if (!m || m.discord_author) return json({ skipped: true })
  const { data: link } = await db.from('channel_discord').select('webhook_id, webhook_token').eq('channel_id', m.channel_id).maybeSingle()
  if (!link) return json({ skipped: true })
  const hook = `${API}/webhooks/${link.webhook_id}/${link.webhook_token}`

  if (op !== 'insert') {
    if (!m.discord_message_id) return json({ skipped: true })
    const res = m.deleted_at || op === 'delete'
      ? await fetch(`${hook}/messages/${m.discord_message_id}`, { method: 'DELETE' })
      : await fetch(`${hook}/messages/${m.discord_message_id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: toDiscord(m.body), allowed_mentions: { parse: [] } }),
        })
    return json({ ok: res.ok }, res.ok ? 200 : 502)
  }

  if (m.discord_message_id || m.deleted_at) return json({ skipped: true })
  const { data: author } = await db.from('profiles').select('name, avatar_url').eq('id', m.author_id).maybeSingle()
  // Discord refuse « discord » dans un nom de webhook.
  const username = (author?.name || 'Kollab').replace(/discord/gi, 'D1scord').slice(0, 80)
  const res = await fetch(`${hook}?wait=true`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: toDiscord(m.body), username, avatar_url: author?.avatar_url ?? undefined, allowed_mentions: { parse: [] } }),
  })
  if (!res.ok) return json({ error: await res.text() }, 502)
  const sent = (await res.json()) as { id: string }
  await db.from('messages').update({ discord_message_id: sent.id }).eq('id', m.id)
  return json({ ok: true })
}

// Discord → Kollab -----------------------------------------------------------------

/** Texte Discord lisible dans Kollab : mentions, salons, émojis perso, pièces jointes. */
function fromDiscord(m: DMessage, names: Map<string, string>) {
  let text = m.content
    .replace(/<@!?(\d+)>/g, (_, id) => `@${names.get(id) ?? 'quelqu’un'}`)
    .replace(/<@&\d+>/g, '@rôle')
    .replace(/<#(\d+)>/g, '#salon')
    .replace(/<a?:(\w+):\d+>/g, ':$1:')
  for (const a of m.attachments) text += `${text ? '\n' : ''}${a.url}`
  return text.trim().slice(0, 4000)
}

async function poll(db: SupabaseClient) {
  const until = Date.now() + 55_000
  // Comptes Discord reliés à Kollab : leurs messages sont rangés à leur nom.
  const kollabOf = async (discordId: string, groupId: string) => {
    const { data } = await db.rpc('discord_member', { discord_id: discordId, gid: groupId })
    return (data as string | null) ?? null
  }
  const profileNames = new Map<string, string>()
  while (Date.now() < until) {
    const { data: links } = await db.from('channel_discord').select('channel_id, group_id, discord_channel_id, webhook_id, last_message_id')
    if (!links?.length) return
    for (const l of links) {
      try {
        const q = l.last_message_id ? `after=${l.last_message_id}&limit=50` : 'limit=1'
        const list = await bot<DMessage[]>(`/channels/${l.discord_channel_id}/messages?${q}`)
        if (!list.length) continue
        const fresh = [...list].sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1))
        if (l.last_message_id) {
          for (const m of fresh) {
            if (m.webhook_id === l.webhook_id) continue // nos propres envois
            if (m.type !== 0 && m.type !== 19) continue // messages normaux et réponses
            const names = new Map<string, string>()
            for (const u of m.mentions) {
              const kid = await kollabOf(u.id, l.group_id)
              if (kid && !profileNames.has(kid)) {
                const { data } = await db.from('profiles').select('name').eq('id', kid).maybeSingle()
                if (data?.name) profileNames.set(kid, data.name)
              }
              names.set(u.id, (kid && profileNames.get(kid)) || nameOf(u))
            }
            const body = fromDiscord(m, names)
            if (!body) continue
            const { error } = await db.from('messages').insert({
              group_id: l.group_id, channel_id: l.channel_id, author_id: await kollabOf(m.author.id, l.group_id),
              body, created_at: m.timestamp, discord_message_id: m.id,
              discord_author: { id: m.author.id, name: nameOf(m.author, m.member?.nick), avatar: avatarOf(m.author) },
            })
            if (error && error.code !== '23505') console.error('insert', error.message)
          }
        }
        await db.from('channel_discord').update({ last_message_id: fresh[fresh.length - 1].id }).eq('channel_id', l.channel_id)
      } catch (e) {
        console.error('salon', l.discord_channel_id, String(e))
      }
    }
    await new Promise((r) => setTimeout(r, 3000))
  }
}
