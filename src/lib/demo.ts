import { newId, type Backend, type LiveHandlers, type User, type Workspace } from './backend'
import type { Invite, LinkItem, Member, Message, Provider, Task } from './types'

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
}

const ME: Member = { id: 'me', name: 'Moi', color: '#5546E0', role: 'admin', title: 'Product Owner', status: 'available', avatarUrl: null }
const TEAM: Member[] = [
  { id: 'lm', name: 'Léa Martin', color: '#2E7D4F', role: 'member', title: 'Développeuse front', status: 'available', avatarUrl: null },
  { id: 'sk', name: 'Sami Benali', color: '#2F6FD0', role: 'member', title: 'Développeur back', status: 'busy', avatarUrl: null },
  { id: 'yo', name: 'Yohann Petit', color: '#B5462E', role: 'guest', title: 'Client', status: 'away', avatarUrl: null },
]

function seed(user: User): Workspace {
  const now = new Date().toISOString()
  const t = (title: string, status: Task['status'], kind: Task['kind'], points: number, assigneeId: string | null, position: number): Task => ({
    id: newId(), title, description: '', status, kind, points, assigneeId, prUrl: null, position, createdAt: now,
  })
  return {
    group: { id: 'demo', name: 'Mon équipe', inviteCode: 'KOLLAB-DEMO', discordWebhookSet: false },
    members: [{ ...ME, name: user.name }, ...TEAM],
    tasks: [
      t('Page de connexion GitHub', 'todo', 'feature', 5, null, 0),
      t('Table des groupes', 'todo', 'feature', 3, 'sk', 1),
      t('Le menu se ferme mal sur iPhone', 'todo', 'bug', 2, null, 2),
      t('Tableau kanban glisser-déposer', 'doing', 'feature', 8, 'lm', 0),
      t('Invitations par lien', 'doing', 'feature', 5, 'me', 1),
      t('Visionneuse PDF', 'review', 'feature', 5, 'lm', 0),
      t('Choisir le stack', 'done', 'research', 2, 'me', 0),
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

function seedMessages(): Message[] {
  const at = (min: number) => new Date(Date.now() - min * 60000).toISOString()
  return [
    { id: newId(), channelId: 'general', authorId: 'lm', body: 'Salut ! La visionneuse PDF est prête, @Moi tu peux relire ?', createdAt: at(42) },
    { id: newId(), channelId: 'general', authorId: 'sk', body: 'Je prends la table des groupes cet après-midi.', createdAt: at(30) },
  ]
}

function read(): DemoState {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return JSON.parse(raw) as DemoState
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
  write({ ...s, user, providers: ['email'], workspace, messages: seedMessages() })
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

  async loadWorkspace() {
    return read().workspace
  },

  async createGroup(name) {
    update((s) => {
      if (!s.user) return
      s.workspace = seed(s.user)
      s.workspace.group.name = name
      s.messages = seedMessages()
    })
  },

  async joinGroup() {
    update((s) => {
      if (!s.user) return
      s.workspace = seed(s.user)
      s.messages = seedMessages()
    })
  },

  live(_groupId, h: LiveHandlers) {
    const onBus = (e: MessageEvent<BusEvent>) => {
      const ev = e.data
      if (ev.kind === 'task') h.onTask(ev.task)
      else if (ev.kind === 'taskDeleted') h.onTaskDeleted(ev.id)
      else if (ev.kind === 'message') h.onMessage(ev.message)
    }
    bus?.addEventListener('message', onBus)
    // Faux membres en ligne, pour voir la présence s'animer.
    h.onPresence(['me', 'lm', 'sk'])
    return () => bus?.removeEventListener('message', onBus)
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
      if (s.workspace) s.workspace.tasks = s.workspace.tasks.filter((t) => t.id !== id)
    })
    emit({ kind: 'taskDeleted', id })
  },

  async listMessages(channelId) {
    return read().messages.filter((m) => m.channelId === channelId)
  },

  async sendMessage(channelId, body) {
    const message: Message = { id: newId(), channelId, authorId: 'me', body, createdAt: new Date().toISOString() }
    update((s) => {
      s.messages.push(message)
    })
    emit({ kind: 'message', message })
    return message
  },

  async addLink(title, url) {
    const link: LinkItem = { id: newId(), title, url }
    update((s) => {
      s.workspace?.links.push(link)
    })
    return link
  },

  async removeLink(id) {
    update((s) => {
      if (s.workspace) s.workspace.links = s.workspace.links.filter((l) => l.id !== id)
    })
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
