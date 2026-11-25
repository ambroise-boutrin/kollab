// Hook « Send Email » de Supabase Auth : tous les emails de compte (activation, mot de passe,
// lien magique, changement d'email, code, alertes de sécurité) passent par ici, au design Kollab, via Resend.
// À brancher dans Supabase › Authentication › Hooks › Send Email (HTTPS) ; secret SEND_EMAIL_HOOK_SECRET.
// Déployer sans vérification JWT (verify_jwt = false) : l'appel est signé par Supabase (Standard Webhooks).
import { Webhook } from 'npm:standardwebhooks@1.0.0'
import { appUrl, sendEmail, type TemplateName } from '../_shared/email.ts'

type HookUser = { id: string; email: string; new_email?: string; user_metadata?: Record<string, string> }
type EmailData = {
  token: string
  token_hash: string
  redirect_to: string
  email_action_type: string
  site_url: string
  token_new: string
  token_hash_new: string
  old_email?: string
  provider?: string
  factor_type?: string
}

const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'not allowed' }, 405)
  const secret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '')
  const payload = await req.text()

  let user: HookUser, d: EmailData
  try {
    ;({ user, email_data: d } = new Webhook(secret).verify(payload, Object.fromEntries(req.headers)) as { user: HookUser; email_data: EmailData })
  } catch {
    return json({ error: { http_code: 401, message: 'signature invalide' } }, 401)
  }

  const verify = (hash: string, type: string) =>
    `${Deno.env.get('SUPABASE_URL')}/auth/v1/verify?token=${hash}&type=${type}&redirect_to=${encodeURIComponent(d.redirect_to || d.site_url || appUrl())}`
  const meta = user.user_metadata ?? {}
  const name = meta.full_name ?? meta.name ?? meta.user_name ?? ''
  const base = { name, email: user.email, at: new Date().toISOString() }

  // Liste des envois à faire : [adresse, modèle, données]
  const jobs: [string, TemplateName, Record<string, unknown>][] = []
  switch (d.email_action_type) {
    case 'signup':
      jobs.push([user.email, 'signup', { ...base, url: verify(d.token_hash, 'signup') }])
      break
    case 'magiclink':
    case 'email':
      jobs.push([user.email, 'magiclink', { ...base, url: verify(d.token_hash, 'magiclink') }])
      break
    case 'recovery':
      jobs.push([user.email, 'recovery', { ...base, url: verify(d.token_hash, 'recovery') }])
      break
    case 'invite':
      jobs.push([user.email, 'invite', { ...base, url: verify(d.token_hash, 'invite') }])
      break
    case 'email_change': {
      // Attention, noms inversés côté Supabase : token_hash_new va avec l'adresse actuelle, token_hash avec la nouvelle.
      const both = d.token_hash && d.token_hash_new
      const change = { ...base, oldEmail: user.email, newEmail: user.new_email ?? '' }
      if (both) {
        jobs.push([user.email, 'email_change_current', { ...change, url: verify(d.token_hash_new, 'email_change') }])
        jobs.push([user.new_email ?? '', 'email_change_new', { ...change, url: verify(d.token_hash, 'email_change') }])
      } else {
        jobs.push([user.new_email ?? '', 'email_change_new', { ...change, url: verify(d.token_hash || d.token_hash_new, 'email_change') }])
      }
      break
    }
    case 'reauthentication':
      jobs.push([user.email, 'reauthentication', { ...base, code: d.token }])
      break
    case 'password_changed_notification':
      jobs.push([user.email, 'password_changed', base])
      break
    case 'email_changed_notification':
      // Prévenir l'ancienne adresse : c'est elle qui doit pouvoir réagir.
      jobs.push([d.old_email || user.email, 'email_changed', { ...base, oldEmail: d.old_email ?? '', newEmail: user.email }])
      break
    case 'identity_linked_notification':
      jobs.push([user.email, 'identity_linked', { ...base, provider: d.provider }])
      break
    case 'identity_unlinked_notification':
      jobs.push([user.email, 'identity_unlinked', { ...base, provider: d.provider }])
      break
    case 'mfa_factor_enrolled_notification':
    case 'mfa_factor_unenrolled_notification':
      jobs.push([user.email, 'mfa_changed', { ...base, added: d.email_action_type.includes('_enrolled') && !d.email_action_type.includes('unenrolled') }])
      break
    default:
      // Type inconnu (ex. téléphone) : rien à envoyer, mais on ne bloque pas Supabase.
      return json({})
  }

  for (const [to, template, data] of jobs) {
    const r = await sendEmail({ to, template, data, userId: user.id })
    if (!r.ok) return json({ error: { http_code: 500, message: `Email non envoyé (${r.error})` } }, 500)
  }
  return json({})
})
