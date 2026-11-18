// Supprime le compte de l'utilisateur connecté, comme le prévoient les CGU.
// Ses groupes ne restent jamais sans admin : un autre membre est promu, et un groupe vide est supprimé.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  })
  const { data: auth } = await asUser.auth.getUser()
  const uid = auth.user?.id
  if (!uid) return new Response('unauthorized', { status: 401, headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { data: memberships } = await admin.from('group_members').select('group_id, role').eq('user_id', uid)
  for (const m of memberships ?? []) {
    const { data: others } = await admin
      .from('group_members')
      .select('user_id, role')
      .eq('group_id', m.group_id)
      .neq('user_id', uid)
      .order('joined_at')
    if (!others?.length) {
      await admin.from('groups').delete().eq('id', m.group_id)
    } else if (m.role === 'admin' && !others.some((o) => o.role === 'admin')) {
      const next = others.find((o) => o.role === 'member') ?? others[0]
      await admin.from('group_members').update({ role: 'admin' }).eq('group_id', m.group_id).eq('user_id', next.user_id)
    }
  }

  const { data: files } = await admin.storage.from('avatars').list(uid)
  if (files?.length) await admin.storage.from('avatars').remove(files.map((f) => `${uid}/${f.name}`))

  const { error } = await admin.auth.admin.deleteUser(uid)
  if (error) return new Response(error.message, { status: 500, headers: cors })
  return new Response('deleted', { status: 200, headers: cors })
})
