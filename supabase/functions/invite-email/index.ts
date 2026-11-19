// Invitation par email, façon Canva.
// Crée l'invitation (fonction invite_email, avec les droits de l'appelant), puis envoie l'email par Resend.
// Si la personne a déjà un compte, elle reçoit aussi tout de suite la notification « Rejoindre / Refuser ».
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const ROLE: Record<string, string> = { admin: 'admin', member: 'membre', guest: 'invité' }

function html(inviter: string, group: string, role: string, url: string, assets: string) {
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Invitation</title></head>
<body style="margin:0;padding:0;background:#F5F6FA;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#14142B">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#FFFFFF;border:1px solid #E4E6EE;border-radius:16px">
<tr><td style="padding:32px 32px 8px"><img src="${assets}/logo.png" width="40" height="40" alt="Kollab" style="display:block;border:0"></td></tr>
<tr><td style="padding:16px 32px 0">
<h1 style="margin:0;font:700 24px/1.25 'Plus Jakarta Sans',Arial,sans-serif;letter-spacing:-0.02em">${esc(inviter)} t'invite à rejoindre ${esc(group)}</h1>
<p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:#4A4E63">Tu rejoindras l'équipe en tant que ${esc(ROLE[role] ?? 'membre')} sur Kollab : tâches, sprints, revues de code et chat.</p>
</td></tr>
<tr><td style="padding:24px 32px 8px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="border-radius:8px;background:#5546E0"><a href="${url}" style="display:inline-block;padding:14px 26px;font:600 16px Inter,Arial,sans-serif;color:#FFFFFF;text-decoration:none;border-radius:8px">Rejoindre l'équipe</a></td>
</tr></table></td></tr>
<tr><td style="padding:8px 32px 32px;font-size:13px;line-height:1.6;color:#8A90A2">L'invitation est valable 30 jours. Si tu ne connais pas ${esc(inviter)}, ignore simplement cet email.</td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: me } = await asUser.auth.getUser()
  if (!me.user) return json({ error: 'Connecte-toi pour inviter' }, 401)

  const { groupId, email, role } = (await req.json().catch(() => ({}))) as { groupId?: string; email?: string; role?: string }
  if (!groupId || !email) return json({ error: 'Adresse manquante' }, 400)

  const { data, error } = await asUser.rpc('invite_email', { gid: groupId, email, new_role: role ?? 'member' })
  if (error) return json({ error: error.message }, 400)
  const inv = data as { code: string; account: boolean; group: string; inviter: string }

  const key = Deno.env.get('RESEND_API_KEY')
  let emailed = false
  if (key) {
    const appUrl = (Deno.env.get('APP_URL') ?? 'https://kollab-tan-nu.vercel.app/app').replace(/\/$/, '')
    const assets = Deno.env.get('EMAIL_ASSETS_URL') ?? 'https://raw.githubusercontent.com/ambroise-boutrin/kollab/main/public/email'
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') ?? 'Kollab <onboarding@resend.dev>',
        to: [email.trim()],
        subject: `${inv.inviter} t'invite à rejoindre ${inv.group} sur Kollab`,
        html: html(inv.inviter, inv.group, role ?? 'member', `${appUrl}/?invitation=${inv.code}`, assets),
      }),
    }).catch(() => null)
    emailed = !!res?.ok
    if (res && !res.ok) console.error('resend', res.status, await res.text())
  }
  return json({ account: inv.account, emailed })
})
