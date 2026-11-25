import { LEGACY_TOKEN_KEY, ghLinked, setGhLinked, setGhProxy, type GhProxy } from './github'
import { APP_BASE, IS_TAURI, WEB_APP } from './base'
import { createClient, type SupabaseClient, type User as SbUser } from '@supabase/supabase-js'
import type { Backend, RoomEvent, User, Workspace } from './backend'
import { disablePush } from './push'
import { CGU_VERSION } from './legal'
import { guessNoteKind } from './noteKinds'
import type { AppNotification, Attachment, Channel, DiscordChannel, DiscordLink, DocumentItem, Note, NoteKind, Sprint, Invite, ReactionChange, LinkItem, Member, Message, PresenceStatus, Provider, Role, Task } from './types'
import { PRESENCE, legacyPresence } from './types'

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
  sprint_id?: string | null
  done_at?: string | null
  due_on?: string | null
}

interface NoteRow {
  id: string
  title: string
  preview: string
  created_by: string | null
  updated_by: string | null
  created_at: string
  updated_at: string
  kind?: string
  pinned?: boolean
}
const NOTE_BASE = 'id, title, preview, created_by, updated_by, created_at, updated_at'
const NOTE_COLS = `${NOTE_BASE}, kind, pinned`
/** Tant que la migration « type de document » n'est pas passée, on lit sans ces colonnes et on devine le type au titre. */
let noteMeta = true
const toNote = (r: NoteRow): Note => ({
  id: r.id, title: r.title, preview: r.preview, createdBy: r.created_by, updatedBy: r.updated_by, createdAt: r.created_at, updatedAt: r.updated_at,
  kind: r.kind && r.kind !== 'page' ? (r.kind as NoteKind) : guessNoteKind(r.title), pinned: r.pinned ?? false,
})

interface SprintRow {
  id: string
  name: string
  goal: string
  starts_on: string
  ends_on: string
  status: Sprint['status']
  closed_at: string | null
}

const toSprint = (r: SprintRow): Sprint => ({ id: r.id, name: r.name, goal: r.goal, startsOn: r.starts_on, endsOn: r.ends_on, status: r.status, closedAt: r.closed_at })

interface DocumentRow {
  id: string
  name: string
  mime: string
  size: number
  path: string
  uploaded_by: string | null
  created_at: string
}

const toDocument = (r: DocumentRow): DocumentItem => ({ id: r.id, name: r.name, mime: r.mime, size: Number(r.size), path: r.path, uploadedBy: r.uploaded_by, createdAt: r.created_at })

interface MessageRow {
  id: string
  channel_id: string
  author_id: string | null
  body: string
  created_at: string
  edited_at?: string | null
  deleted_at?: string | null
  discord_author?: { name: string; avatar?: string | null } | null
  attachments?: Attachment[] | null
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
  sprintId: r.sprint_id ?? null,
  doneAt: r.done_at ?? null,
  dueOn: r.due_on ?? null,
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
  discord: r.discord_author ? { name: r.discord_author.name, avatar: r.discord_author.avatar ?? null } : null,
  channelId: r.channel_id,
  authorId: r.author_id ?? '',
  body: r.deleted_at ? '' : r.body,
  createdAt: r.created_at,
  editedAt: r.edited_at ?? null,
  deletedAt: r.deleted_at ?? null,
  attachments: r.deleted_at ? [] : r.attachments ?? [],
})

function toUser(u: SbUser | null | undefined): User | null {
  if (!u) return null
  const meta = u.user_metadata ?? {}
  return {
    id: u.id,
    name: meta.full_name ?? meta.user_name ?? meta.name ?? u.email?.split('@')[0] ?? 'Moi',
    email: u.email ?? null,
    // Présentation déjà faite : drapeau du compte, ou compte de plus de 2 jours.
    onboarded: meta.kollab_onboarded === true || Date.now() - Date.parse(u.created_at) > 2 * 86_400_000,
  }
}

function must<R extends { data: unknown; error: { message: string } | null }>(res: R): NonNullable<R['data']> {
  if (res.error) throw new Error(res.error.message)
  return res.data as NonNullable<R['data']>
}

/** Appli GitHub Kollab prête (accès par dépôt) : la connexion GitHub de Supabase ne sert plus qu'à s'identifier. */
const GH_APP_KEY = 'kollab-gh-app'
const ghAppReady = () => {
  try {
    return localStorage.getItem(GH_APP_KEY) === '1'
  } catch {
    return false
  }
}
/** Sans l'appli GitHub : ancien accès (lire les PR, commenter, relancer la CI, dépôts privés compris). */
const githubScopes = () => (ghAppReady() ? 'read:user user:email' : 'repo read:user user:email')

export function createSupabaseBackend(url: string, anonKey: string): Backend {
  const sb: SupabaseClient = createClient(url, anonKey)
  let groupId: string | null = null
  let liveChannel: ReturnType<typeof sb.channel> | null = null
  let chatReady = false
  const redirectTo = `${window.location.origin}${APP_BASE}`

  /** Fonction serveur « github » : seule à lire le jeton, chiffré dans la base. */
  async function ghFn<T = Record<string, unknown>>(body: Record<string, unknown>): Promise<T> {
    const { data, error } = await sb.functions.invoke('github', { body })
    if (error) {
      const msg = await (error as { context?: Response }).context?.json?.().then((j: { error?: string }) => j.error).catch(() => undefined)
      throw new Error(msg ?? 'GitHub ne répond pas pour le moment')
    }
    return data as T
  }
  type GhStatus = { linked: boolean; mode: 'app' | 'oauth' | null; app: boolean; login: string | null; updatedAt: string | null; installs?: number }
  setGhProxy(((req) => ghFn({ action: 'api', ...req })) as GhProxy)
  // L'appli GitHub est-elle prête ? (sans session : on le sait dès l'écran de connexion)
  void fetch(`${url}/functions/v1/github/config`).then((r) => r.json()).then((j: { app?: boolean }) => {
    try {
      localStorage.setItem(GH_APP_KEY, j.app ? '1' : '0')
    } catch { /* ignoré */ }
  }).catch(() => undefined)

  /** Relit sur le serveur si GitHub est relié. Un ancien jeton resté sur l'appareil est rangé (chiffré) puis effacé. */
  async function syncLinked(): Promise<boolean> {
    let legacy: string | null = null
    try {
      legacy = localStorage.getItem(LEGACY_TOKEN_KEY)
    } catch { /* ignoré */ }
    if (legacy) {
      // La base chiffre le jeton à l'arrivée et ne garde rien en clair.
      const { error } = await sb.from('github_tokens').upsert({ token: legacy, updated_at: new Date().toISOString() })
      if (!error) try { localStorage.removeItem(LEGACY_TOKEN_KEY) } catch { /* ignoré */ }
    }
    const st = await ghFn<GhStatus>({ action: 'status' })
    try {
      localStorage.setItem(GH_APP_KEY, st.app ? '1' : '0')
    } catch { /* ignoré */ }
    const was = ghLinked()
    setGhLinked(st.linked)
    if (was !== st.linked) window.dispatchEvent(new Event(st.linked ? 'kollab:gh-token' : 'kollab:gh-expired'))
    return st.linked
  }
  let saving: Promise<unknown> = Promise.resolve()
  /** Jeton reçu de la connexion GitHub de Supabase (ancien accès) : envoyé tout de suite au serveur, jamais gardé ici. */
  function keepGhToken(token: string) {
    if (ghAppReady()) return
    saving = Promise.resolve(sb.from('github_tokens').upsert({ token, updated_at: new Date().toISOString() })).then(({ error }) => {
      if (error) return
      setGhLinked(true)
      window.dispatchEvent(new Event('kollab:gh-token'))
    })
  }
  /**
   * Ouvre la connexion d'un service dans une petite fenêtre (popup sur le web, navigateur sur l'ordi)
   * et attend que `ready` dise que c'est fait. Kollab reste ouvert derrière, rien à relancer.
   */
  async function oauthWindow(url: string, ready: () => Promise<boolean>, name: string) {
    let popup: Window | null = null
    if (IS_TAURI) {
      const { openUrl } = await import('@tauri-apps/plugin-opener')
      await openUrl(url)
    } else {
      const w = 520, h = 720
      popup = window.open(url, 'kollab-connexion', `popup,width=${w},height=${h},left=${Math.round(window.screenX + (window.outerWidth - w) / 2)},top=${Math.round(window.screenY + (window.outerHeight - h) / 2)}`)
      // Popup bloqué : on passe par la page entière, qui revient ensuite dans Kollab.
      if (!popup) return void window.location.assign(url)
    }
    const started = Date.now()
    await new Promise<void>((resolve, reject) => {
      let over = false
      let closedAt = 0
      const finish = (err?: Error) => {
        if (over) return
        over = true
        clearInterval(timer)
        if (err) reject(err)
        else resolve()
      }
      const timer = setInterval(() => {
        void ready().then((ok) => {
          if (ok) return finish()
          if (Date.now() - started > 5 * 60e3) return finish(new Error(`Connexion ${name} abandonnée`))
          if (popup?.closed) {
            closedAt ||= Date.now()
            // Fenêtre fermée : on laisse quelques secondes au compte pour enregistrer la connexion.
            if (Date.now() - closedAt > 6000) finish(new Error(`Connexion ${name} annulée`))
          }
        }).catch(() => undefined)
      }, 1500)
    })
  }

  // Relié depuis un autre appareil : on le voit au retour sur l'app.
  const regain = () => {
    if (!ghLinked() && document.visibilityState === 'visible') void sb.auth.getSession().then(({ data }) => data.session && syncLinked()).catch(() => undefined)
  }
  document.addEventListener('visibilitychange', regain)
  window.addEventListener('focus', regain)

  return {
    mode: 'supabase',

    async currentUser() {
      const { data, error } = await sb.auth.getUser()
      let u = data.user
      // Réseau lent ou jeton en cours de renouvellement : on garde la session de l'appareil
      // plutôt que de renvoyer à la connexion (et à la création d'un projet).
      if (!u && error && error.name !== 'AuthSessionMissingError') {
        u = (await sb.auth.getSession()).data.session?.user ?? null
        if (!u) throw new Error('Connexion au serveur impossible pour le moment')
      }
      if (u) await syncLinked().catch(() => undefined)
      return toUser(u)
    },

    async markOnboarded() {
      must(await sb.auth.updateUser({ data: { kollab_onboarded: true } }))
    },

    onAuthChange(cb) {
      const { data } = sb.auth.onAuthStateChange((event, session) => {
        // L'écran de connexion vaut acceptation des CGU : on enregistre la version acceptée.
        const u = session?.user
        // Jeton GitHub : Supabase ne le donne qu'au retour de GitHub, on l'envoie au serveur.
        const latest = [...(u?.identities ?? [])].sort((a, b) => String(b.last_sign_in_at ?? '').localeCompare(String(a.last_sign_in_at ?? '')))[0]
        if (session?.provider_token && latest?.provider === 'github') keepGhToken(session.provider_token)
        else if (event === 'SIGNED_IN' && !ghLinked()) void syncLinked().catch(() => undefined)
        if (event === 'SIGNED_OUT') setGhLinked(false)
        // Email de bienvenue, une seule fois après l'activation (la fonction vérifie elle-même).
        if (event === 'SIGNED_IN' && u?.email_confirmed_at && !u.app_metadata?.welcomed) {
          setTimeout(() => void sb.functions.invoke('welcome-email').catch(() => {}), 0)
        }
        if (event === 'SIGNED_IN' && u && u.user_metadata?.cgu_version !== CGU_VERSION) {
          setTimeout(() => void sb.auth.updateUser({ data: { cgu_version: CGU_VERSION, cgu_accepted_at: new Date().toISOString() } }), 0)
        }
        // Un simple renouvellement de jeton ne change rien : pas de rechargement.
        if (event !== 'TOKEN_REFRESHED') cb(toUser(u))
      })
      return () => data.subscription.unsubscribe()
    },

    async signIn(provider, email) {
      if (provider === 'email') {
        if (!email) throw new Error('Adresse email manquante')
        must(await sb.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo } }))
        return { emailSent: true }
      }
      must(await sb.auth.signInWithOAuth({ provider, options: { redirectTo, ...(provider === 'github' ? { scopes: githubScopes() } : {}) } }))
      return {}
    },

    async signOut() {
      // L'appareil ne doit plus recevoir les notifications de ce compte.
      if (this.push) await disablePush(this.push).catch(() => undefined)
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
      const { statusText, statusColor, statusUntil, weeklyEmail, missedEmail, status, presenceUntil, ...rest } = patch
      const row: Record<string, unknown> = { ...rest }
      if (status !== undefined) {
        row.status = legacyPresence(status)
        // Colonnes de présence : si elles n'existent pas encore, on garde au moins l'ancien statut.
        const r = await sb.from('profiles').update({ presence: status, presence_until: presenceUntil ?? null }).eq('id', data.user.id)
        if (r.error && (status === 'dnd' || status === 'invisible')) throw new Error('Ce statut arrive bientôt')
      }
      if (statusText !== undefined) row.status_text = statusText
      if (statusColor !== undefined) row.status_color = statusColor
      if (statusUntil !== undefined) row.status_until = statusUntil
      if (weeklyEmail !== undefined) row.weekly_email = weeklyEmail
      if (missedEmail !== undefined) row.missed_email = missedEmail
      must(await sb.from('profiles').update(row).eq('id', data.user.id))
    },

    async uploadAvatar(file) {
      const { data } = await sb.auth.getUser()
      if (!data.user) throw new Error('Non connecté')
      // Un nom unique à chaque envoi évite que l'ancienne photo reste en cache.
      const path = `${data.user.id}/${Date.now()}.webp`
      must(await sb.storage.from('avatars').upload(path, file, { contentType: file.type || 'image/webp' }))
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
      const [{ data }, acc] = await Promise.all([sb.auth.getUserIdentities(), sb.from('discord_accounts').select('user_id').maybeSingle()])
      const list = (data?.identities ?? []).map((i) => i.provider as Provider)
      // Discord se relie par l'appli Discord de Kollab (même fenêtre que dans le chat), pas par la connexion Supabase.
      if (acc.data && !list.includes('discord')) list.push('discord')
      return list
    },

    async link(provider) {
      if (provider === 'email') throw new Error("L'email se relie depuis la connexion par lien magique.")
      if (provider === 'discord') return this.connectDiscordAccount()
      const back = `${IS_TAURI ? WEB_APP : window.location.origin + APP_BASE}/?gh-popup=1`
      const res = await sb.auth.linkIdentity({ provider, options: { redirectTo: back, skipBrowserRedirect: true, ...(provider === 'github' ? { scopes: githubScopes() } : {}) } })
      if (res.error) {
        const m = res.error.message
        if (/provider is not enabled/i.test(m)) throw new Error(`La connexion ${provider === 'github' ? 'GitHub' : provider === 'google' ? 'Google' : 'Discord'} n'est pas encore activée sur Kollab.`)
        if (/manual linking/i.test(m)) throw new Error("La liaison de comptes n'est pas encore activée sur Kollab.")
        throw res.error
      }
      const name = provider === 'github' ? 'GitHub' : provider === 'google' ? 'Google' : 'Discord'
      await oauthWindow(res.data.url, async () => {
        const { data } = await sb.auth.getUserIdentities()
        return !!data?.identities.some((i) => i.provider === provider)
      }, name)
      await sb.auth.refreshSession().catch(() => undefined)
    },

    async syncGitHub() {
      await saving.catch(() => undefined)
      return syncLinked()
    },

    /**
     * Connexion GitHub dans une petite fenêtre, sans quitter Kollab : un popup sur le web,
     * le navigateur sur l'appli d'ordi. Avec l'appli GitHub Kollab, on choisit les dépôts dans la même
     * fenêtre et le jeton reste sur le serveur. Ici on attend juste que le compte soit relié.
     */
    async connectGitHub() {
      const started = Date.now()
      const fresh = (s: GhStatus) => !!s.updatedAt && Date.parse(s.updatedAt) >= started - 2000
      const linkedNow = () => {
        setGhLinked(true)
        window.dispatchEvent(new Event('kollab:gh-token'))
        return true
      }
      const c = await ghFn<{ url?: string; fallback?: boolean }>({ action: 'connect' })
      if (c.url) {
        await oauthWindow(c.url, async () => {
          const s = await ghFn<GhStatus>({ action: 'status', check: true })
          return s.mode === 'app' && (s.installs ?? 0) > 0 && fresh(s) ? linkedNow() : false
        }, 'GitHub')
        return
      }
      // Appli GitHub pas encore créée : ancienne connexion par Supabase.
      const linked = (await sb.auth.getUserIdentities()).data?.identities.some((i) => i.provider === 'github')
      const back = `${IS_TAURI ? WEB_APP : window.location.origin + APP_BASE}/?gh-popup=1`
      const options = { redirectTo: back, scopes: githubScopes(), skipBrowserRedirect: true }
      const { data, error } = linked
        ? await sb.auth.signInWithOAuth({ provider: 'github', options })
        : await sb.auth.linkIdentity({ provider: 'github', options })
      if (error || !data?.url) throw new Error(error?.message ?? 'Connexion GitHub impossible')
      await oauthWindow(data.url, async () => {
        const s = await ghFn<GhStatus>({ action: 'status' })
        return s.linked && fresh(s) ? linkedNow() : false
      }, 'GitHub')
      // La fenêtre a pu changer la session du compte : on relit la nôtre.
      await sb.auth.getSession()
    },

    async chooseGitHubRepos() {
      const { url: to } = await ghFn<{ url: string }>({ action: 'install' })
      // Choix des dépôts sur GitHub, dans une petite fenêtre ; Kollab voit les nouveaux dépôts tout de suite après.
      if (IS_TAURI) return void (await import('@tauri-apps/plugin-opener')).openUrl(to)
      window.open(to, 'kollab-connexion', 'popup,width=520,height=720')
    },

    async unlink(provider) {
      if (provider === 'discord') await this.unlinkDiscordAccount().catch(() => undefined)
      const { data } = await sb.auth.getUserIdentities()
      const identity = data?.identities.find((i) => i.provider === provider)
      if (!identity) return
      must(await sb.auth.unlinkIdentity(identity))
      if (provider === 'github') {
        setGhLinked(false)
        await ghFn({ action: 'forget' }).catch(() => undefined)
      }
    },

    async listGroups() {
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user) return []
      type Row = { group_id: string; role: Role; groups: { name: string; logo_url: string | null; color?: string | null; group_members: { count: number }[] } | null }
      const rows = must(
        await sb.from('group_members').select('group_id, role, groups(name, logo_url, color, group_members(count))').eq('user_id', auth.user.id).order('joined_at'),
      ) as unknown as Row[]
      // Un projet à la corbeille n'est plus lisible : il n'apparaît plus.
      return rows.filter((r) => r.groups).map((r) => ({
        id: r.group_id,
        name: r.groups?.name ?? 'Projet',
        role: r.role,
        logoUrl: r.groups?.logo_url ?? null,
        color: r.groups?.color ?? null,
        memberCount: r.groups?.group_members?.[0]?.count,
      }))
    },

    async loadWorkspace(wanted?: string | null): Promise<Workspace | null> {
      // Session de l'appareil : pas d'appel réseau qui pourrait échouer et faire croire à « aucun projet ».
      const auth = { user: (await sb.auth.getSession()).data.session?.user }
      if (!auth.user) throw new Error('Session expirée, reconnecte-toi')
      const memberships = (must(
        await sb.from('group_members').select('group_id, groups(id)').eq('user_id', auth.user.id).order('joined_at'),
      ) as unknown as { group_id: string; groups: { id: string } | null }[]).filter((m) => m.groups)
      if (!memberships.length) return null
      groupId = (memberships.find((m) => m.group_id === wanted) ?? memberships[0]).group_id

      const MEMBER_COLS = 'name, color, title, status, avatar_url, status_text, status_color, status_until, weekly_email'
      // Colonnes ajoutées plus tard (présence, missed_email) : on retombe sans elles si la migration manque.
      const loadMembers = async () => {
        const r = await sb.from('group_members').select(`*, profiles(${MEMBER_COLS}, missed_email, presence, presence_until)`).eq('group_id', groupId)
        return r.error ? sb.from('group_members').select(`*, profiles(${MEMBER_COLS})`).eq('group_id', groupId) : r
      }
      const [group, members, tasks, channels, links, documents, sprints, notes] = await Promise.all([
        sb.from('groups').select('*').eq('id', groupId).single(),
        loadMembers(),
        sb.from('tasks').select('*').eq('group_id', groupId).order('position'),
        sb.from('channels').select('id, name').eq('group_id', groupId).is('deleted_at', null).order('created_at'),
        sb.from('links').select('*').eq('group_id', groupId).order('created_at'),
        sb.from('documents').select('*').eq('group_id', groupId).is('deleted_at', null).order('created_at', { ascending: false }),
        sb.from('sprints').select('*').eq('group_id', groupId).is('deleted_at', null).order('starts_on'),
        (async () => {
          const q = (cols: string) => sb.from('notes').select(cols).eq('group_id', groupId).is('deleted_at', null).order('updated_at', { ascending: false })
          const r = await q(NOTE_COLS)
          noteMeta = !r.error
          return r.error ? q(NOTE_BASE) : r
        })(),
      ])
      const g = must(group)
      type MemberRow = {
        user_id: string
        role: Role
        title?: string | null
        title_request?: string | null
        profiles: { name: string; color: string; title: string; status: PresenceStatus; avatar_url: string | null; status_text?: string | null; status_color?: string | null; status_until?: string | null; weekly_email?: boolean | null; missed_email?: boolean | null; presence?: string | null; presence_until?: string | null } | null
      }
      return {
        group: { id: g.id, name: g.name, inviteCode: g.invite_code, discordWebhookSet: g.discord_webhook_set, logoUrl: g.logo_url ?? null, color: g.color ?? null, sprintDays: g.sprint_days ?? null, dailyTime: g.daily_time ?? null },
        members: (must(members) as unknown as MemberRow[]).map(
          (m): Member => ({
            id: m.user_id,
            name: m.profiles?.name ?? 'Membre',
            color: m.profiles?.color ?? '#5546E0',
            role: m.role,
            title: m.title || m.profiles?.title || '',
            // Absent tant que la colonne n'existe pas en base : la proposition de rôle reste cachée.
            titleRequest: 'title_request' in m ? (m.title_request ?? null) : undefined,
            status: ((m.profiles?.presence && m.profiles.presence in PRESENCE ? m.profiles.presence : m.profiles?.status) ?? 'available') as PresenceStatus,
            presenceUntil: m.profiles?.presence ? m.profiles?.presence_until ?? null : null,
            avatarUrl: m.profiles?.avatar_url ?? null,
            statusText: m.profiles?.status_text ?? '',
            statusColor: m.profiles?.status_color ?? null,
            statusUntil: m.profiles?.status_until ?? null,
            weeklyEmail: m.profiles?.weekly_email ?? true,
            missedEmail: m.profiles?.missed_email ?? true,
          }),
        ),
        tasks: (must(tasks) as TaskRow[]).filter((r) => !r.deleted_at).map(toTask),
        channels: must(channels),
        links: (must(links) as (LinkItem & { deleted_at?: string | null })[]).filter((l) => !l.deleted_at).map(({ id, title, url }) => ({ id, title, url })),
        documents: documents.error ? [] : (documents.data as DocumentRow[]).map(toDocument),
        sprints: sprints.error ? [] : (sprints.data as SprintRow[]).map(toSprint),
        notes: notes.error ? [] : (notes.data as unknown as NoteRow[]).map(toNote),
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
      // Corbeille : restaurable pendant 30 jours.
      must(await sb.rpc('trash_group', { gid: groupId }))
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
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documents', filter }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sprints', filter }, refresh)
        // Seulement les nouveaux documents : le contenu passe par la salle de l'éditeur.
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notes', filter }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'channels', filter }, refresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'group_members', filter }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'groups', filter: `id=eq.${gid}` }, refresh)
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, refresh)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity', filter }, () => window.dispatchEvent(new Event('kollab:activity')))
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
      const { data, error } = await sb.functions.invoke('invite-email', { body: { groupId, email, role } })
      if (error) {
        const body = await (error as { context?: Response }).context?.json?.().catch(() => null)
        throw new Error(body?.error ?? 'Invitation impossible')
      }
      return data as { account: boolean; emailed: boolean }
    },

    async listEmailInvites() {
      const since = new Date(Date.now() - 30 * 86400000).toISOString()
      const rows = must(
        await sb.from('email_invites').select('id, email, role, code, created_at').eq('group_id', groupId).is('cancelled_at', null).gte('created_at', since).order('created_at', { ascending: false }),
      ) as { id: string; email: string; role: Role; code: string; created_at: string }[]
      if (!rows.length) return []
      // Déjà arrivé dans l'équipe : le code a servi.
      const used = must(await sb.from('invitations').select('code, uses').in('code', rows.map((r) => r.code))) as { code: string; uses: number }[]
      const done = new Set(used.filter((u) => u.uses > 0).map((u) => u.code))
      return rows.filter((r) => !done.has(r.code)).map((r) => ({ id: r.id, email: r.email, role: r.role, createdAt: r.created_at }))
    },

    async cancelEmailInvite(id) {
      must(await sb.rpc('cancel_email_invite', { invite_id: id }))
    },

    async claimEmailInvites() {
      const { data } = await sb.rpc('claim_email_invites')
      return (data as number) ?? 0
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

    async setGroupPrefs(prefs, gid) {
      const row: Record<string, unknown> = {}
      if (prefs.color !== undefined) row.color = prefs.color
      if (prefs.sprintDays !== undefined) row.sprint_days = prefs.sprintDays
      if (prefs.dailyTime !== undefined) row.daily_time = prefs.dailyTime
      if (Object.keys(row).length) must(await sb.from('groups').update(row).eq('id', gid ?? groupId))
    },

    async setInviteTitle(email, title) {
      must(await sb.rpc('set_invite_title', { gid: groupId, email, new_title: title }))
    },

    async setMemberTitle(memberId, title) {
      must(await sb.rpc('set_member_title', { gid: groupId, member: memberId, new_title: title }))
    },

    async requestTitle(title) {
      must(await sb.rpc('request_member_title', { gid: groupId, new_title: title }))
    },

    async declineTitle(memberId) {
      must(await sb.rpc('decline_member_title', { gid: groupId, member: memberId }))
    },

    async setGroupLogo(file, gid) {
      const target = gid ?? groupId
      if (!file) {
        must(await sb.from('groups').update({ logo_url: null }).eq('id', target))
        return
      }
      const path = `${target}/${Date.now()}.webp`
      must(await sb.storage.from('logos').upload(path, file, { contentType: file.type || 'image/webp' }))
      const url = sb.storage.from('logos').getPublicUrl(path).data.publicUrl
      must(await sb.from('groups').update({ logo_url: url }).eq('id', target))
    },

    async listActivity(limit = 60, before) {
      let q = sb.from('activity').select('*').eq('group_id', groupId).order('created_at', { ascending: false }).limit(limit)
      if (before) q = q.lt('created_at', before)
      const { data, error } = await q
      if (error) return []
      type Row = { id: string; actor_id: string | null; verb: string; target: string; target_id: string | null; label: string | null; meta: Record<string, string> | null; created_at: string }
      return (data as Row[]).map((r) => ({ id: r.id, actorId: r.actor_id, verb: r.verb, target: r.target, targetId: r.target_id, label: r.label, meta: r.meta ?? {}, createdAt: r.created_at }))
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
        ...(task.sprintId !== undefined ? { sprint_id: task.sprintId } : {}),
        ...(task.dueOn !== undefined ? { due_on: task.dueOn } : {}),
      }
      return toTask(must(await sb.from('tasks').upsert(row).select().single()) as TaskRow)
    },

    async deleteTask(id) {
      const { data: auth } = await sb.auth.getUser()
      must(await sb.from('tasks').update({ deleted_at: new Date().toISOString(), deleted_by: auth.user?.id ?? null }).eq('id', id))
      liveChannel?.send({ type: 'broadcast', event: 'task-deleted', payload: { id } })
    },

    async listComments(taskId) {
      const rows = must(await sb.from('task_comments').select('id, task_id, author_id, body, created_at').eq('task_id', taskId).is('deleted_at', null).order('created_at')) as { id: string; task_id: string; author_id: string; body: string; created_at: string }[]
      return rows.map((r) => ({ id: r.id, taskId: r.task_id, authorId: r.author_id, body: r.body, createdAt: r.created_at }))
    },

    async addComment(taskId, body) {
      const r = must(await sb.from('task_comments').insert({ task_id: taskId, group_id: groupId, body }).select('id, task_id, author_id, body, created_at').single()) as { id: string; task_id: string; author_id: string; body: string; created_at: string }
      return { id: r.id, taskId: r.task_id, authorId: r.author_id, body: r.body, createdAt: r.created_at }
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

    async sendMessage(channelId, body, files = []) {
      const attachments: Attachment[] = []
      for (const file of files) {
        if (file.size > 25 * 1024 * 1024) throw new Error(`${file.name} dépasse 25 Mo`)
        const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').slice(-80) || 'fichier'
        const path = `${groupId}/chat/${crypto.randomUUID()}-${safe}`
        const mime = file.type || 'application/octet-stream'
        must(await sb.storage.from('documents').upload(path, file, { contentType: mime }))
        attachments.push({ path, name: file.name.slice(0, 200), size: file.size, mime })
      }
      const row = must(
        await sb.from('messages').insert({ channel_id: channelId, group_id: groupId, body, ...(attachments.length ? { attachments } : {}) }).select().single(),
      )
      return toMessage(row as MessageRow)
    },

    async attachmentUrls(paths) {
      if (!paths.length) return {}
      const { data } = await sb.storage.from('documents').createSignedUrls(paths, 3600)
      return Object.fromEntries((data ?? []).filter((d) => d.signedUrl && d.path).map((d) => [d.path!, d.signedUrl as string]))
    },

    chatActions: () => chatReady,

    async editMessage(id, body) {
      must(await sb.from('messages').update({ body }).eq('id', id))
      liveChannel?.send({ type: 'broadcast', event: 'message-updated', payload: { id } })
    },

    async deleteMessage(id) {
      must(await sb.from('messages').update({ deleted_at: new Date().toISOString() }).eq('id', id))
      liveChannel?.send({ type: 'broadcast', event: 'message-updated', payload: { id } })
    },

    async react(messageId, emoji, on) {
      const { data: auth } = await sb.auth.getUser()
      if (!auth.user) return
      if (on) must(await sb.from('message_reactions').upsert({ message_id: messageId, group_id: groupId, user_id: auth.user.id, emoji }, { ignoreDuplicates: true }))
      else must(await sb.from('message_reactions').delete().eq('message_id', messageId).eq('user_id', auth.user.id).eq('emoji', emoji))
      liveChannel?.send({ type: 'broadcast', event: 'reaction', payload: { messageId, emoji, userId: auth.user.id, on } })
    },

    async createChannel(name) {
      const clean = name.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 40)
      return must(await sb.from('channels').insert({ group_id: groupId, name: clean }).select('id, name').single()) as Channel
    },

    async renameChannel(id, name) {
      const clean = name.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-').slice(0, 40)
      if (!clean) throw new Error('Donne un nom au salon')
      must(await sb.from('channels').update({ name: clean }).eq('id', id).select('id').single())
      // Salon relié : le salon Discord prend le même nom.
      const { data } = await sb.rpc('discord_links', { gid: groupId })
      if (((data ?? []) as { channel_id: string }[]).some((l) => l.channel_id === id)) await discordCall('rename', { channelId: id }).catch(() => undefined)
    },

    async deleteChannel(id) {
      const { data: auth } = await sb.auth.getUser()
      const { data } = await sb.rpc('discord_links', { gid: groupId })
      if (((data ?? []) as { channel_id: string }[]).some((l) => l.channel_id === id)) await discordCall('unlink', { channelId: id })
      must(await sb.from('channels').update({ deleted_at: new Date().toISOString(), deleted_by: auth.user?.id ?? null }).eq('id', id).select('id').single())
    },

    async listTrash() {
      const { data, error } = await sb.rpc('list_trash', { gid: groupId })
      if (error) return null
      type Row = { kind: 'task' | 'link'; id: string; title: string; deleted_at: string; deleted_by: string | null }
      return (data as Row[]).map((r) => ({ kind: r.kind, id: r.id, title: r.title, deletedAt: r.deleted_at, deletedBy: r.deleted_by }))
    },

    async restoreItem(kind, id) {
      must(await sb.rpc('restore_item', { item_kind: kind, item_id: id }))
    },

    async listDeletedGroups() {
      const { data, error } = await sb.rpc('list_deleted_groups')
      if (error) return []
      return (data as { id: string; name: string; deleted_at: string }[]).map((g) => ({ id: g.id, name: g.name, deletedAt: g.deleted_at }))
    },

    async restoreGroup(id) {
      must(await sb.rpc('restore_group', { gid: id }))
    },

    async addLink(title, url) {
      return must(await sb.from('links').insert({ title, url, group_id: groupId }).select('id, title, url').single()) as LinkItem
    },

    async uploadDocument(file) {
      const { data: auth } = await sb.auth.getUser()
      const safe = file.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w.-]+/g, '-').slice(-80) || 'fichier'
      const path = `${groupId}/${crypto.randomUUID()}-${safe}`
      const mime = file.type || 'application/octet-stream'
      must(await sb.storage.from('documents').upload(path, file, { contentType: mime }))
      const row = must(
        await sb.from('documents').insert({ group_id: groupId, name: file.name.slice(0, 200), path, mime, size: file.size, uploaded_by: auth.user?.id }).select('*').single(),
      ) as DocumentRow
      return toDocument(row)
    },

    async documentUrl(doc) {
      const { data, error } = await sb.storage.from('documents').createSignedUrl(doc.path, 3600)
      if (error || !data) throw new Error('Fichier introuvable')
      return data.signedUrl
    },

    async renameDocument(id, name) {
      must(await sb.from('documents').update({ name: name.trim().slice(0, 200) }).eq('id', id))
    },

    async removeDocument(id) {
      const { data: auth } = await sb.auth.getUser()
      must(await sb.from('documents').update({ deleted_at: new Date().toISOString(), deleted_by: auth.user?.id ?? null }).eq('id', id))
    },

    joinRoom(room, h, opts) {
      let me = ''
      const ch = sb.channel(`room:${groupId}:${room}`, { config: { broadcast: { self: false }, presence: { key: crypto.randomUUID() } } })
      const pending: Omit<RoomEvent, 'from'>[] = []
      let tracked = !opts?.listen
      let ready = false
      ch.on('broadcast', { event: 'room' }, ({ payload }) => h.onEvent(payload as RoomEvent))
        .on('presence', { event: 'sync' }, () => {
          const state = ch.presenceState<{ userId: string }>()
          h.onPeers([...new Set(Object.values(state).flat().map((s) => s.userId))])
        })
        .subscribe(async (status) => {
          if (status !== 'SUBSCRIBED') return
          const { data } = await sb.auth.getUser()
          me = data.user?.id ?? ''
          if (me && tracked) await ch.track({ userId: me })
          ready = true
          for (const e of pending.splice(0)) void ch.send({ type: 'broadcast', event: 'room', payload: { ...e, from: me } })
        })
      return {
        send(e) {
          if (!ready) pending.push(e)
          else void ch.send({ type: 'broadcast', event: 'room', payload: { ...e, from: me } })
        },
        setPresent(on) {
          tracked = on
          if (!ready || !me) return
          if (on) void ch.track({ userId: me })
          else void ch.untrack()
        },
        leave() {
          void sb.removeChannel(ch)
        },
      }
    },

    async createNote(title, kind = 'page') {
      const { data: auth } = await sb.auth.getUser()
      const row = { group_id: groupId, title: title.trim() || 'Sans titre', created_by: auth.user?.id }
      const made = noteMeta ? await sb.from('notes').insert({ ...row, kind }).select(NOTE_COLS).single() : null
      if (made && !made.error) return toNote(made.data as unknown as NoteRow)
      noteMeta = false
      return { ...toNote(must(await sb.from('notes').insert(row).select(NOTE_BASE).single()) as unknown as NoteRow), kind }
    },

    async loadNote(id) {
      const row = must(await sb.from('notes').select('ystate').eq('id', id).single()) as { ystate: string }
      return row.ystate
    },

    async saveNote(id, patch) {
      const row: Record<string, string> = {}
      if (patch.ystate !== undefined) row.ystate = patch.ystate
      if (patch.preview !== undefined) row.preview = patch.preview.slice(0, 2000)
      if (patch.title !== undefined) row.title = patch.title.trim().slice(0, 200) || 'Sans titre'
      const meta: Record<string, string | boolean> = {}
      if (patch.kind !== undefined) meta.kind = patch.kind
      if (patch.pinned !== undefined) meta.pinned = patch.pinned
      if (Object.keys(meta).length) {
        if (!noteMeta) throw new Error('Mise à jour en attente : la base doit être mise à jour pour les types de documents')
        must(await sb.from('notes').update(meta).eq('id', id))
      }
      if (Object.keys(row).length) must(await sb.from('notes').update(row).eq('id', id))
    },

    async removeNote(id) {
      const { data: auth } = await sb.auth.getUser()
      must(await sb.from('notes').update({ deleted_at: new Date().toISOString(), deleted_by: auth.user?.id ?? null }).eq('id', id))
    },

    async createSprint(sp) {
      const row = must(
        await sb.from('sprints').insert({ group_id: groupId, name: sp.name, goal: sp.goal, starts_on: sp.startsOn, ends_on: sp.endsOn, status: sp.status }).select('*').single(),
      ) as SprintRow
      return toSprint(row)
    },

    async updateSprint(id, patch) {
      const row: Record<string, unknown> = {}
      if (patch.name !== undefined) row.name = patch.name
      if (patch.goal !== undefined) row.goal = patch.goal
      if (patch.startsOn !== undefined) row.starts_on = patch.startsOn
      if (patch.endsOn !== undefined) row.ends_on = patch.endsOn
      if (patch.status !== undefined) row.status = patch.status
      if (patch.closedAt !== undefined) row.closed_at = patch.closedAt
      must(await sb.from('sprints').update(row).eq('id', id))
    },

    async removeLink(id) {
      const { data: auth } = await sb.auth.getUser()
      must(await sb.from('links').update({ deleted_at: new Date().toISOString(), deleted_by: auth.user?.id ?? null }).eq('id', id))
    },

    async updateLink(id, patch) {
      must(await sb.from('links').update({ title: patch.title, url: patch.url }).eq('id', id))
    },

    async setDiscordWebhook(webhook) {
      must(await sb.rpc('set_discord_webhook', { gid: groupId, webhook }))
    },

    push: {
      async publicKey() {
        const { data, error } = await sb.functions.invoke('send-push', { method: 'GET' })
        if (error || !data?.publicKey) throw new Error('Notifications indisponibles pour le moment')
        return data.publicKey as string
      },
      async subscribe(subscription) {
        const { error } = await sb.functions.invoke('send-push', { body: { action: 'subscribe', subscription } })
        if (error) throw new Error('Activation impossible')
      },
      async unsubscribe(endpoint) {
        await sb.functions.invoke('send-push', { body: { action: 'unsubscribe', endpoint } }).catch(() => undefined)
      },
      async test() {
        const { data, error } = await sb.functions.invoke('send-push', { body: { action: 'test' } })
        if (error) throw new Error('Envoi impossible')
        return (data?.sent as number) ?? 0
      },
    },

    async notifyDiscord(event) {
      if (!groupId) return
      // Best effort : une notification ratée ne doit pas bloquer l'action.
      await sb.functions.invoke('notify-discord', { body: { groupId, event } }).catch(() => undefined)
    },

    async discordState() {
      if (!groupId) return { guild: null, links: [] }
      const [g, l, a] = await Promise.all([
        sb.from('group_discord').select('guild_id, guild_name, guild_icon').eq('group_id', groupId).maybeSingle(),
        sb.rpc('discord_links', { gid: groupId }),
        sb.from('discord_accounts').select('discord_name, discord_avatar').maybeSingle(),
      ])
      const acc = a.data as { discord_name: string; discord_avatar: string | null } | null
      // Base pas encore à jour : Discord simplement absent.
      if (g.error || l.error) return { guild: null, links: [] }
      const row = g.data as { guild_id: string; guild_name: string; guild_icon: string | null } | null
      return {
        guild: row ? { id: row.guild_id, name: row.guild_name, iconUrl: row.guild_icon ? `https://cdn.discordapp.com/icons/${row.guild_id}/${row.guild_icon}.png?size=64` : null } : null,
        links: ((l.data ?? []) as { channel_id: string; discord_channel_id: string; discord_channel_name: string }[]).map((r) => ({
          channelId: r.channel_id, discordChannelId: r.discord_channel_id, discordChannelName: r.discord_channel_name,
        })),
        account: acc ? { name: acc.discord_name, avatar: acc.discord_avatar } : null,
      }
    },

    async connectDiscordAccount() {
      const { url } = await discordCall<{ url: string }>('start', { who: 'me' })
      const { data: auth } = await sb.auth.getUser()
      const since = Date.now()
      await oauthWindow(url, async () => {
        const { data } = await sb.from('discord_accounts').select('linked_at').eq('user_id', auth.user?.id ?? '').maybeSingle()
        return !!data && new Date(data.linked_at as string).getTime() >= since - 60_000
      }, 'Discord')
    },

    async unlinkDiscordAccount() {
      const { data: auth } = await sb.auth.getUser()
      must(await sb.from('discord_accounts').delete().eq('user_id', auth.user?.id ?? ''))
    },

    async connectDiscord() {
      const { url } = await discordCall<{ url: string }>('start')
      const gid = groupId
      await oauthWindow(url, async () => {
        const { data } = await sb.from('group_discord').select('group_id').eq('group_id', gid).maybeSingle()
        return !!data
      }, 'Discord')
    },

    async disconnectDiscord() {
      await discordCall('disconnect')
    },

    async listDiscordChannels() {
      return (await discordCall<{ channels: DiscordChannel[] }>('channels')).channels
    },

    async linkDiscordChannel(channelId, discordChannelId) {
      return discordCall<DiscordLink>('link', discordChannelId ? { channelId, discordChannelId } : { channelId, create: true })
    },

    async unlinkDiscordChannel(channelId) {
      await discordCall('unlink', { channelId })
    },

    async importDiscordChannels() {
      return discordCall<{ merged: number; created: number; failed: number }>('import')
    },
  }

  /** Appel à la fonction serveur Discord ; son message d'erreur est montré tel quel. */
  async function discordCall<T = unknown>(action: string, extra: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await sb.functions.invoke('discord', { body: { action, groupId, ...extra } })
    if (error) {
      const ctx = (error as { context?: Response }).context
      const msg = ctx ? ((await ctx.json().catch(() => null)) as { error?: string } | null)?.error : null
      throw new Error(msg ?? 'Discord ne répond pas, réessaie dans un instant.')
    }
    return data as T
  }
}
