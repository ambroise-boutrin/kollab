// Email de bienvenue, envoyé une seule fois quand un compte est activé.
// L'app l'appelle à chaque connexion ; la fonction note l'envoi dans app_metadata.welcomed.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'
import { sendEmail } from '../_shared/email.ts'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

  const meta = user.user_metadata ?? {}
  const r = await sendEmail({
    to: user.email,
    template: 'welcome',
    data: { name: meta.full_name ?? meta.name ?? meta.user_name ?? '' },
    userId: user.id,
    key: `welcome:${user.id}`,
  })
  if (!r.ok) return new Response('mail error', { status: 502, headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  await admin.auth.admin.updateUserById(user.id, { app_metadata: { ...user.app_metadata, welcomed: true } })
  return new Response('sent', { status: 200, headers: cors })
})
