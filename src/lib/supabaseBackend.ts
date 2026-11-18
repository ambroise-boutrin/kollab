import { APP_BASE } from './base'
import { createClient, type SupabaseClient, type User as SbUser } from '@supabase/supabase-js'
import type { Backend, User, Workspace } from './backend'
import type { Invite, LinkItem, Member, Message, PresenceStatus, Provider, Role, Task } from './types'

interface TaskRow {
  id: string
  group_id: string
  title: string
  description: string
  status: Task['status']
  kind: Task['kind']
  points: number | null
  assignee_id: string | null
  pr_url: string | null
  position: number
  created_at: string
}

interface MessageRow {
  id: string
  channel_id: string
  author_id: string
  body: string
  created_at: string
}

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  kind: r.kind,
  points: r.points,
  assigneeId: r.assignee_id,
  prUrl: r.pr_url,
  position: r.position,
  createdAt: r.created_at,
})

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  channelId: r.channel_id,
  authorId: r.author_id,
  body: r.body,
  createdAt: r.created_at,
})

function toUser(u: SbUser | null | undefined): User | null {
  if (!u) return null
  const meta = u.user_metadata ?? {}
  return {
    id: u.id,
    name: meta.full_name ?? meta.user_name ?? meta.name ?? u.email?.split('@')[0] ?? 'Moi',
    email: u.email ?? null,
  }
}

function must<R extends { data: unknown; error: { message: string } | null }>(res: R): NonNullable<R['data']> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<R['data']>
}

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey)
  let groupId: string | null = null
  const redirectTo = `${window.location.origin}${APP_BASE}`

  return {
    mode: 'supabase',

    async currentUser() {
      const { data } = await sb.auth.getUser()
      return toUser(data.user)
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((_e, session) => cb(toUser(session?.user)))
      return () => data.subscription.unsubscribe()
    },

    async signIn(provider, email) {
      if (provider === 'email') {
        if (!email) throw new Error('Adresse email manquante')
        must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }))
        return { emailSent: true }
      }
      must(await sb.auth.signInWithOAuth({ provider, options: { redirectTo } }))
      return {}
    },

    async signOut() {
      await sb.auth.signOut()
    },

    async signInWithPassword(email, password) {
      const { error } = await sb.auth.signInWithPassword({ email, password })
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Email ou mot de passe incorrect' : error.message)
    },

    async signUp(email, password, name) {
      const data = must(await sb.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: redirectTo } }))
      return { confirmEmail: !data.session }
    },

    async sendPasswordReset(email) {
      must(await sb.auth.resetPasswordForEmail(email, { redirectTo: `${redirectTo}?nouveau-mot-de-passe=1` }))
    },

    async setPassword(password) {
      must(await sb.auth.updateUser({ password }))
    },

    async updateProfile(patch) {
      const { data } = await sb.auth.getUser()
      if (!data.user) return
      must(await sb.from('profiles').update(patch).eq('id', data.user.id))
    },

    async uploadAvatar(file) {
      const { data } = await sb.auth.getUser()
      if (!data.user) throw new Error('Non connecté')
      // Un nom unique à chaque envoi évite que l'ancienne photo reste en cache.
      const path = `${data.user.id}/${Date.now()}.webp`
      must(await sb.storage.from('avatars').upload(path, file, { contentType: file.type, upsert: true }))
      const url = sb.storage.from('avatars').getPublicUrl(path).data.publicUrl
      must(await sb.from('profiles').update({ avatar_url: url }).eq('id', data.user.id))
      return url
    },

    async removeAvatar() {
      const { data } = await sb.auth.getUser()
      if (!data.user) return
      must(await sb.from('profiles').update({ avatar_url: null }).eq('id', data.user.id))
    },

    async linkedProviders() {
      const { data } = await sb.auth.getUserIdentities()
      return (data?.identities ?? []).map((i) => i.provider as Provider)
    },

    async link(provider) {
      if (provider === 'email') throw new Error("L'email se relie depuis la connexion par lien magique.")
      must(await sb.auth.linkIdentity({ provider, options: { redirectTo: `${redirectTo}/reglages` } }))
    },

    async unlink(provider) {
      const { data } = await sb.auth.getUserIdentities()
      const identity = data?.identities.find((i) => i.provider === provider)
      if (!identity) return
      must(await sb.auth.unlinkIdentity(identity))
    },

    async loadWorkspace(): Promise<Workspace | null> {
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user) return null
      const membership = must(
        await sb.from('group_members').select('group_id').eq('user_id', auth.user.id).order('joined_at').limit(1),
      )
      if (!membership.length) return null
      groupId = membership[0].group_id as string

      const [group, members, tasks, channels, links] = await Promise.all([
        sb.from('groups').select('id, name, invite_code, discord_webhook_set').eq('id', groupId).single(),
        sb.from('group_members').select('user_id, role, profiles(name, color, title, status, avatar_url)').eq('group_id', groupId),
        sb.from('tasks').select('*').eq('group_id', groupId).order('position'),
        sb.from('channels').select('id, name').eq('group_id', groupId).order('created_at'),
        sb.from('links').select('id, title, url').eq('group_id', groupId).order('created_at'),
      ])
      const g = must(group)
      type MemberRow = {
        user_id: string
        role: Role
        profiles: { name: string; color: string; title: string; status: PresenceStatus; avatar_url: string | null } | null
      }
      return {
        group: { id: g.id, name: g.name, inviteCode: g.invite_code, discordWebhookSet: g.discord_webhook_set },
        members: (must(members) as unknown as MemberRow[]).map(
          (m): Member => ({
            id: m.user_id,
            name: m.profiles?.name ?? 'Membre',
            color: m.profiles?.color ?? '#5546E0',
            role: m.role,
            title: m.profiles?.title ?? '',
            status: m.profiles?.status ?? 'available',
            avatarUrl: m.profiles?.avatar_url ?? null,
          }),
        ),
        tasks: (must(tasks) as TaskRow[]).map(toTask),
        channels: must(channels),
        links: must(links) as LinkItem[],
      }
    },

    async createGroup(name) {
      must(await sb.rpc('create_group', { group_name: name }))
    },

    async joinGroup(code) {
      must(await sb.rpc('join_group', { code }))
    },

    live(gid, h) {
      const filter = `group_id=eq.${gid}`
      const ch = sb
        .channel(`group:${gid}`, { config: { presence: { key: gid } } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter }, (p) => {
          if (p.eventType === 'DELETE') h.onTaskDeleted((p.old as { id: string }).id)
          else h.onTask(toTask(p.new as TaskRow))
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (p) =>
          h.onMessage(toMessage(p.new as MessageRow)),
        )
        .on('presence', { event: 'sync' }, () => {
          const state = ch.presenceState<{ userId: string }>()
          h.onPresence(Object.values(state).flat().map((s) => s.userId))
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return
          const { data } = await sb.auth.getUser()
          if (data.user) await ch.track({ userId: data.user.id })
        })
      return () => {
        void sb.removeChannel(ch)
      }
    },

    async listInvites() {
      type Row = { id: string; code: string; role: Role; expires_at: string; max_uses: number | null; uses: number }
      const rows = must(await sb.from('invitations').select('*').eq('group_id', groupId).gt('expires_at', new Date().toISOString()).order('created_at'))
      return (rows as Row[]).map((r): Invite => ({ id: r.id, code: r.code, role: r.role, expiresAt: r.expires_at, maxUses: r.max_uses, uses: r.uses }))
    },

    async createInvite(role, { days, maxUses }) {
      const r = must(
        await sb
          .from('invitations')
          .insert({ group_id: groupId, role, max_uses: maxUses, expires_at: new Date(Date.now() + days * 86400000).toISOString() })
          .select()
          .single(),
      ) as { id: string; code: string; role: Role; expires_at: string; max_uses: number | null; uses: number }
      return { id: r.id, code: r.code, role: r.role, expiresAt: r.expires_at, maxUses: r.max_uses, uses: r.uses }
    },

    async revokeInvite(id) {
      must(await sb.from('invitations').delete().eq('id', id))
    },

    async setMemberRole(memberId, role) {
      must(await sb.rpc('set_member_role', { gid: groupId, member: memberId, new_role: role }))
    },

    async saveTask(task) {
      const row = {
        id: task.id,
        group_id: groupId,
        title: task.title,
        description: task.description,
        status: task.status,
        kind: task.kind,
        points: task.points,
        assignee_id: task.assigneeId,
        pr_url: task.prUrl,
        position: task.position,
      }
      return toTask(must(await sb.from('tasks').upsert(row).select().single()) as TaskRow)
    },

    async deleteTask(id) {
      must(await sb.from('tasks').delete().eq('id', id))
    },

    async listMessages(channelId) {
      const rows = must(
        await sb.from('messages').select('*').eq('channel_id', channelId).order('created_at').limit(200),
      )
      return (rows as MessageRow[]).map(toMessage)
    },

    async sendMessage(channelId, body) {
      const row = must(
        await sb.from('messages').insert({ channel_id: channelId, group_id: groupId, body }).select().single(),
      )
      return toMessage(row as MessageRow)
    },

    async addLink(title, url) {
      return must(await sb.from('links').insert({ title, url, group_id: groupId }).select('id, title, url').single()) as LinkItem
    },

    async removeLink(id) {
      must(await sb.from('links').delete().eq('id', id))
    },

    async setDiscordWebhook(webhook) {
      must(await sb.rpc('set_discord_webhook', { gid: groupId, webhook }))
    },

    async notifyDiscord(event) {
      if (!groupId) return
      // Best effort : une notification ratée ne doit pas bloquer l'action.
      await sb.functions.invoke('notify-discord', { body: { groupId, event } }).catch(() => undefined)
    },
  }
}
