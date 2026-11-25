// « Pendant ton absence » : toutes les 30 min (pg_cron, clé x-notify-key), regroupe en un seul email
// les mentions, tâches attribuées et arrivées restées non lues depuis plus d'une heure.
// Chaque notification n'est envoyée qu'une fois (colonne emailed_at). Coupable dans Réglages.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { appUrl, sendEmail } from '../_shared/email.ts'

type Notif = { id: string; user_id: string; group_id: string | null; kind: string; title: string; body: string; data: Record<string, string> | null; created_at: string }

const label = (n: Notif) => {
  if (n.kind === 'assigned') return n.body.replace('cette tâche', `« ${n.title.slice(0, 60)} »`)
  if (n.kind === 'joined') return n.data?.titleRequest ? n.title : n.body
  return n.title
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: secret } = await admin.from('app_secrets').select('value').eq('name', 'notify_key').maybeSingle()
  if (!secret?.value || req.headers.get('x-notify-key') !== secret.value) return new Response('unauthorized', { status: 401 })

  const now = Date.now()
  const { data: rows, error } = await admin
    .from('notifications')
    .select('id, user_id, group_id, kind, title, body, data, created_at')
    .in('kind', ['mention', 'assigned', 'joined'])
    .is('read_at', null)
    .is('emailed_at', null)
    .lt('created_at', new Date(now - 60 * 60_000).toISOString())
    .gt('created_at', new Date(now - 3 * 86_400_000).toISOString())
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) return new Response(error.message, { status: 500 })

  const byUser = new Map<string, Notif[]>()
  for (const n of (rows ?? []) as Notif[]) byUser.set(n.user_id, [...(byUser.get(n.user_id) ?? []), n])
  if (!byUser.size) return Response.json({ sent: 0 })

  const groupIds = [...new Set((rows ?? []).map((n: Notif) => n.group_id).filter(Boolean))] as string[]
  const { data: groups } = await admin.from('groups').select('id, name').in('id', groupIds)
  const gname = new Map((groups ?? []).map((g: { id: string; name: string }) => [g.id, g.name]))
  const { data: profiles } = await admin.from('profiles').select('id, name, missed_email').in('id', [...byUser.keys()])
  const prof = new Map((profiles ?? []).map((p: { id: string; name: string; missed_email: boolean | null }) => [p.id, p]))

  let sent = 0
  for (const [uid, list] of byUser) {
    const ids = list.map((n) => n.id)
    const p = prof.get(uid)
    // Coupé par la personne : on marque quand même, pour ne pas tout envoyer d'un coup si elle réactive.
    if (p?.missed_email === false) {
      await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).in('id', ids)
      continue
    }
    const { data: u } = await admin.auth.admin.getUserById(uid)
    const to = u.user?.email_confirmed_at ? u.user.email : null
    if (to) {
      const r = await sendEmail({
        to,
        template: 'unread_digest',
        data: {
          name: p?.name ?? '',
          count: list.length,
          items: list.map((n) => ({ label: label(n), group: gname.get(n.group_id ?? '') ?? '' })),
          unsubscribe: `${appUrl()}/reglages`,
        },
        userId: uid,
        key: `digest:${uid}:${ids.sort()[0]}`,
      })
      if (!r.ok) continue
      sent++
      await new Promise((res) => setTimeout(res, 600))
    }
    await admin.from('notifications').update({ emailed_at: new Date().toISOString() }).in('id', ids)
  }
  return Response.json({ sent })
})
