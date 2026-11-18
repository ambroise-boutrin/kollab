import { newId, type Backend, type TrashItem, type GroupSetup, type LiveHandlers, type User, type Workspace } from './backend'
import type { AppNotification, Invite, ReactionChange, LinkItem, Member, Message, Provider, Task } from './types'

/**
 * Mode démo : tout est stocké dans le navigateur. Plusieurs onglets ouverts
 * se synchronisent en direct, ce qui permet d'essayer le temps réel sans serveur.
 */

const KEY = 'kollab-demo-v1'
const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kollab-demo') : null

interface DemoState {
  invites?: Invite[]
  user: User | null
  providers: Provider[]
  workspace: Workspace | null
  messages: Message[]
  /** Les autres projets de l'utilisateur ; `workspace` est le projet ouvert. */
  others?: { workspace: Workspace; messages: Message[] }[]
  notifications?: AppNotification[]
  trash?: TrashItem[]
  trashedTasks?: Task[]
}

const ME: Member = { id: 'me', name: 'Moi', color: '#5546E0', role: 'admin', title: 'Product Owner', status: 'available', avatarUrl: null }
const TEAM: Member[] = [
  { id: 'lm', name: 'Léa Martin', color: '#2E7D4F', role: 'member', title: 'Développeuse front', status: 'available', avatarUrl: null },
  { id: 'sk', name: 'Sami Benali', color: '#2F6FD0', role: 'member', title: 'Développeur back', status: 'busy', avatarUrl: null },
  { id: 'yo', name: 'Yohann Petit', color: '#B5462E', role: 'guest', title: 'Client', status: 'away', avatarUrl: null },
]

function seed(user: User): Workspace {
  const now = new Date().toISOString()
  const t = (title: string, status: Task['status'], kind: Task['kind'], points: number, assignees: string[], position: number): Task => ({
    id: newId(), title, description: '', status, kind, points, assigneeIds: assignees, prUrl: null, position, createdAt: now,
  })
  return {
    group: { id: 'demo', name: 'Mon équipe', inviteCode: 'KOLLAB-DEMO', discordWebhookSet: false },
    members: [{ ...ME, name: user.name }, ...TEAM],
    tasks: [
      t('Page de connexion GitHub', 'todo', 'feature', 5, [], 0),
      t('Table des groupes', 'todo', 'feature', 3, ['sk'], 1),
      t('Le menu se ferme mal sur iPhone', 'todo', 'bug', 2, [], 2),
      t('Tableau kanban glisser-déposer', 'doing', 'feature', 8, ['lm', 'me'], 0),
      t('Invitations par lien', 'doing', 'feature', 5, ['me'], 1),
      t('Visionneuse PDF', 'review', 'feature', 5, ['lm', 'me'], 0),
      t('Choisir le stack', 'done', 'research', 2, ['me'], 0),
    ],
    channels: [
      { id: 'general', name: 'général' },
      { id: 'code', name: 'revues-de-code' },
      { id: 'sprint', name: 'sprint' },
    ],
    links: [
      { id: newId(), title: 'Dépôt GitHub', url: 'https://github.com/ambroise-boutrin/kollab' },
    ],
  }
}

function seedMessages(w?: Workspace): Message[] {
  const at = (min: number) => new Date(Date.now() - min * 60000).toISOString()
  const ref = (title: string) => {
    const t = w?.tasks.find((x) => x.title === title)
    return t ? `[#${t.title}](tache:${t.id})` : `#${title}`
  }
  return [
    { id: newId(), channelId: 'general', authorId: 'sk', body: 'Bonjour tout le monde, point rapide à 10 h ?', createdAt: at(60 * 20) },
    { id: newId(), channelId: 'general', authorId: 'me', body: 'Ok pour moi 👍', createdAt: at(60 * 20 - 3), reactions: [{ emoji: '👍', userIds: ['sk', 'lm'] }] },
    { id: newId(), channelId: 'general', authorId: 'lm', body: `Salut ! ${ref('Visionneuse PDF')} est prête, @Moi tu peux relire ?`, createdAt: at(42), reactions: [{ emoji: '🎉', userIds: ['sk'] }, { emoji: '👀', userIds: ['me'] }] },
    { id: newId(), channelId: 'general', authorId: 'sk', body: `Je prends ${ref('Table des groupes')} cet après-midi.`, createdAt: at(30) },
    { id: newId(), channelId: 'general', authorId: 'me', body: 'Parfait, je relis la PDF juste après le déjeuner.', createdAt: at(12) },
    { id: newId(), channelId: 'code', authorId: 'lm', body: `Le glisser-déposer marche sur mobile, reste ${ref('Le menu se ferme mal sur iPhone')}.`, createdAt: at(90) },
  ]
}

function read(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const s = JSON.parse(raw) as DemoState
      // Anciennes données : une seule personne par tâche.
      for (const w of [s.workspace, ...(s.others ?? []).map((o) => o.workspace)]) {
        for (const t of w?.tasks ?? []) {
          const old = t as Task & { assigneeId?: string | null }
          if (!old.assigneeIds) old.assigneeIds = old.assigneeId ? [old.assigneeId] : []
        }
      }
      return s
    }
  } catch {
    /* stockage indisponible : on repart de zéro */
  }
  return { user: null, providers: [], workspace: null, messages: [] }
}

function write(state: DemoState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* navigation privée : les données restent en mémoire */
  }
}

type BusEvent =
  | { kind: 'task'; task: Task }
  | { kind: 'taskDeleted'; id: string }
  | { kind: 'message'; message: Message }
  | { kind: 'auth' }
  | { kind: 'profile' }
  | { kind: 'refresh' }
  | { kind: 'messageUpdated'; message: Message }
  | { kind: 'reaction'; change: ReactionChange }
  | { kind: 'notification'; notification: AppNotification }

function emit(event: BusEvent) {
  bus?.postMessage(event)
}

const authListeners = new Set<(u: User | null) => void>()
bus?.addEventListener('message', (e: MessageEvent<BusEvent>) => {
  if (e.data.kind === 'auth' || e.data.kind === 'profile') authListeners.forEach((cb) => cb(read().user))
})

function update(fn: (s: DemoState) => void): DemoState {
  const s = read()
  fn(s)
  write(s)
  return s
}

/**
 * Démo sans inscription (`/app/?demo=1`) : connecte un utilisateur fictif et
 * remplit une équipe d'exemple, pour arriver directement sur l'outil.
 */
export function startDemoSession() {
  const s = read()
  if (s.user && s.workspace) return
  const user: User = { id: 'me', name: 'Moi', email: null }
  const workspace = seed(user)
  workspace.group.name = 'Équipe Kollab'
  const at = (min: number) => new Date(Date.now() - min * 60000).toISOString()
  const notifications: AppNotification[] = [
    { id: newId(), kind: 'mention', title: 'Léa Martin t\'a mentionné dans #général', body: 'Salut ! La visionneuse PDF est prête, @Moi tu peux relire ?', link: '/chat?salon=general', groupId: 'demo', actorId: 'lm', data: {}, readAt: null, createdAt: at(42) },
    { id: newId(), kind: 'assigned', title: 'Visionneuse PDF', body: 'Léa Martin t\'a attribué cette tâche', link: `/tableau?tache=${workspace.tasks.find((t) => t.title === 'Visionneuse PDF')?.id}`, groupId: 'demo', actorId: 'lm', data: {}, readAt: null, createdAt: at(50) },
  ]
  write({ ...s, user, providers: ['email'], workspace, messages: seedMessages(workspace), notifications })
}

export const demoBackend: Backend = {
  mode: 'demo',

  async currentUser() {
    return read().user
  },

  onAuthChange(cb) {
    authListeners.add(cb)
    return () => authListeners.delete(cb)
  },

  async signIn(provider, email) {
    const name = provider === 'email' && email ? email.split('@')[0] : 'Moi'
    const user: User = { id: 'me', name, email: email ?? null }
    update((s) => {
      s.user = user
      if (!s.providers.includes(provider)) s.providers.push(provider)
    })
    authListeners.forEach((cb) => cb(user))
    emit({ kind: 'auth' })
    return {}
  },

  async signOut() {
    update((s) => {
      s.user = null
    })
    authListeners.forEach((cb) => cb(null))
    emit({ kind: 'auth' })
  },

  async signInWithPassword(email, password) {
    if (password.length < 8) throw new Error('Email ou mot de passe incorrect')
    await demoBackend.signIn('email', email)
  },

  async signUp(email, password, name) {
    if (password.length < 8) throw new Error('Le mot de passe doit faire au moins 8 caractères')
    await demoBackend.signIn('email', email)
    await demoBackend.updateProfile({ name })
    update((s) => {
      if (s.user) s.user.name = name
    })
    return { confirmEmail: false }
  },

  async sendPasswordReset() {
    // Rien à envoyer en mode démo.
  },

  async setPassword(password) {
    if (password.length < 8) throw new Error('Le mot de passe doit faire au moins 8 caractères')
  },

  async deleteAccount() {
    write({ user: null, providers: [], workspace: null, messages: [] })
    authListeners.forEach((cb) => cb(null))
    emit({ kind: 'auth' })
  },

  async updateProfile(patch) {
    update((s) => {
      const me = s.workspace?.members.find((m) => m.id === 'me')
      if (me) Object.assign(me, patch)
      if (s.user && patch.name) s.user.name = patch.name
    })
    emit({ kind: 'profile' })
  },

  async uploadAvatar(file) {
    const url = await new Promise<string>((resolve, reject) => {
      const r = new FileReader()
      r.onload = () => resolve(String(r.result))
      r.onerror = () => reject(new Error('Image illisible'))
      r.readAsDataURL(file)
    })
    update((s) => {
      const me = s.workspace?.members.find((m) => m.id === 'me')
      if (me) me.avatarUrl = url
    })
    emit({ kind: 'profile' })
    return url
  },

  async removeAvatar() {
    update((s) => {
      const me = s.workspace?.members.find((m) => m.id === 'me')
      if (me) me.avatarUrl = null
    })
    emit({ kind: 'profile' })
  },

  async linkedProviders() {
    return read().providers
  },

  async link(provider) {
    update((s) => {
      if (!s.providers.includes(provider)) s.providers.push(provider)
    })
  },

  async unlink(provider) {
    update((s) => {
      s.providers = s.providers.filter((p) => p !== provider)
    })
  },

  async listGroups() {
    const s = read()
    const all = [s.workspace, ...(s.others ?? []).map((o) => o.workspace)].filter((w): w is Workspace => !!w)
    return all
      .map((w) => ({ id: w.group.id, name: w.group.name, role: w.members.find((m) => m.id === 'me')?.role ?? 'admin' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  },

  async connectGitHub() {
    throw new Error('Indisponible en démo : les dépôts publics restent lisibles')
  },

  async loadWorkspace(wanted) {
    const s = read()
    if (wanted && s.workspace && s.workspace.group.id !== wanted) {
      const i = (s.others ?? []).findIndex((o) => o.workspace.group.id === wanted)
      if (i >= 0) {
        update((st) => {
          const target = st.others!.splice(i, 1)[0]
          if (st.workspace) st.others!.push({ workspace: st.workspace, messages: st.messages })
          st.workspace = target.workspace
          st.messages = target.messages
        })
      }
    }
    return read().workspace
  },

  async createGroup(name, setup?: GroupSetup) {
    let id = ''
    update((s) => {
      if (!s.user) return
      if (s.workspace) (s.others ??= []).push({ workspace: s.workspace, messages: s.messages })
      const preset = !!setup
      const w = seed(s.user)
      id = w.group.id = newId()
      w.group.name = name
      w.group.inviteCode = `KOLLAB-${id.slice(0, 4).toUpperCase()}`
      if (preset) {
        // Un vrai nouveau projet : seulement toi, les salons et tâches du modèle.
        w.members = w.members.filter((m) => m.id === 'me')
        w.channels = (setup.channels?.length ? setup.channels : ['général']).map((n, i) => ({ id: i === 0 ? 'general' : newId(), name: n }))
        const now = new Date().toISOString()
        w.tasks = (setup.tasks ?? []).map((t, i) => ({ ...t, id: newId(), description: '', assigneeIds: [], prUrl: null, position: i, createdAt: now }))
        w.links = setup.repoUrl ? [{ id: newId(), title: 'Dépôt GitHub', url: setup.repoUrl }] : []
      }
      s.workspace = w
      s.messages = preset ? [] : seedMessages()
    })
    return id
  },

  async joinGroup() {
    let id = ''
    update((s) => {
      if (!s.user) return
      if (s.workspace) (s.others ??= []).push({ workspace: s.workspace, messages: s.messages })
      s.workspace = seed(s.user)
      id = s.workspace.group.id = newId()
      s.workspace.group.name = 'Équipe de démonstration'
      s.workspace.members = s.workspace.members.map((m) => (m.id === 'me' ? { ...m, role: 'member' } : m))
      s.messages = seedMessages()
    })
    return id
  },

  async renameGroup(name) {
    update((s) => {
      if (s.workspace) s.workspace.group.name = name.trim()
    })
  },

  async leaveGroup() {
    update((s) => {
      const next = s.others?.shift()
      s.workspace = next?.workspace ?? null
      s.messages = next?.messages ?? []
    })
  },

  async deleteGroup() {
    await demoBackend.leaveGroup()
  },

  live(_groupId, h: LiveHandlers) {
    const onBus = (e: MessageEvent<BusEvent>) => {
      const ev = e.data
      if (ev.kind === 'task') h.onTask(ev.task)
      else if (ev.kind === 'taskDeleted') h.onTaskDeleted(ev.id)
      else if (ev.kind === 'message') h.onMessage(ev.message)
      else if (ev.kind === 'refresh') h.onRefresh()
      else if (ev.kind === 'messageUpdated') h.onMessageUpdated(ev.message)
      else if (ev.kind === 'reaction') h.onReaction(ev.change)
    }
    bus?.addEventListener('message', onBus)
    // Faux membres en ligne, pour voir la présence s'animer.
    h.onPresence(['me', 'lm', 'sk'])
    return () => bus?.removeEventListener('message', onBus)
  },

  async listNotifications() {
    return read().notifications ?? []
  },

  async markNotificationsRead(ids) {
    const at = new Date().toISOString()
    update((s) => {
      for (const n of s.notifications ?? []) if (ids.includes(n.id) && !n.readAt) n.readAt = at
    })
  },

  async deleteNotification(id) {
    update((s) => {
      s.notifications = (s.notifications ?? []).filter((n) => n.id !== id)
    })
  },

  watchNotifications(onNew) {
    const onBus = (e: MessageEvent<BusEvent>) => e.data.kind === 'notification' && onNew(e.data.notification)
    bus?.addEventListener('message', onBus)
    return () => bus?.removeEventListener('message', onBus)
  },

  async inviteByEmail() {
    return false
  },

  async listInvites() {
    return read().invites ?? []
  },

  async createInvite(role, { days, maxUses }) {
    const invite: Invite = {
      id: newId(),
      code: Math.random().toString(16).slice(2, 14).toUpperCase(),
      role,
      expiresAt: new Date(Date.now() + days * 86400000).toISOString(),
      maxUses,
      uses: 0,
    }
    update((s) => {
      s.invites = [...(s.invites ?? []), invite]
    })
    return invite
  },

  async revokeInvite(id) {
    update((s) => {
      s.invites = (s.invites ?? []).filter((i) => i.id !== id)
    })
  },

  async setMemberRole(memberId, role) {
    update((s) => {
      const m = s.workspace?.members.find((x) => x.id === memberId)
      if (!m) return
      const admins = s.workspace!.members.filter((x) => x.role === 'admin' && x.id !== memberId)
      if (role !== 'admin' && admins.length === 0) throw new Error('Le groupe doit garder au moins un admin')
      m.role = role
    })
  },

  async saveTask(task) {
    update((s) => {
      if (!s.workspace) return
      const i = s.workspace.tasks.findIndex((t) => t.id === task.id)
      if (i >= 0) s.workspace.tasks[i] = task
      else s.workspace.tasks.push(task)
    })
    emit({ kind: 'task', task })
    return task
  },

  async deleteTask(id) {
    update((s) => {
      const task = s.workspace?.tasks.find((t) => t.id === id)
      if (task) {
        s.trash = [{ kind: 'task', id, title: task.title, deletedAt: new Date().toISOString(), deletedBy: 'me' }, ...(s.trash ?? [])]
        s.trashedTasks = [...(s.trashedTasks ?? []), task]
      }
      if (s.workspace) s.workspace.tasks = s.workspace.tasks.filter((t) => t.id !== id)
    })
    emit({ kind: 'taskDeleted', id })
  },

  async listMessages(channelId) {
    return read().messages.filter((m) => m.channelId === channelId).map((m) => (m.deletedAt ? { ...m, body: '' } : m))
  },

  async sendMessage(channelId, body) {
    const message: Message = { id: newId(), channelId, authorId: 'me', body, createdAt: new Date().toISOString() }
    update((s) => {
      s.messages.push(message)
    })
    emit({ kind: 'message', message })
    return message
  },

  chatActions: () => true,

  async editMessage(id, body) {
    let changed: Message | undefined
    update((s) => {
      const m = s.messages.find((x) => x.id === id && x.authorId === 'me')
      if (m) {
        m.body = body
        m.editedAt = new Date().toISOString()
        changed = { ...m }
      }
    })
    if (changed) emit({ kind: 'messageUpdated', message: changed })
  },

  async deleteMessage(id) {
    let changed: Message | undefined
    update((s) => {
      const m = s.messages.find((x) => x.id === id && x.authorId === 'me')
      if (m) {
        m.deletedAt = new Date().toISOString()
        changed = { ...m, body: '' }
      }
    })
    if (changed) emit({ kind: 'messageUpdated', message: changed })
  },

  async react(messageId, emoji, on) {
    update((s) => {
      const m = s.messages.find((x) => x.id === messageId)
      if (!m) return
      const list = m.reactions ?? []
      const r = list.find((x) => x.emoji === emoji)
      if (on && !r) list.push({ emoji, userIds: ['me'] })
      else if (on && r && !r.userIds.includes('me')) r.userIds.push('me')
      else if (!on && r) r.userIds = r.userIds.filter((u) => u !== 'me')
      m.reactions = list.filter((x) => x.userIds.length)
    })
    emit({ kind: 'reaction', change: { messageId, emoji, userId: 'me', on } })
  },

  async createChannel(name) {
    const channel = { id: newId(), name: name.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 40) }
    update((s) => {
      s.workspace?.channels.push(channel)
    })
    emit({ kind: 'refresh' })
    return channel
  },

  async listTrash() {
    return read().trash ?? []
  },

  async restoreItem(_kind, id) {
    update((s) => {
      const item = (s.trash ?? []).find((t) => t.id === id)
      s.trash = (s.trash ?? []).filter((t) => t.id !== id)
      const task = (s.trashedTasks ?? []).find((t) => t.id === id)
      if (item && task && s.workspace) s.workspace.tasks.push(task)
      s.trashedTasks = (s.trashedTasks ?? []).filter((t) => t.id !== id)
    })
    emit({ kind: 'refresh' })
  },

  async listDeletedGroups() {
    return []
  },

  async restoreGroup() {},

  async addLink(title, url) {
    const link: LinkItem = { id: newId(), title, url }
    update((s) => {
      s.workspace?.links.push(link)
    })
    emit({ kind: 'refresh' })
    return link
  },

  async removeLink(id) {
    update((s) => {
      if (s.workspace) s.workspace.links = s.workspace.links.filter((l) => l.id !== id)
    })
    emit({ kind: 'refresh' })
  },

  async setDiscordWebhook(url) {
    update((s) => {
      if (s.workspace) s.workspace.group.discordWebhookSet = !!url
    })
  },

  async notifyDiscord() {
    // Rien à envoyer en mode démo.
  },
}
