import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { newId, type Backend, type GroupSummary, type User, type Workspace } from './backend'
import { APP_BASE, IS_TAURI } from './base'
import { demoBackend, startDemoSession } from './demo'
import { setPrState } from './prState'
import { flushOutbox, markNewTask, pendingList, withOffline } from './offline'
import { createSupabaseBackend } from './supabaseBackend'
import type { AppNotification, Message, ReactionChange, Task } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Démo forcée par `?demo=1` (bouton « Essayer sans s'inscrire » du site), gardée pour la session. */
const DEMO_FLAG = 'kollab-demo'
function demoRequested(): boolean {
  try {
    const params = new URLSearchParams(location.search)
    if (params.get('demo') === '1') {
      sessionStorage.setItem(DEMO_FLAG, '1')
      params.delete('demo')
      const rest = params.toString()
      history.replaceState(history.state, '', location.pathname + (rest ? `?${rest}` : '') + location.hash)
    }
    return sessionStorage.getItem(DEMO_FLAG) === '1'
  } catch {
    return false
  }
}

export const DEMO_SESSION = demoRequested()
if (DEMO_SESSION) startDemoSession()

export const backend: Backend = !DEMO_SESSION && url && key ? withOffline(createSupabaseBackend(url, key)) : demoBackend

/** Quitte la démo et ouvre le vrai formulaire d'inscription. */
export function leaveDemo() {
  try {
    sessionStorage.removeItem(DEMO_FLAG)
  } catch {
    /* rien à nettoyer */
  }
  location.assign(`${APP_BASE}/?inscription=1`)
}

interface Store {
  backend: Backend
  user: User | null
  ready: boolean
  /** Erreur au chargement du groupe (réseau, serveur) : on l'affiche au lieu de rester bloqué. */
  loadError: string | null
  workspace: Workspace | null
  /** Tous les projets de l'utilisateur, pour le sélecteur. */
  groups: GroupSummary[]
  /** Ouvre un autre projet (mémorisé pour la prochaine visite). */
  switchGroup(id: string): Promise<void>
  online: string[]
  /** Dernier message reçu, pour que le chat l'ajoute s'il est dans le bon salon. */
  incoming: Message | null
  /** Dernier message modifié ou supprimé. */
  messageUpdate: Message | null
  /** Dernière réaction ajoutée ou retirée par quelqu'un d'autre. */
  reactionChange: ReactionChange | null
  reload(): Promise<void>
  saveTask(task: Task): Promise<void>
  createTask(partial: Pick<Task, 'title' | 'status'> & Partial<Task>): Promise<Task>
  deleteTask(id: string): Promise<void>
  memberName(id: string | null): string
  /** Notifications (attribution, mention, invitation), récentes d'abord. */
  notifications: AppNotification[]
  unread: number
  markAllRead(): Promise<void>
  removeNotification(id: string): Promise<void>
}

/** Pastille sur l'icône de l'app (ordinateur et app installée). */
function setAppBadge(count: number) {
  if (IS_TAURI) {
    void import('@tauri-apps/api/window')
      .then(({ getCurrentWindow }) => getCurrentWindow().setBadgeCount(count || undefined))
      .catch(() => {})
    return
  }
  const nav = navigator as Navigator & { setAppBadge?: (n?: number) => Promise<void>; clearAppBadge?: () => Promise<void> }
  if (count) void nav.setAppBadge?.(count).catch(() => {})
  else void nav.clearAppBadge?.().catch(() => {})
}

/** Création automatique de la branche et de la PR quand une tâche passe « En cours » (réglage du projet, sur cet appareil). */
export function autoPrEnabled(groupId: string): boolean {
  try {
    return localStorage.getItem(`kollab-auto-pr:${groupId}`) !== '0'
  } catch {
    return true
  }
}
export function setAutoPr(groupId: string, on: boolean) {
  try {
    localStorage.setItem(`kollab-auto-pr:${groupId}`, on ? '1' : '0')
  } catch {
    /* ignoré */
  }
}

const Ctx = createContext<Store | null>(null)

const CURRENT_KEY = 'kollab-projet'
export function rememberGroup(id: string | null) {
  try {
    if (id) localStorage.setItem(CURRENT_KEY, id)
    else localStorage.removeItem(CURRENT_KEY)
  } catch {
    /* sans stockage, on rouvre le premier projet */
  }
}
function rememberedGroup(): string | null {
  try {
    return localStorage.getItem(CURRENT_KEY)
  } catch {
    return null
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [groups, setGroups] = useState<GroupSummary[]>([])
  const workspaceRef = useRef<Workspace | null>(null)
  workspaceRef.current = workspace
  const [online, setOnline] = useState<string[]>([])
  const [incoming, setIncoming] = useState<Message | null>(null)
  const [messageUpdate, setMessageUpdate] = useState<Message | null>(null)
  const [reactionChange, setReactionChange] = useState<ReactionChange | null>(null)
  const [notifications, setNotifications] = useState<AppNotification[]>([])

  // Plusieurs rechargements peuvent se croiser (connexion, retour du réseau…) : seul le dernier compte,
  // sinon un ancien résultat vide pouvait faire croire qu'on n'a aucun projet.
  const reloadSeq = useRef(0)
  const reload = useCallback(async () => {
    const seq = ++reloadSeq.current
    try {
      const u = await backend.currentUser()
      if (u) {
        const [w, list] = await Promise.all([backend.loadWorkspace(rememberedGroup()), backend.listGroups()])
        if (seq !== reloadSeq.current) return
        setUser(u)
        setWorkspace(w)
        setGroups(list)
      } else {
        if (seq !== reloadSeq.current) return
        setUser(null)
        setWorkspace(null)
        setGroups([])
      }
      setLoadError(null)
    } catch (e) {
      if (seq !== reloadSeq.current) return
      setLoadError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      if (seq === reloadSeq.current) setReady(true)
    }
  }, [])

  useEffect(() => {
    void reload()
    return backend.onAuthChange(() => void reload())
  }, [reload])

  // Retour du réseau : on recharge, on envoie ce qui attendait, puis on recharge encore.
  useEffect(() => {
    if (DEMO_SESSION) return
    async function back() {
      if (!navigator.onLine) return
      if (!pendingList().length) return void reload()
      await reload()
      if (await flushOutbox(backend)) await reload()
    }
    void back()
    window.addEventListener('online', back)
    return () => window.removeEventListener('online', back)
  }, [reload])

  const groupId = workspace?.group.id
  useEffect(() => {
    if (!groupId) return
    return backend.live(groupId, {
      onTask: (task) =>
        setWorkspace((w) => {
          if (!w) return w
          const exists = w.tasks.some((t) => t.id === task.id)
          return { ...w, tasks: exists ? w.tasks.map((t) => (t.id === task.id ? task : t)) : [...w.tasks, task] }
        }),
      onTaskDeleted: (id) => setWorkspace((w) => (w ? { ...w, tasks: w.tasks.filter((t) => t.id !== id) } : w)),
      onMessage: setIncoming,
      onMessageUpdated: setMessageUpdate,
      onReaction: setReactionChange,
      onPresence: setOnline,
      onRefresh: () => void reload(),
    })
  }, [groupId, reload])

  // Au retour sur l'onglet (ou réveil de l'ordinateur), on rattrape ce qui a pu être manqué.
  useEffect(() => {
    if (!user) return
    let last = Date.now()
    const onVisible = () => {
      if (document.visibilityState !== 'visible' || Date.now() - last < 15000) return
      last = Date.now()
      void reload()
      void backend.listNotifications().then(setNotifications).catch(() => {})
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [user, reload])

  const userId = user?.id
  useEffect(() => {
    if (!userId) {
      setNotifications([])
      return
    }
    // Les invitations reçues par email avant d'avoir un compte arrivent ici en notifications.
    void backend.claimEmailInvites().catch(() => 0).then(() => backend.listNotifications()).then(setNotifications).catch(() => {})
    return backend.watchNotifications((n) => {
      setNotifications((list) => (list.some((x) => x.id === n.id) ? list : [n, ...list]))
      // Une invitation ou un nouveau membre peut changer la liste des projets.
      if (n.kind === 'invited' || n.kind === 'joined') void reload()
    })
  }, [userId, reload])

  const unread = notifications.filter((n) => !n.readAt).length
  useEffect(() => {
    setAppBadge(unread)
  }, [unread])

  const markAllRead = useCallback(async () => {
    const ids = notifications.filter((n) => !n.readAt).map((n) => n.id)
    if (!ids.length) return
    const at = new Date().toISOString()
    setNotifications((list) => list.map((n) => (ids.includes(n.id) ? { ...n, readAt: at } : n)))
    await backend.markNotificationsRead(ids)
  }, [notifications])

  const removeNotification = useCallback(async (id: string) => {
    setNotifications((list) => list.filter((n) => n.id !== id))
    await backend.deleteNotification(id)
  }, [])

  const switchGroup = useCallback(
    async (id: string) => {
      rememberGroup(id)
      setOnline([])
      await reload()
    },
    [reload],
  )

  const autoPrBusy = useRef(new Set<string>())

  // PR fusionnée sur GitHub : la tâche passe « Terminé » toute seule, sans qu'on ait à l'ouvrir.
  useEffect(() => {
    if (!groupId || backend.mode === 'demo') return
    let alive = true
    async function sweep() {
      const ws = workspaceRef.current
      if (!ws || document.visibilityState !== 'visible' || !navigator.onLine) return
      const gh = await import('./github')
      // Sans GitHub relié, on ne vérifie pas : le quota public (60 appels par heure) servirait à vide.
      if (!gh.ghToken()) return
      const open = ws.tasks.filter((t) => t.prUrl && t.status !== 'done').slice(0, 30)
      for (const t of open) {
        const ref = gh.parsePrUrl(t.prUrl)
        if (!ref || !alive) continue
        try {
          const pr = await gh.getPull(ref, ref.number)
          let checks = null
          if (!pr.merged && pr.state === 'open' && gh.ghToken()) checks = gh.summarize(await gh.checkRuns(ref, pr.sha).catch(() => []))
          setPrState(t.prUrl!, { merged: pr.merged, closed: pr.state === 'closed' && !pr.merged, draft: pr.draft, checks: checks && checks.total ? checks : null })
          const latest = workspaceRef.current?.tasks.find((x) => x.id === t.id)
          if (pr.merged && latest && latest.status !== 'done') await saveTaskRef.current({ ...latest, status: 'done' })
        } catch {
          /* GitHub indisponible : on réessaiera */
        }
      }
    }
    const first = setTimeout(() => void sweep(), 4000)
    const every = setInterval(() => void sweep(), 5 * 60e3)
    const onShow = () => document.visibilityState === 'visible' && void sweep()
    document.addEventListener('visibilitychange', onShow)
    return () => { alive = false; clearTimeout(first); clearInterval(every); document.removeEventListener('visibilitychange', onShow) }
  }, [groupId]) // eslint-disable-line react-hooks/exhaustive-deps
  const saveTask = useCallback(async (task: Task) => {
    const before = workspaceRef.current?.tasks.find((t) => t.id === task.id)
    // Date de fin tenue à jour tout de suite (la base fait de même).
    task = { ...task, doneAt: task.status === 'done' ? task.doneAt ?? before?.doneAt ?? new Date().toISOString() : null }
    // Mise à jour optimiste : l'écran réagit tout de suite.
    setWorkspace((w) => (w ? { ...w, tasks: w.tasks.map((t) => (t.id === task.id ? task : t)) } : w))
    await backend.saveTask(task)
    // Tâche qui passe « En cours » sans PR : on crée la branche et la PR toutes seules.
    const ws = workspaceRef.current
    if (task.status !== 'doing' || before?.status === 'doing' || task.prUrl || !ws || !autoPrEnabled(ws.group.id)) return
    if (autoPrBusy.current.has(task.id)) return
    const gh = await import('./github')
    const repo = gh.projectRepo(ws)
    if (!repo || !gh.ghToken()) return
    autoPrBusy.current.add(task.id)
    try {
      const prUrl = await gh.createTaskPr(repo, task)
      const latest = workspaceRef.current?.tasks.find((t) => t.id === task.id) ?? task
      const next = { ...latest, prUrl }
      setWorkspace((w) => (w ? { ...w, tasks: w.tasks.map((t) => (t.id === task.id ? next : t)) } : w))
      await backend.saveTask(next)
    } catch {
      /* GitHub indisponible : la tâche reste sans PR, on peut la créer à la main */
    } finally {
      autoPrBusy.current.delete(task.id)
    }
  }, [])

  const saveTaskRef = useRef(saveTask)
  useEffect(() => { saveTaskRef.current = saveTask }, [saveTask])

  const createTask = useCallback(
    async (partial: Pick<Task, 'title' | 'status'> & Partial<Task>) => {
      const sameColumn = workspace?.tasks.filter((t) => t.status === partial.status) ?? []
      const task: Task = {
        id: newId(),
        description: '',
        kind: 'feature',
        points: null,
        assigneeIds: [],
        prUrl: null,
        position: sameColumn.length ? Math.max(...sameColumn.map((t) => t.position)) + 1 : 0,
        createdAt: new Date().toISOString(),
        // Créée pendant un sprint : elle en fait partie.
        sprintId: workspace?.sprints.find((s) => s.status === 'active')?.id ?? null,
        ...partial,
      }
      setWorkspace((w) => (w ? { ...w, tasks: [...w.tasks, task] } : w))
      await backend.saveTask(task)
      markNewTask(task)
      return task
    },
    [workspace],
  )

  const deleteTask = useCallback(async (id: string) => {
    setWorkspace((w) => (w ? { ...w, tasks: w.tasks.filter((t) => t.id !== id) } : w))
    await backend.deleteTask(id)
  }, [])

  const memberName = useCallback(
    (id: string | null) => workspace?.members.find((m) => m.id === id)?.name ?? 'Personne',
    [workspace],
  )

  const value = useMemo<Store>(
    () => ({ backend, user, ready, loadError, workspace, groups, switchGroup, online, incoming, messageUpdate, reactionChange, reload, saveTask, createTask, deleteTask, memberName, notifications, unread, markAllRead, removeNotification }),
    [user, ready, loadError, workspace, groups, switchGroup, online, incoming, messageUpdate, reactionChange, reload, saveTask, createTask, deleteTask, memberName, notifications, unread, markAllRead, removeNotification],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore(): Store {
  const s = useContext(Ctx)
  if (!s) throw new Error('useStore hors de StoreProvider')
  return s
}

/** Raccourci pour les écrans qui ont besoin d'un groupe chargé. */
export function useWorkspace(): Workspace {
  const { workspace } = useStore()
  if (!workspace) throw new Error('Aucun groupe chargé')
  return workspace
}
