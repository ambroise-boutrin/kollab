// Résumé du lundi : pour chaque projet, tâches finies, PR fusionnées et ce qui traîne, envoyé à chaque membre.
// Appelée chaque lundi par pg_cron (clé x-weekly-key) ; ?dry=1 renvoie le HTML d'un projet sans rien envoyer.
// Envoi par Resend : secrets RESEND_API_KEY, MAIL_FROM et APP_URL, comme welcome-email.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { sendEmail } from '../_shared/email.ts'
import { esc, render, type Email } from '../_shared/email-templates.ts'

const DAY = 86_400_000
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const short = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`

type Task = { id: string; title: string; status: string; points: number | null; pr_url: string | null; assignee_ids: string[] | null; sprint_id: string | null; done_at: string | null; deleted_at: string | null }
type Sprint = { id: string; name: string; starts_on: string; ends_on: string; status: string; deleted_at: string | null }
type Summary = {
  group: string
  color: string
  from: Date
  to: Date
  done: number
  merged: { num: string; title: string; who: string }[]
  watch: { title: string; why: string }[]
  sprint: { name: string; pct: number; daysLeft: number } | null
}

function weeklyEmail(s: Summary, firstName: string, appUrl: string): Email {
  const tile = (n: number, label: string, color: string) => `<td valign="top" style="width:33%;background:#FFFFFF;border:1px solid #E7E9F0;border-radius:16px;padding:14px">
<div style="font:800 28px 'Plus Jakarta Sans',Arial,sans-serif;color:${color}">${n}</div><div style="font-size:12px;color:#6B7287">${label}</div></td>`
  const sprint = s.sprint
    ? `<tr><td style="padding:16px 0 0"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FFFFFF;border:1px solid #E7E9F0;border-radius:16px"><tr><td style="padding:16px">
<div style="font-weight:700;font-size:14px">${esc(s.sprint.name)} : ${s.sprint.pct} % des points</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0"><tr>
${s.sprint.pct > 0 ? `<td style="width:${s.sprint.pct}%;height:10px;background:#2E7D4F;border-radius:5px;font-size:0;line-height:0">&nbsp;</td>` : ''}
${s.sprint.pct < 100 ? `<td style="height:10px;background:#E7E9F0;border-radius:5px;font-size:0;line-height:0">&nbsp;</td>` : ''}
</tr></table>
<div style="font-size:13px;color:#6B7287">${s.sprint.daysLeft > 0 ? `Fin dans ${s.sprint.daysLeft} jour${s.sprint.daysLeft > 1 ? 's' : ''}` : 'Se termine aujourd’hui'}</div>
</td></tr></table></td></tr>`
    : ''
  const watch = s.watch.length
    ? `<tr><td style="padding:20px 0 0"><div style="font-weight:700;font-size:15px;margin-bottom:8px">À surveiller</div>
${s.watch.map((w) => `<div style="font-size:14px;padding:12px 14px;border-radius:14px;background:#FFFFFF;border:1px solid #E7E9F0;margin-bottom:8px"><b>${esc(w.title)}</b> · <span style="color:#C2413A;font-weight:600">${esc(w.why)}</span></div>`).join('')}</td></tr>`
    : ''
  const merged = s.merged.length
    ? `<tr><td style="padding:12px 0 0"><div style="font-weight:700;font-size:15px;margin-bottom:8px">Fusionnées</div>
${s.merged.map((m) => `<div style="font-size:14px;color:#6B7287;margin-bottom:6px">${m.num ? `<b style="color:#9B3FB8">#${esc(m.num)}</b> ` : ''}${esc(m.title)}${m.who ? ` · ${esc(m.who)}` : ''}</div>`).join('')}</td></tr>`
    : ''
  const body = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 4px">
<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
${tile(s.done, s.done > 1 ? 'tâches finies' : 'tâche finie', '#2E7D4F')}<td style="width:8px"></td>${tile(s.merged.length, s.merged.length > 1 ? 'PR fusionnées' : 'PR fusionnée', '#9B3FB8')}<td style="width:8px"></td>${tile(s.watch.length, 'en retard', '#C2413A')}
</tr></table></td></tr>
${sprint}${watch}${merged}
</table>`
  const email: Email = {
    subject: `Ta semaine sur ${s.group}`,
    preheader: `${s.done} tâche${s.done > 1 ? 's' : ''} finie${s.done > 1 ? 's' : ''}, ${s.merged.length} PR fusionnée${s.merged.length > 1 ? 's' : ''}, ${s.watch.length} à surveiller.`,
    tone: 'compte',
    kicker: `${s.group} · ${short(s.from)} – ${short(s.to)}`,
    title: `Ta semaine${firstName ? `, ${firstName}` : ''}`,
    lines: [],
    extraHtml: body,
    extraText: [`${s.done} tâche(s) finie(s), ${s.merged.length} PR fusionnée(s), ${s.watch.length} en retard.`, ...s.watch.map((w) => `À surveiller : ${w.title} (${w.why})`)].join('\n'),
    cta: { label: 'Ouvrir Kollab', url: appUrl },
    reason: 'Tu reçois ce résumé chaque lundi à 8 h.',
    unsubscribe: `${appUrl.replace(/\/$/, '')}/reglages`,
  }
  return email
}

Deno.serve(async (req) => {
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: secret } = await admin.from('app_secrets').select('value').eq('name', 'weekly_key').maybeSingle()
  if (!secret?.value || req.headers.get('x-weekly-key') !== secret.value) return new Response('unauthorized', { status: 401 })

  const url = new URL(req.url)
  const dry = url.searchParams.get('dry') === '1'
  const key = Deno.env.get('RESEND_API_KEY')
  if (!key && !dry) return new Response('no mail key', { status: 204 })
  const appUrl = Deno.env.get('APP_URL') ?? 'https://kollab-tan-nu.vercel.app/app'

  const now = Date.now()
  const weekAgo = new Date(now - 7 * DAY)
  const { data: groups } = await admin.from('groups').select('id, name, color').is('deleted_at', null)
  let sent = 0
  const emails = new Map<string, string | null>()

  for (const g of groups ?? []) {
    const [{ data: tasks }, { data: sprints }, { data: members }, { data: moves }] = await Promise.all([
      admin.from('tasks').select('id, title, status, points, pr_url, assignee_ids, sprint_id, done_at, deleted_at').eq('group_id', g.id).is('deleted_at', null),
      admin.from('sprints').select('id, name, starts_on, ends_on, status, deleted_at').eq('group_id', g.id).is('deleted_at', null),
      admin.from('group_members').select('user_id, profiles(name, weekly_email)').eq('group_id', g.id),
      admin.from('activity').select('target_id, meta, created_at').eq('group_id', g.id).eq('verb', 'moved').order('created_at', { ascending: false }).limit(500),
    ])
    const list = (tasks ?? []) as Task[]
    const finished = list.filter((t) => t.status === 'done' && t.done_at && new Date(t.done_at) >= weekAgo)
    // Rien bougé cette semaine : pas d'email.
    if (!finished.length && !list.some((t) => t.status !== 'done')) continue

    const people = new Map<string, string>((members ?? []).map((m: { user_id: string; profiles: { name: string } | null }) => [m.user_id, m.profiles?.name ?? '']))
    const firstOf = (ids: string[] | null) => (ids ?? []).map((id) => (people.get(id) ?? '').split(/\s+/)[0]).filter(Boolean).join(', ')
    const merged = finished
      .filter((t) => t.pr_url)
      .map((t) => ({ num: t.pr_url!.match(/\/pull\/(\d+)/)?.[1] ?? '', title: t.title, who: firstOf(t.assignee_ids) }))
      .slice(0, 6)

    const active = ((sprints ?? []) as Sprint[]).find((s) => s.status === 'active') ?? null
    let sprint: Summary['sprint'] = null
    if (active) {
      const its = list.filter((t) => t.sprint_id === active.id)
      const total = its.reduce((n, t) => n + (t.points ?? 0), 0)
      const done = its.filter((t) => t.status === 'done').reduce((n, t) => n + (t.points ?? 0), 0)
      sprint = { name: active.name, pct: total ? Math.round((done / total) * 100) : 0, daysLeft: Math.max(0, Math.ceil((new Date(`${active.ends_on}T23:59:59Z`).getTime() - now) / DAY)) }
    }

    // À surveiller : en revue depuis 3 jours ou plus, ou personne dessus dans le sprint en cours.
    const lastMove = new Map<string, { to: string; at: string }>()
    for (const m of (moves ?? []) as { target_id: string; meta: { to?: string }; created_at: string }[]) {
      if (!lastMove.has(m.target_id)) lastMove.set(m.target_id, { to: m.meta?.to ?? '', at: m.created_at })
    }
    const watch: Summary['watch'] = []
    for (const t of list) {
      if (t.status === 'review') {
        const mv = lastMove.get(t.id)
        const days = mv?.to === 'review' ? Math.floor((now - new Date(mv.at).getTime()) / DAY) : 0
        if (days >= 3) watch.push({ title: t.title, why: `en revue depuis ${days} j` })
      } else if (active && t.sprint_id === active.id && t.status !== 'done' && !(t.assignee_ids ?? []).length) {
        watch.push({ title: t.title, why: 'personne dessus' })
      }
    }
    if (active && sprint && sprint.daysLeft <= 0 && sprint.pct < 100) watch.unshift({ title: active.name, why: 'fin dépassée' })

    const summary: Summary = { group: g.name, color: g.color ?? '#5546E0', from: weekAgo, to: new Date(now - DAY), done: finished.length, merged, watch: watch.slice(0, 5), sprint }

    if (dry) return new Response(render(weeklyEmail(summary, '', appUrl), Deno.env.get('EMAIL_ASSETS_URL') ?? 'https://raw.githubusercontent.com/ambroise-boutrin/kollab/main/public/email').html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })

    for (const m of (members ?? []) as { user_id: string; profiles: { name: string; weekly_email: boolean | null } | null }[]) {
      if (m.profiles?.weekly_email === false) continue
      if (!emails.has(m.user_id)) {
        const { data } = await admin.auth.admin.getUserById(m.user_id)
        emails.set(m.user_id, data.user?.email_confirmed_at ? data.user.email ?? null : null)
      }
      const to = emails.get(m.user_id)
      if (!to) continue
      const first = (m.profiles?.name ?? '').trim().split(/\s+/)[0] ?? ''
      const res = await sendEmail({ to, template: 'weekly_summary', email: weeklyEmail(summary, first, appUrl), groupId: g.id, userId: m.user_id, key: `weekly:${g.id}:${m.user_id}:${short(new Date(now))}` })
      if (res.ok) sent++
      // Resend limite à quelques envois par seconde.
      await new Promise((r) => setTimeout(r, 600))
    }
  }
  return new Response(JSON.stringify({ sent }), { headers: { 'Content-Type': 'application/json' } })
})
