// Envoi de tous les emails Kollab par Resend, avec un journal (table email_log).
// Usage : import { sendEmail } from '../_shared/email.ts'
//         await sendEmail({ to, template: 'payment_failed', data: {...}, groupId, key })
// Secrets : RESEND_API_KEY, MAIL_FROM (« Kollab <bonjour@ton-domaine> »), APP_URL, EMAIL_ASSETS_URL (facultatif).
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { render, templates, type Email, type TemplateName } from './email-templates.ts'

export { templates, type TemplateName }

export const appUrl = () => (Deno.env.get('APP_URL') ?? 'https://kollab-tan-nu.vercel.app/app').replace(/\/$/, '')
const assets = () => Deno.env.get('EMAIL_ASSETS_URL') ?? 'https://raw.githubusercontent.com/ambroise-boutrin/kollab/main/public/email'

let admin: ReturnType<typeof createClient> | null = null
const db = () => (admin ??= createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!))

export type SendResult = { ok: boolean; id?: string; error?: string; skipped?: boolean }

export async function sendEmail(opts: {
  to: string
  /** Nom du modèle ; 'weekly_summary' et autres cas particuliers passent leur propre email. */
  template: TemplateName | 'weekly_summary'
  data?: Record<string, unknown>
  /** Projet concerné, pour le journal. */
  groupId?: string | null
  userId?: string | null
  /** Clé anti-doublon : le même envoi (ex. id d'événement Stripe) ne part qu'une fois. */
  key?: string
  /** Remplace le modèle (cas particulier : résumé du lundi). */
  email?: Email
}): Promise<SendResult> {
  const to = opts.to?.trim()
  if (!to) return { ok: false, error: 'adresse manquante' }
  const apiKey = Deno.env.get('RESEND_API_KEY')

  if (opts.key) {
    const { data } = await db().from('email_log').select('id').eq('key', opts.key).eq('status', 'sent').maybeSingle()
    if (data) return { ok: true, skipped: true }
  }

  const email = opts.email ?? templates[opts.template as TemplateName]({ appUrl: appUrl(), url: appUrl(), ...(opts.data ?? {}) })
  const { html, text } = render(email, assets())

  let result: SendResult
  if (!apiKey) {
    result = { ok: false, error: 'RESEND_API_KEY absente' }
    console.error('email non envoyé : RESEND_API_KEY absente', opts.template)
  } else {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        ...(opts.key ? { 'Idempotency-Key': opts.key.slice(0, 256) } : {}),
      },
      body: JSON.stringify({
        from: Deno.env.get('MAIL_FROM') ?? 'Kollab <onboarding@resend.dev>',
        to: [to],
        reply_to: Deno.env.get('MAIL_REPLY_TO') ?? undefined,
        subject: email.subject,
        html,
        text,
        tags: [{ name: 'template', value: opts.template }],
        ...(email.unsubscribe ? { headers: { 'List-Unsubscribe': `<${email.unsubscribe}>` } } : {}),
      }),
    }).catch((e) => e as Error)
    if (res instanceof Error) {
      result = { ok: false, error: `réseau : ${res.message}` }
      console.error('email', opts.template, result.error)
    } else if (res.ok) {
      const body = (await res.json().catch(() => ({}))) as { id?: string }
      result = { ok: true, id: body.id }
    } else {
      result = { ok: false, error: `resend ${res.status} ${(await res.text()).slice(0, 300)}` }
      console.error('email', opts.template, result.error)
    }
  }

  await db().from('email_log').insert({
    template: opts.template,
    to_email: to,
    user_id: opts.userId ?? null,
    group_id: opts.groupId ?? null,
    key: opts.key ?? null,
    status: result.ok ? 'sent' : 'failed',
    provider_id: result.id ?? null,
    error: result.error ?? null,
  }).then(({ error }) => error && console.error('email_log', error.message))

  return result
}
