// Envoie une notification dans le salon Discord relié au groupe.
// Le webhook est lu côté serveur (table group_secrets), jamais exposé au navigateur.
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

type Event =
  | { type: 'task_assigned'; taskTitle: string; assignee: string }
  | { type: 'task_done'; taskTitle: string }
  | { type: 'pr_linked'; taskTitle: string; prUrl: string }

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function format(e: Event): { title: string; description: string; color: number } {
  switch (e.type) {
    case 'task_assigned':
      return { title: 'Tâche attribuée', description: `**${e.taskTitle}** → ${e.assignee}`, color: 0x5546e0 }
    case 'task_done':
      return { title: 'Tâche terminée', description: `**${e.taskTitle}** est passée en Terminé`, color: 0x2e7d4f }
    case 'pr_linked':
      return { title: 'PR liée', description: `**${e.taskTitle}**\n${e.prUrl}`, color: 0x2f6fd0 }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  const { groupId, event } = (await req.json()) as { groupId: string; event: Event }
  const auth = req.headers.get('Authorization') ?? ''

  // Vérifie que l'appelant est bien membre du groupe, avec ses propres droits.
  const asUser = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: auth } },
  })
  const { data: isMember } = await asUser.rpc('is_member', { gid: groupId })
  if (!isMember) return new Response('forbidden', { status: 403, headers: cors })

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const { data: secret } = await admin.from('group_secrets').select('discord_webhook').eq('group_id', groupId).maybeSingle()
  if (!secret?.discord_webhook) return new Response('no webhook', { status: 204, headers: cors })

  const embed = format(event)
  const res = await fetch(secret.discord_webhook, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'Kollab', embeds: [embed], allowed_mentions: { parse: [] } }),
  })
  return new Response(res.ok ? 'sent' : 'discord error', { status: res.ok ? 200 : 502, headers: cors })
})
