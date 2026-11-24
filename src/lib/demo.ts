import { newId, type Backend, type RoomEvent, type TrashItem, type GroupSetup, type LiveHandlers, type User, type Workspace } from './backend'
import type { ActivityItem, DiscordChannel, DiscordGuild, DiscordLink, AppNotification, EmailInvite, DocumentItem, Note, Sprint, Invite, ReactionChange, LinkItem, Member, Message, Provider, Task, TaskComment } from './types'

/**
 * Mode démo : tout est stocké dans le navigateur. Plusieurs onglets ouverts
 * se synchronisent en direct, ce qui permet d'essayer le temps réel sans serveur.
 */

const KEY = 'kollab-demo-v1'

/** Note une action dans l'historique de démo. */
function logAct(s: DemoState, verb: string, target: string, label: string | null, meta: Record<string, string> = {}, targetId: string | null = null) {
  s.activity = [{ id: newId(), actorId: 'me', verb, target, targetId, label, meta, createdAt: new Date().toISOString() }, ...(s.activity ?? [])].slice(0, 300)
}
const bus = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('kollab-demo') : null

interface DemoState {
  invites?: Invite[]
  emailInvites?: EmailInvite[]
  user: User | null
  providers: Provider[]
  workspace: Workspace | null
  messages: Message[]
  comments?: TaskComment[]
  /** Les autres projets de l'utilisateur ; `workspace` est le projet ouvert. */
  others?: { workspace: Workspace; messages: Message[] }[]
  notifications?: AppNotification[]
  trash?: TrashItem[]
  trashedTasks?: Task[]
  trashedDocs?: DocumentItem[]
  trashedNotes?: Note[]
  trashedLinks?: LinkItem[]
  /** Historique des actions (le plus récent d'abord). */
  activity?: ActivityItem[]
  /** Contenu des documents texte (base64 Yjs). */
  noteStates?: Record<string, string>
  /** Discord simulé : serveur et salons reliés. */
  discord?: { guild: DiscordGuild | null; links: DiscordLink[] }
}

const DEMO_DISCORD: DiscordChannel[] = [
  { id: 'd-general', name: 'général', category: 'Équipe' },
  { id: 'd-dev', name: 'dev', category: 'Équipe' },
  { id: 'd-annonces', name: 'annonces', category: 'Équipe' },
  { id: 'd-design', name: 'design', category: 'Projets' },
  { id: 'd-bugs', name: 'bugs', category: 'Projets' },
]
const demoDiscord = (s: DemoState) =>
  s.discord ?? { guild: { id: 'demo', name: 'Équipe Kollab', iconUrl: null }, links: [{ channelId: 'general', discordChannelId: 'd-general', discordChannelName: 'général' }] }

/** Fichiers envoyés en démo : gardés en mémoire le temps de la session. */
const demoFiles = new Map<string, string>()

const ME: Member = { id: 'me', name: 'Moi', color: '#5546E0', role: 'admin', title: 'Product Owner', status: 'available', avatarUrl: null }
const TEAM: Member[] = [
  { id: 'lm', name: 'Léa Martin', color: '#2E7D4F', role: 'member', title: 'Développeuse front', status: 'available', avatarUrl: null },
  { id: 'sk', name: 'Sami Benali', color: '#2F6FD0', role: 'member', title: 'Développeur back', titleRequest: 'Développeur full stack', status: 'busy', avatarUrl: null },
  { id: 'yo', name: 'Yohann Petit', color: '#B5462E', role: 'guest', title: 'Client', status: 'away', avatarUrl: null },
]

const DAY = 86400e3
const isoDay = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10)

function seed(user: User): Workspace {
  let age = 0
  const s2 = newId()
  const s3 = newId()
  const s4 = newId()
  const sprints: Sprint[] = [
    { id: s2, name: 'Sprint 2', goal: 'Connexion et projets', startsOn: isoDay(-20), endsOn: isoDay(-7), status: 'done', closedAt: new Date(Date.now() - 7 * DAY).toISOString() },
    { id: s3, name: 'Sprint 3', goal: 'Tableau, invitations et documents', startsOn: isoDay(-6), endsOn: isoDay(7), status: 'active', closedAt: null },
    { id: s4, name: 'Sprint 4', goal: 'Poker planning et visio', startsOn: isoDay(8), endsOn: isoDay(21), status: 'planned', closedAt: null },
  ]
  /** sprint : 2, 3 ou null (backlog) ; doneDay : jour de fin, compté depuis aujourd'hui. */
  const t = (title: string, status: Task['status'], kind: Task['kind'], points: number, assignees: string[], position: number, sprint: 2 | 3 | null = 3, doneDay?: number): Task => ({
    id: newId(), title, description: '', status, kind, points, assigneeIds: assignees, prUrl: null, position,
    // Créées au fil des derniers jours, pour un fil d'activité réaliste.
    createdAt: new Date(Date.now() - (age += 95) * 60000 * 7).toISOString(),
    sprintId: sprint === 2 ? s2 : sprint === 3 ? s3 : null,
    doneAt: status === 'done' ? new Date(Date.now() + (doneDay ?? -1) * DAY).toISOString() : null,
  })
  return {
    sprints,
    notes: [
      { id: newId(), title: 'Compte rendu du daily', preview: 'Daily du matin\nLéa : tableau kanban terminé, passe aux invitations.\nSami : table des groupes, finie ce soir.\nMoi : relecture de la visionneuse PDF.\nBlocage : aucun.', createdBy: 'lm', updatedBy: 'sk', createdAt: new Date(Date.now() - 5 * 3600e3).toISOString(), updatedAt: new Date(Date.now() - 40 * 60e3).toISOString() },
    ],
    group: { id: 'demo', name: 'Mon équipe', inviteCode: 'KOLLAB-DEMO', discordWebhookSet: false },
    members: [{ ...ME, name: user.name }, ...TEAM],
    tasks: [
      t('Page de connexion GitHub', 'todo', 'feature', 5, [], 0),
      { ...t('Table des groupes', 'todo', 'feature', 3, ['sk'], 1), dueOn: isoDay(-2) },
      t('Le menu se ferme mal sur iPhone', 'todo', 'bug', 2, [], 2),
      t('Tableau kanban glisser-déposer', 'doing', 'feature', 8, ['lm', 'me'], 0),
      { ...t('Invitations par lien', 'doing', 'feature', 5, ['me'], 1), dueOn: isoDay(2) },
      { ...t('Visionneuse PDF', 'review', 'feature', 5, ['lm', 'me'], 0), dueOn: isoDay(5) },
      t('Choisir le stack', 'done', 'research', 2, ['me'], 0, 3, -5),
      t('Schéma de la base', 'done', 'feature', 5, ['sk'], 1, 3, -3),
      t('Connexion Google', 'done', 'feature', 3, ['lm'], 2, 3, -2),
      t('Notifications sur téléphone', 'todo', 'feature', 8, [], 3, null),
      t('Mode hors ligne', 'todo', 'research', 5, [], 4, null),
      t('Export PDF du sprint', 'todo', 'feature', 3, [], 5, null),
      t('Connexion GitHub', 'done', 'feature', 5, ['me'], 3, 2, -15),
      t('Création de projet', 'done', 'feature', 8, ['sk', 'lm'], 4, 2, -11),
      t('Thèmes de couleur', 'done', 'feature', 3, ['lm'], 5, 2, -8),
    ],
    channels: [
      { id: 'general', name: 'général' },
      { id: 'code', name: 'revues-de-code' },
      { id: 'sprint', name: 'sprint' },
    ],
    links: [
      { id: newId(), title: 'Dépôt GitHub', url: 'https://github.com/ambroise-boutrin/kollab' },
    ],
    documents: [
      { id: newId(), name: 'Cahier des charges.pdf', mime: 'application/pdf', size: 2820, path: '/demo/cahier-des-charges.pdf', uploadedBy: 'sk', createdAt: new Date(Date.now() - 26 * 3600e3).toISOString() },
      { id: newId(), name: 'Maquette accueil.jpg', mime: 'image/jpeg', size: 66149, path: '/demo/maquette-accueil.jpg', uploadedBy: 'lm', createdAt: new Date(Date.now() - 3 * 3600e3).toISOString() },
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
    { id: newId(), channelId: 'general', authorId: '', discord: { name: 'Tom', avatar: null }, body: 'Je regarde aussi ce soir, depuis Discord.', createdAt: at(36) },
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
        if (w && !w.documents) w.documents = []
        if (w && !w.sprints) w.sprints = []
        if (w && !w.notes) w.notes = []
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
  const pdf = workspace.tasks.find((t) => t.title === 'Visionneuse PDF')?.id ?? ''
  const comments: TaskComment[] = [
    { id: newId(), taskId: pdf, authorId: 'lm', body: 'Le zoom marche, il reste le défilement sur iPhone.', createdAt: at(130) },
    { id: newId(), taskId: pdf, authorId: 'sk', body: '@Moi tu peux relire avant ce soir ?', createdAt: at(55) },
  ]
  write({ ...s, user, providers: ['email'], workspace, messages: seedMessages(workspace), notifications, comments })
}

export const demoBackend: Backend = {
  mode: 'demo',

  async currentUser() {
    return read().user
  },

  async markOnboarded() {},

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
      .map((w) => ({ id: w.group.id, name: w.group.name, role: w.members.find((m) => m.id === 'me')?.role ?? 'admin', logoUrl: w.group.logoUrl ?? null, color: w.group.color ?? null, memberCount: w.members.length }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  },

  async syncGitHub() {
    return false
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
        w.documents = []
        w.sprints = []
        w.notes = []
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

  async inviteByEmail(email, role) {
    const inv: EmailInvite = { id: newId(), email: email.trim().toLowerCase(), role, createdAt: new Date().toISOString() }
    update((s) => {
      s.emailInvites = [inv, ...(s.emailInvites ?? []).filter((e) => e.email !== inv.email)]
    })
    return { account: false, emailed: true }
  },

  async listEmailInvites() {
    return read().emailInvites ?? []
  },

  async cancelEmailInvite(id) {
    update((s) => {
      s.emailInvites = (s.emailInvites ?? []).filter((e) => e.id !== id)
    })
  },

  async claimEmailInvites() {
    return 0
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

  async setMemberTitle(memberId, title) {
    update((s) => {
      const m = s.workspace?.members.find((x) => x.id === memberId)
      if (m) { m.title = title; m.titleRequest = null }
    })
    emit({ kind: 'refresh' })
  },

  async requestTitle(title) {
    update((s) => {
      const m = s.workspace?.members.find((x) => x.id === s.user?.id) ?? s.workspace?.members[0]
      if (m) m.titleRequest = title || null
    })
    emit({ kind: 'refresh' })
  },

  async declineTitle(memberId) {
    update((s) => {
      const m = s.workspace?.members.find((x) => x.id === memberId)
      if (m) m.titleRequest = null
    })
    emit({ kind: 'refresh' })
  },

  async setGroupPrefs(prefs) {
    update((s) => {
      if (s.workspace) Object.assign(s.workspace.group, Object.fromEntries(Object.entries(prefs).filter(([, v]) => v !== undefined)))
    })
    emit({ kind: 'refresh' })
  },

  async setInviteTitle() {},

  async setGroupLogo(file) {
    const url = file ? await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(file) }) : null
    update((s) => {
      if (s.workspace) s.workspace.group.logoUrl = url
      logAct(s, 'logo', 'groups', null)
    })
    emit({ kind: 'refresh' })
  },

  async listActivity(limit = 60) {
    const s = read()
    const w = s.workspace
    if (!w) return []
    const seeded: ActivityItem[] = [
      ...w.tasks.map((t) => ({ id: `t-${t.id}`, actorId: null, verb: 'created', target: 'tasks', targetId: t.id, label: t.title, meta: {}, createdAt: t.createdAt })),
      ...w.documents.map((d) => ({ id: `d-${d.id}`, actorId: d.uploadedBy, verb: 'created', target: 'documents', targetId: d.id, label: d.name, meta: {}, createdAt: d.createdAt })),
      ...w.notes.map((n) => ({ id: `n-${n.id}`, actorId: n.createdBy, verb: 'created', target: 'notes', targetId: n.id, label: n.title, meta: {}, createdAt: n.createdAt })),
    ]
    return [...(s.activity ?? []), ...seeded].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit)
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
      const before = i >= 0 ? s.workspace.tasks[i] : null
      if (!before) logAct(s, 'created', 'tasks', task.title, {}, task.id)
      else if (before.status !== task.status) logAct(s, 'moved', 'tasks', task.title, { from: before.status, to: task.status }, task.id)
      else if (before.assigneeIds.join() !== task.assigneeIds.join()) logAct(s, 'assigned', 'tasks', task.title, {}, task.id)
      else if (task.prUrl && before.prUrl !== task.prUrl) logAct(s, 'pr_linked', 'tasks', task.title, { pr: task.prUrl }, task.id)
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

  async listComments(taskId) {
    return (read().comments ?? []).filter((c) => c.taskId === taskId)
  },

  async addComment(taskId, body) {
    const c: TaskComment = { id: newId(), taskId, authorId: 'me', body, createdAt: new Date().toISOString() }
    update((s) => {
      s.comments = [...(s.comments ?? []), c]
    })
    return c
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
      const doc = (s.trashedDocs ?? []).find((d) => d.id === id)
      if (doc && s.workspace) s.workspace.documents.unshift(doc)
      s.trashedDocs = (s.trashedDocs ?? []).filter((d) => d.id !== id)
      const note = (s.trashedNotes ?? []).find((n) => n.id === id)
      if (note && s.workspace) s.workspace.notes.unshift(note)
      s.trashedNotes = (s.trashedNotes ?? []).filter((n) => n.id !== id)
      const link = (s.trashedLinks ?? []).find((l) => l.id === id)
      if (link && s.workspace) s.workspace.links.push(link)
      s.trashedLinks = (s.trashedLinks ?? []).filter((l) => l.id !== id)
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
      logAct(s, 'created', 'links', title, {}, link.id)
    })
    emit({ kind: 'refresh' })
    return link
  },

  async uploadDocument(file) {
    const doc: DocumentItem = { id: newId(), name: file.name, mime: file.type || 'application/octet-stream', size: file.size, path: `demo:${newId()}`, uploadedBy: 'me', createdAt: new Date().toISOString() }
    demoFiles.set(doc.path, URL.createObjectURL(file))
    update((s) => {
      s.workspace?.documents.unshift(doc)
    })
    emit({ kind: 'refresh' })
    return doc
  },

  async documentUrl(doc) {
    if (doc.path.startsWith('/')) return doc.path
    const url = demoFiles.get(doc.path)
    if (!url) throw new Error('En démo, les fichiers envoyés ne sont gardés que jusqu\'au rechargement.')
    return url
  },

  async renameDocument(id, name) {
    update((s) => {
      const d = s.workspace?.documents.find((x) => x.id === id)
      if (d) d.name = name.trim()
    })
    emit({ kind: 'refresh' })
  },

  async removeDocument(id) {
    update((s) => {
      const d = s.workspace?.documents.find((x) => x.id === id)
      if (!d || !s.workspace) return
      s.workspace.documents = s.workspace.documents.filter((x) => x.id !== id)
      s.trashedDocs = [...(s.trashedDocs ?? []), d]
      s.trash = [{ kind: 'document', id, title: d.name, deletedAt: new Date().toISOString(), deletedBy: 'me' }, ...(s.trash ?? [])]
    })
    emit({ kind: 'refresh' })
  },

  joinRoom(room, h, opts) {
    // Démo : Léa et Sami sont là et votent quelques secondes après chaque nouvelle tâche.
    const bots = ['lm', 'sk']
    const timers: ReturnType<typeof setTimeout>[] = []
    const bc = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel(`kollab-room-${room}`) : null
    if (bc) bc.onmessage = (m) => h.onEvent(m.data as RoomEvent)
    if (!room.startsWith('voice')) setTimeout(() => h.onPeers(['me', ...bots]), 300)
    else setTimeout(() => h.onPeers(opts?.listen ? [] : ['me']), 300)
    const deck = [2, 3, 5, 5, 8]
    const botsVote = () => {
      for (const b of bots) {
        timers.push(setTimeout(() => h.onEvent({ type: 'vote', from: b, value: String(deck[Math.floor(Math.random() * deck.length)]) }), 1200 + Math.random() * 2500))
      }
    }
    return {
      send(e) {
        const ev = { ...e, from: 'me' } as RoomEvent
        bc?.postMessage(ev)
        if (room === 'poker' && (e.type === 'task' || e.type === 'reset')) botsVote()
      },
      setPresent(on) {
        if (room.startsWith('voice')) h.onPeers(on ? ['me'] : [])
      },
      leave() {
        timers.forEach(clearTimeout)
        bc?.close()
      },
    }
  },

  async createNote(title) {
    const now = new Date().toISOString()
    const note: Note = { id: newId(), title: title.trim() || 'Sans titre', preview: '', createdBy: 'me', updatedBy: 'me', createdAt: now, updatedAt: now }
    update((s) => {
      s.workspace?.notes.unshift(note)
    })
    emit({ kind: 'refresh' })
    return note
  },

  async loadNote(id) {
    return read().noteStates?.[id] ?? ''
  },

  async saveNote(id, patch) {
    update((s) => {
      const n = s.workspace?.notes.find((x) => x.id === id)
      if (!n) return
      if (patch.ystate !== undefined) s.noteStates = { ...(s.noteStates ?? {}), [id]: patch.ystate }
      if (patch.preview !== undefined) n.preview = patch.preview.slice(0, 2000)
      if (patch.title !== undefined) n.title = patch.title.trim() || 'Sans titre'
      n.updatedAt = new Date().toISOString()
      n.updatedBy = 'me'
    })
  },

  async removeNote(id) {
    update((s) => {
      const n = s.workspace?.notes.find((x) => x.id === id)
      if (!n || !s.workspace) return
      s.workspace.notes = s.workspace.notes.filter((x) => x.id !== id)
      s.trashedNotes = [...(s.trashedNotes ?? []), n]
      s.trash = [{ kind: 'note', id, title: n.title, deletedAt: new Date().toISOString(), deletedBy: 'me' }, ...(s.trash ?? [])]
    })
    emit({ kind: 'refresh' })
  },

  async createSprint(sp) {
    const sprint: Sprint = { ...sp, id: newId(), closedAt: null }
    update((s) => {
      s.workspace?.sprints.push(sprint)
    })
    emit({ kind: 'refresh' })
    return sprint
  },

  async updateSprint(id, patch) {
    update((s) => {
      const sp = s.workspace?.sprints.find((x) => x.id === id)
      if (sp) Object.assign(sp, patch)
    })
    emit({ kind: 'refresh' })
  },

  async updateLink(id, patch) {
    update((s) => {
      const l = s.workspace?.links.find((x) => x.id === id)
      if (l) Object.assign(l, patch)
      logAct(s, 'edited', 'links', patch.title, {}, id)
    })
    emit({ kind: 'refresh' })
  },

  async removeLink(id) {
    update((s) => {
      const l = s.workspace?.links.find((x) => x.id === id)
      if (!l || !s.workspace) return
      s.workspace.links = s.workspace.links.filter((x) => x.id !== id)
      s.trashedLinks = [...(s.trashedLinks ?? []), l]
      logAct(s, 'trashed', 'links', l.title, {}, id)
      s.trash = [{ kind: 'link', id, title: l.title, deletedAt: new Date().toISOString(), deletedBy: 'me' }, ...(s.trash ?? [])]
    })
    emit({ kind: 'refresh' })
  },

  async setDiscordWebhook(url) {
    update((s) => {
      if (s.workspace) s.workspace.group.discordWebhookSet = !!url
    })
  },

  push: null,

  async notifyDiscord() {
    // Rien à envoyer en mode démo.
  },

  async discordState() {
    return demoDiscord(read())
  },

  async connectDiscord() {
    await new Promise((r) => setTimeout(r, 900))
    update((s) => {
      s.discord = { guild: { id: 'demo', name: 'Équipe Kollab', iconUrl: null }, links: demoDiscord(s).links }
    })
  },

  async disconnectDiscord() {
    update((s) => {
      s.discord = { guild: null, links: [] }
    })
  },

  async listDiscordChannels() {
    const extra = (read().discord?.links ?? []).filter((l) => !DEMO_DISCORD.some((c) => c.id === l.discordChannelId))
    return [...DEMO_DISCORD, ...extra.map((l) => ({ id: l.discordChannelId, name: l.discordChannelName, category: 'Kollab' }))]
  },

  async linkDiscordChannel(channelId, discordChannelId) {
    const s0 = read()
    const name = s0.workspace?.channels.find((c) => c.id === channelId)?.name ?? 'kollab'
    const target = discordChannelId ? DEMO_DISCORD.find((c) => c.id === discordChannelId) ?? { id: discordChannelId, name } : { id: `d-${newId().slice(0, 6)}`, name: name.toLowerCase().replace(/\s+/g, '-') }
    const taken = demoDiscord(s0).links.find((l) => l.discordChannelId === target.id && l.channelId !== channelId)
    if (taken) throw new Error('Ce salon Discord est déjà relié à un autre salon.')
    const link: DiscordLink = { channelId, discordChannelId: target.id, discordChannelName: target.name }
    update((s) => {
      const d = demoDiscord(s)
      s.discord = { guild: d.guild, links: [...d.links.filter((l) => l.channelId !== channelId), link] }
    })
    return link
  },

  async importDiscordChannels() {
    const norm = (x: string) => x.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s_-]+/g, '-')
    let merged = 0, created = 0
    update((s) => {
      const d = demoDiscord(s)
      const links = [...d.links]
      for (const c of DEMO_DISCORD) {
        if (links.some((l) => l.discordChannelId === c.id) || !s.workspace) continue
        let k = s.workspace.channels.find((x) => norm(x.name) === norm(c.name) && !links.some((l) => l.channelId === x.id))
        if (k) merged++
        else {
          k = { id: newId(), name: c.name }
          s.workspace.channels.push(k)
          created++
        }
        links.push({ channelId: k.id, discordChannelId: c.id, discordChannelName: c.name })
      }
      s.discord = { guild: d.guild, links }
    })
    emit({ kind: 'refresh' })
    return { merged, created, failed: 0 }
  },

  async unlinkDiscordChannel(channelId) {
    update((s) => {
      const d = demoDiscord(s)
      s.discord = { guild: d.guild, links: d.links.filter((l) => l.channelId !== channelId) }
    })
  },
}
