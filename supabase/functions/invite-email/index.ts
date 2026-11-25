// Invitation par email, façon Canva.
// Crée l'invitation (fonction invite_email, avec les droits de l'appelant), puis envoie l'email par Resend.
// Si la personne a déjà un compte, elle reçoit aussi tout de suite la notification « Rejoindre / Refuser ».
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { appUrl, sendEmail } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

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

  const r = await sendEmail({
    to: email,
    template: 'group_invite',
    data: { inviter: inv.inviter, group: inv.group, role: role ?? 'member', url: `${appUrl()}/?invitation=${inv.code}` },
    groupId,
    userId: me.user.id,
  })
  const emailed = r.ok
  return json({ account: inv.account, emailed })
})
