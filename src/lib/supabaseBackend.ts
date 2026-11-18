import { setGhToken } from './github'
import { APP_BASE } from './base'
import { createClient, type SupabaseClient, type User as SbUser } from '@supabase/supabase-js'
import type { Backend, User, Workspace } from './backend'
import { CGU_VERSION } from './legal'
import type { AppNotification, Invite, ReactionChange, LinkItem, Member, Message, PresenceStatus, Provider, Role, Task } from './types'

interface TaskRow {
  id: string
  group_id: string
  title: string
  description: string
  status: Task['status']
  kind: Task['kind']
  points: number | null
  assignee_ids: string[] | null
  deleted_at?: string | null
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
  edited_at?: string | null
  deleted_at?: string | null
}

const toTask = (r: TaskRow): Task => ({
  id: r.id,
  title: r.title,
  description: r.description,
  status: r.status,
  kind: r.kind,
  points: r.points,
  assigneeIds: r.assignee_ids ?? [],
  prUrl: r.pr_url,
  position: r.position,
  createdAt: r.created_at,
})

interface NotificationRow {
  id: string; kind: AppNotification['kind']; title: string; body: string; link: string | null
  group_id: string | null; actor_id: string | null; data: AppNotification['data'] | null; read_at: string | null; created_at: string
}
const toNotification = (r: NotificationRow): AppNotification => ({
  id: r.id, kind: r.kind, title: r.title, body: r.body, link: r.link, groupId: r.group_id, actorId: r.actor_id,
  data: r.data ?? {}, readAt: r.read_at, createdAt: r.created_at,
})

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  channelId: r.channel_id,
  authorId: r.author_id,
  body: r.deleted_at ? '' : r.body,
  createdAt: r.created_at,
  editedAt: r.edited_at ?? null,
  deletedAt: r.deleted_at ?? null,
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

/** Lire les PR et checks, commenter, relancer la CI (dépôts privés compris). */
const GITHUB_SCOPES = 'repo read:user user:email'

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey)
  let groupId: string | null = null
  let liveChannel: ReturnType<typeof sb.channel> | null = null
  let chatReady = false
  const redirectTo = `${window.location.origin}${APP_BASE}`

  return {
    mode: 'supabase',

    async currentUser() {
      const { data } = await sb.auth.getUser()
      return toUser(data.user)
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        // L'écran de connexion vaut acceptation des CGU : on enregistre la version acceptée.
        const u = session?.user
        // Jeton GitHub : Supabase ne le donne qu'au retour de GitHub, on le garde pour l'API.
        const latest = [...(u?.identities ?? [])].sort((a, b) => String(b.last_sign_in_at ?? '').localeCompare(String(a.last_sign_in_at ?? '')))[0]
        if (session?.provider_token && latest?.provider === 'github') setGhToken(session.provider_token)
        if (event === 'SIGNED_OUT') setGhToken(null)
        // Email de bienvenue, une seule fois après l'activation (la fonction vérifie elle-même).
        if (event === 'SIGNED_IN' && u?.email_confirmed_at && !u.app_metadata?.welcomed) {
          setTimeout(() => void sb.functions.invoke('welcome-email').catch(() => {}), 0)
        }
        if (event === 'SIGNED_IN' && u && u.user_metadata?.cgu_version !== CGU_VERSION) {
          setTimeout(() => void sb.auth.updateUser({ data: { cgu_version: CGU_VERSION, cgu_accepted_at: new Date().toISOString() } }), 0)
        }
        cb(toUser(u))
      })
      return () => data.subscription.unsubscribe()
    },

    async signIn(provider, email) {
      if (provider === 'email') {
        if (!email) throw new Error('Adresse email manquante')
        must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }))
        return { emailSent: true }
      }
      must(await sb.auth.signInWithOAuth({ provider, options: { redirectTo, ...(provider === 'github' ? { scopes: GITHUB_SCOPES } : {}) } }))
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
      const terms = { cgu_version: CGU_VERSION, cgu_accepted_at: new Date().toISOString() }
      const data = must(await sb.auth.signUp({ email, password, options: { data: { full_name: name, ...terms }, emailRedirectTo: redirectTo } }))
      return { confirmEmail: !data.session }
    },

    async sendPasswordReset(email) {
      must(await sb.auth.resetPasswordForEmail(email, { redirectTo: `${redirectTo}?nouveau-mot-de-passe=1` }))
    },

    async setPassword(password) {
      must(await sb.auth.updateUser({ password }))
    },

    async deleteAccount() {
      const { error } = await sb.functions.invoke('delete-account')
      if (error) throw new Error('Suppression impossible pour le moment')
      await sb.auth.signOut()
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
      must(await sb.auth.linkIdentity({ provider, options: { redirectTo: `${redirectTo}/reglages`, ...(provider === 'github' ? { scopes: GITHUB_SCOPES } : {}) } }))
    },

    async connectGitHub() {
      const linked = (await sb.auth.getUserIdentities()).data?.identities.some((i) => i.provider === 'github')
      const options = { redirectTo: window.location.href, scopes: GITHUB_SCOPES }
      if (linked) must(await sb.auth.signInWithOAuth({ provider: 'github', options }))
      else must(await sb.auth.linkIdentity({ provider: 'github', options }))
    },

    async unlink(provider) {
      const { data } = await sb.auth.getUserIdentities()
      const identity = data?.identities.find((i) => i.provider === provider)
      if (!identity) return
      must(await sb.auth.unlinkIdentity(identity))
    },

    async listGroups() {
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user) return []
      type Row = { group_id: string; role: Role; groups: { name: string } | null }
      const rows = must(
        await sb.from('group_members').select('group_id, role, groups(name)').eq('user_id', auth.user.id).order('joined_at'),
      ) as unknown as Row[]
      return rows.map((r) => ({ id: r.group_id, name: r.groups?.name ?? 'Projet', role: r.role }))
    },

    async loadWorkspace(wanted?: string | null): Promise<Workspace | null> {
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user) return null
      const memberships = must(
        await sb.from('group_members').select('group_id').eq('user_id', auth.user.id).order('joined_at'),
      ) as { group_id: string }[]
      if (!memberships.length) return null
      groupId = (memberships.find((m) => m.group_id === wanted) ?? memberships[0]).group_id

      const [group, members, tasks, channels, links] = await Promise.all([
        sb.from('groups').select('id, name, invite_code, discord_webhook_set').eq('id', groupId).single(),
        sb.from('group_members').select('user_id, role, profiles(name, color, title, status, avatar_url)').eq('group_id', groupId),
        sb.from('tasks').select('*').eq('group_id', groupId).order('position'),
        sb.from('channels').select('id, name').eq('group_id', groupId).order('created_at'),
        sb.from('links').select('*').eq('group_id', groupId).order('created_at'),
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
        tasks: (must(tasks) as TaskRow[]).filter((r) => !r.deleted_at).map(toTask),
        channels: must(channels),
        links: (must(links) as (LinkItem & { deleted_at?: string | null })[]).filter((l) => !l.deleted_at).map(({ id, title, url }) => ({ id, title, url })),
      }
    },

    async createGroup(name, setup) {
      const gid = must(
        await sb.rpc('create_project', { group_name: name, ...(setup?.channels?.length ? { channel_names: setup.channels } : {}) }),
      ) as string
      const tasks = (setup?.tasks ?? []).map((t, i) => ({ ...t, group_id: gid, description: '', position: i }))
      if (tasks.length) must(await sb.from('tasks').insert(tasks))
      if (setup?.repoUrl) must(await sb.from('links').insert({ group_id: gid, title: 'Dépôt GitHub', url: setup.repoUrl }))
      return gid
    },

    async joinGroup(code) {
      return must(await sb.rpc('join_group', { code })) as string
    },

    async renameGroup(name) {
      must(await sb.from('groups').update({ name: name.trim() }).eq('id', groupId))
    },

    async leaveGroup() {
      const { data: auth } = await sb.auth.getUser()
      must(await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', auth.user!.id))
    },

    async deleteGroup() {
      must(await sb.from('groups').delete().eq('id', groupId))
    },

    live(gid, h) {
      const filter = `group_id=eq.${gid}`
      let timer: ReturnType<typeof setTimeout> | undefined
      const refresh = () => {
        clearTimeout(timer)
        timer = setTimeout(() => h.onRefresh(), 300)
      }
      const ch = sb
        .channel(`group:${gid}`, { config: { presence: { key: gid } } })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks', filter }, (p) => {
          if (p.eventType === 'DELETE') return
          const row = p.new as TaskRow
          if (row.deleted_at) h.onTaskDeleted(row.id)
          else h.onTask(toTask(row))
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter }, (p) =>
          h.onMessage(toMessage(p.new as MessageRow)),
        )
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter }, (p) => h.onMessageUpdated(toMessage(p.new as MessageRow)))
        // Suppressions et réactions : diffusées par la personne qui agit (les suppressions ne sont pas filtrables côté base).
        .on('broadcast', { event: 'task-deleted' }, ({ payload }) => h.onTaskDeleted((payload as { id: string }).id))
        .on('broadcast', { event: 'reaction' }, ({ payload }) => h.onReaction(payload as ReactionChange))
        .on('broadcast', { event: 'message-updated' }, ({ payload }) => {
          void sb.from('messages').select('*').eq('id', (payload as { id: string }).id).single().then(({ data }) => data && h.onMessageUpdated(toMessage(data as MessageRow)))
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'links', filter }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'channels', filter }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${gid}` }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, refresh)
        .on('presence', { event: 'sync' }, () => {
          const state = ch.presenceState<{ userId: string }>()
          h.onPresence(Object.values(state).flat().map((s) => s.userId))
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return
          const { data } = await sb.auth.getUser()
          if (data.user) await ch.track({ userId: data.user.id })
        })
      liveChannel = ch
      return () => {
        clearTimeout(timer)
        if (liveChannel === ch) liveChannel = null
        void sb.removeChannel(ch)
      }
    },

    async listNotifications() {
      const rows = must(await sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(50))
      return (rows as NotificationRow[]).map(toNotification)
    },

    async markNotificationsRead(ids) {
      if (ids.length) must(await sb.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids))
    },

    async deleteNotification(id) {
      must(await sb.from('notifications').delete().eq('id', id))
    },

    watchNotifications(onNew) {
      let ch: ReturnType<typeof sb.channel> | null = null
      let stopped = false
      void sb.auth.getUser().then(({ data }) => {
        if (stopped || !data.user) return
        ch = sb
          .channel(`notifs:${data.user.id}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${data.user.id}` }, (p) =>
            onNew(toNotification(p.new as NotificationRow)),
          )
          .subscribe()
      })
      return () => {
        stopped = true
        if (ch) void sb.removeChannel(ch)
      }
    },

    async inviteByEmail(email, role) {
      return must(await sb.rpc('invite_by_email', { gid: groupId, email, new_role: role })) as boolean
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
        assignee_ids: task.assigneeIds,
        assignee_id: task.assigneeIds[0] ?? null,
        pr_url: task.prUrl,
        position: task.position,
      }
      return toTask(must(await sb.from('tasks').upsert(row).select().single()) as TaskRow)
    },

    async deleteTask(id) {
      must(await sb.from('tasks').delete().eq('id', id))
      liveChannel?.send({ type: 'broadcast', event: 'task-deleted', payload: { id } })
    },

    async listMessages(channelId) {
      // Les 200 derniers, du plus ancien au plus récent.
      const rows = (must(
        await sb.from('messages').select('*').eq('channel_id', channelId).order('created_at', { ascending: false }).limit(200),
      ) as MessageRow[]).reverse()
      const messages = rows.map(toMessage)
      const ids = messages.map((m) => m.id)
      if (!ids.length) return messages
      const { data, error } = await sb.from('message_reactions').select('message_id, user_id, emoji').in('message_id', ids).order('created_at')
      chatReady = !error
      const byMsg = new Map<string, Map<string, string[]>>()
      for (const r of (data ?? []) as { message_id: string; user_id: string; emoji: string }[]) {
        const m = byMsg.get(r.message_id) ?? new Map<string, string[]>()
        m.set(r.emoji, [...(m.get(r.emoji) ?? []), r.user_id])
        byMsg.set(r.message_id, m)
      }
      return messages.map((m) => ({ ...m, reactions: [...(byMsg.get(m.id) ?? new Map()).entries()].map(([emoji, userIds]) => ({ emoji, userIds })) }))
    },

    async sendMessage(channelId, body) {
      const row = must(
        await sb.from('messages').insert({ channel_id: channelId, group_id: groupId, body }).select().single(),
      )
      return toMessage(row as MessageRow)
    },

    chatActions: () => chatReady,

    async editMessage(id, body) {
      must(await sb.from('messages').update({ body }).eq('id', id))
      liveChannel?.send({ type: 'broadcast', event: 'message-updated', payload: { id } })
    },

    async deleteMessage(id) {
      must(await sb.from('messages').delete().eq('id', id))
      liveChannel?.send({ type: 'broadcast', event: 'message-updated', payload: { id } })
    },

    async react(messageId, emoji, on) {
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user) return
      if (on) must(await sb.from('message_reactions').upsert({ message_id: messageId, group_id: groupId, user_id: auth.user.id, emoji }, { ignoreDuplicates: true }))
      else must(await sb.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', auth.user.id).eq('emoji', emoji))
      liveChannel?.send({ type: 'broadcast', event: 'reaction', payload: { messageId, emoji, userId: auth.user.id, on } })
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
