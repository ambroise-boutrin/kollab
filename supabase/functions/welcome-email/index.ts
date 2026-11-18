// Email de bienvenue, envoyé une seule fois quand un compte est activé.
// L'app l'appelle à chaque connexion ; la fonction note l'envoi dans app_metadata.welcomed.
// Envoi par Resend : secrets RESEND_API_KEY, MAIL_FROM (ex. « Kollab <bonjour@ton-domaine.fr> ») et APP_URL.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

function welcomeHtml(firstName: string, appUrl: string) {
  const step = (n: number, title: string, text: string) => `
<tr><td style="padding:0 0 14px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td valign="top" style="width:28px"><div style="width:28px;height:28px;border-radius:50%;background:#EEECFD;color:#5546E0;font:700 13px/28px Inter,Arial,sans-serif;text-align:center">${n}</div></td>
<td style="padding-left:12px;font-size:15px;line-height:1.5;color:#4A4E63"><strong style="color:#14142B">${title}</strong><br>${text}</td>
</tr></table></td></tr>`
  return `<!doctype html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bienvenue sur Kollab</title></head>
<body style="margin:0;padding:0;background:#F5F6FA;font-family:Inter,'Segoe UI',Arial,sans-serif;color:#14142B">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">Ton compte est prêt. Voici comment bien démarrer avec ton équipe.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px">
<tr><td style="padding:0 8px 20px"><table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:36px;height:36px;border-radius:11px;background:#5546E0;color:#fff;font:800 20px/36px 'Plus Jakarta Sans',Arial,sans-serif;text-align:center">K</td>
<td style="padding-left:10px;font:800 20px 'Plus Jakarta Sans',Arial,sans-serif;color:#14142B;letter-spacing:-0.02em">Kollab</td>
</tr></table></td></tr>
<tr><td style="background:#5546E0;border-radius:24px 24px 0 0;padding:36px 32px 28px;color:#FFFFFF">
<p style="margin:0 0 8px;font:600 14px Inter,Arial,sans-serif;color:#FFD23F">Ton compte est activé</p>
<h1 style="margin:0;font:800 30px/1.12 'Plus Jakarta Sans',Arial,sans-serif;letter-spacing:-0.03em;color:#FFFFFF">Bienvenue sur Kollab${firstName ? `, ${esc(firstName)}` : ''} !</h1>
</td></tr>
<tr><td style="background:#FFFFFF;border-radius:0 0 24px 24px;padding:28px 32px 32px">
<p style="margin:0 0 22px;font-size:16px;line-height:1.6;color:#4A4E63">Ton équipe, ton code et tes sprints sont maintenant au même endroit. Trois étapes pour bien démarrer :</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
${step(1, 'Crée ton groupe', 'ou rejoins celui d’un collègue avec son lien d’invitation.')}
${step(2, 'Invite ton équipe', 'en choisissant les droits de chacun : admin, membre ou invité.')}
${step(3, 'Ajoute tes premières tâches', 'sur le tableau, puis attribue-les.')}
</table>
<table role="presentation" cellpadding="0" cellspacing="0" style="margin:14px 0 6px"><tr>
<td style="border-radius:14px;background:#5546E0"><a href="${appUrl}" style="display:inline-block;padding:15px 28px;font:600 16px Inter,Arial,sans-serif;color:#FFFFFF;text-decoration:none;border-radius:14px">Ouvrir Kollab</a></td>
</tr></table>
<p style="margin:18px 0 0;font-size:14px;line-height:1.6;color:#8A90A2">Kollab existe aussi en appli pour Windows, Mac et Linux, et s’installe sur ton téléphone depuis le navigateur.</p>
</td></tr>
<tr><td style="padding:20px 8px 0;font-size:12px;line-height:1.6;color:#8A90A2;text-align:center">Kollab, l'espace de travail des équipes de dev.</td></tr>
</table></td></tr></table></body></html>`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data } = await asUser.auth.getUser()
  const user = data.user
  if (!user?.email) return new Response('unauthorized', { status: 401, headers: cors })
  // Pas encore activé, ou déjà accueilli : rien à faire.
  if (!user.email_confirmed_at || user.app_metadata?.welcomed) return new Response(null, { status: 204, headers: cors })

  const key = Deno.env.get('RESEND_API_KEY')
  if (!key) return new Response(null, { status: 204, headers: cors })

  const meta = user.user_metadata ?? {}
  const fullName: string = meta.full_name ?? meta.name ?? meta.user_name ?? ''
  const firstName = fullName.trim().split(/\s+/)[0] ?? ''
  const appUrl = Deno.env.get('APP_URL') ?? 'https://kollab-tan-nu.vercel.app/app'

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: Deno.env.get('MAIL_FROM') ?? 'Kollab <onboarding@resend.dev>',
      to: [user.email],
      subject: `Bienvenue sur Kollab${firstName ? `, ${firstName}` : ''} !`,
      html: welcomeHtml(firstName, appUrl),
    }),
  })
  if (!res.ok) return new Response('mail error', { status: 502, headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, welcomed: true } })
  return new Response('sent', { status: 200, headers: cors })
})
