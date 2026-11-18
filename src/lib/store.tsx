import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { newId, type Backend, type User, type Workspace } from './backend'
import { demoBackend } from './demo'
import { createSupabaseBackend } from './supabaseBackend'
import type { Message, Task } from './types'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const backend: Backend = url && key ? createSupabaseBackend(url, key) : demoBackend

interface Store {
  backend: Backend
  user: User | null
  ready: boolean
  /** Erreur au chargement du groupe (réseau, serveur) : on l'affiche au lieu de rester bloqué. */
  loadError: string | null
  workspace: Workspace | null
  online: string[]
  /** Dernier message reçu, pour que le chat l'ajoute s'il est dans le bon salon. */
  incoming: Message | null
  reload(): Promise<void>
  saveTask(task: Task): Promise<void>
  createTask(partial: Pick<Task, 'title' | 'status'> & Partial<Task>): Promise<Task>
  deleteTask(id: string): Promise<void>
  memberName(id: string | null): string
}

const Ctx = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [online, setOnline] = useState<string[]>([])
  const [incoming, setIncoming] = useState<Message | null>(null)

  const reload = useCallback(async () => {
    try {
      const u = await backend.currentUser()
      setUser(u)
      setWorkspace(u ? await backend.loadWorkspace() : null)
      setLoadError(null)
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Chargement impossible')
    } finally {
      setReady(true)
    }
  }, [])

  useEffect(() => {
    void reload()
    return backend.onAuthChange(() => void reload())
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
      onPresence: setOnline,
    })
  }, [groupId])

  const saveTask = useCallback(async (task: Task) => {
    // Mise à jour optimiste : l'écran réagit tout de suite.
    setWorkspace((w) => (w ? { ...w, tasks: w.tasks.map((t) => (t.id === task.id ? task : t)) } : w))
    await backend.saveTask(task)
  }, [])

  const createTask = useCallback(
    async (partial: Pick<Task, 'title' | 'status'> & Partial<Task>) => {
      const sameColumn = workspace?.tasks.filter((t) => t.status === partial.status) ?? []
      const task: Task = {
        id: newId(),
        description: '',
        kind: 'feature',
        points: null,
        assigneeId: null,
        prUrl: null,
        position: sameColumn.length ? Math.max(...sameColumn.map((t) => t.position)) + 1 : 0,
        createdAt: new Date().toISOString(),
        ...partial,
      }
      setWorkspace((w) => (w ? { ...w, tasks: [...w.tasks, task] } : w))
      await backend.saveTask(task)
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
    () => ({ backend, user, ready, loadError, workspace, online, incoming, reload, saveTask, createTask, deleteTask, memberName }),
    [user, ready, loadError, workspace, online, incoming, reload, saveTask, createTask, deleteTask, memberName],
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
