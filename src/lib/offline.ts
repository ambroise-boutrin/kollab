import type { Backend, User, Workspace } from './backend'
import type { Message, Task } from './types'

/**
 * Hors ligne : on garde une copie du projet sur l'appareil et on met de côté les changements
 * (tâches, sprints, messages, profil) pour les envoyer dans l'ordre au retour du réseau.
 */

export interface Pending {
  id: string
  method: 'saveTask' | 'deleteTask' | 'sendMessage' | 'updateSprint' | 'updateProfile' | 'saveNote' | 'addComment'
  args: unknown[]
  label: string
  kind: 'task' | 'new' | 'message' | 'other'
  at: string
}

const QUEUE = 'kollab-outbox'
const FAILED = 'kollab-outbox-failed'
const CACHE = 'kollab-cache:'

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : fallback
  } catch {
    return fallback
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* stockage plein ou bloqué : tant pis pour la copie */
  }
}

export const pendingList = () => read<Pending[]>(QUEUE, [])
const emit = () => window.dispatchEvent(new Event('kollab:outbox'))

/** Erreur de réseau (et pas un refus du serveur) : on met de côté plutôt que d'échouer. */
export function isNetworkError(e: unknown) {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  const msg = e instanceof Error ? e.message : String(e ?? '')
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed|err_internet_disconnected/i.test(msg)
}

function enqueue(p: Omit<Pending, 'id' | 'at'>) {
  const list = pendingList()
  // Une tâche modifiée plusieurs fois : seule la dernière version compte.
  const taskId = p.method === 'saveTask' ? (p.args[0] as Task).id : null
  const kept = taskId ? list.filter((x) => !(x.method === 'saveTask' && (x.args[0] as Task).id === taskId)) : list
  const wasNew = taskId && list.some((x) => x.kind === 'new' && (x.args[0] as Task).id === taskId)
  const label = wasNew ? `Nouvelle tâche **${(p.args[0] as Task).title}**` : p.label
  kept.push({ ...p, label, kind: wasNew ? 'new' : p.kind, id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, at: new Date().toISOString() })
  write(QUEUE, kept)
  emit()
}

const STATUS_LABEL: Record<string, string> = { todo: 'remise à faire', doing: 'passée en cours', review: 'passée en revue', done: 'terminée' }

let flushing = false
/** Envoie ce qui attend, dans l'ordre. Renvoie le nombre de changements envoyés. */
export async function flushOutbox(b: Backend): Promise<number> {
  if (flushing || !navigator.onLine) return 0
  flushing = true
  let sent = 0
  try {
    for (;;) {
      const [next] = pendingList()
      if (!next) break
      try {
        await (b[next.method] as (...a: unknown[]) => Promise<unknown>)(...next.args)
        sent++
      } catch (e) {
        if (isNetworkError(e)) break
        // Refusé par le serveur : on le garde à part pour ne rien perdre, et on passe au suivant.
        write(FAILED, [...read<Pending[]>(FAILED, []), { ...next, error: e instanceof Error ? e.message : String(e) }])
      }
      write(QUEUE, pendingList().filter((x) => x.id !== next.id))
      emit()
    }
  } finally {
    flushing = false
  }
  if (sent) window.dispatchEvent(new CustomEvent('kollab:outbox-sent', { detail: sent }))
  return sent
}

export function clearOfflineCopy() {
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith(CACHE)) localStorage.removeItem(k)
  } catch {
    /* rien à effacer */
  }
}

/** Enveloppe le vrai backend : lectures servies depuis la copie, écritures mises de côté hors ligne. */
export function withOffline(b: Backend): Backend {
  let me: User | null = read<User | null>(`${CACHE}user`, null)

  async function cached<T>(key: string, load: () => Promise<T>): Promise<T> {
    if (!navigator.onLine) {
      const copy = read<T | undefined>(CACHE + key, undefined)
      if (copy !== undefined) return copy
    }
    try {
      const v = await load()
      write(CACHE + key, v)
      return v
    } catch (e) {
      const copy = read<T | undefined>(CACHE + key, undefined)
      if (isNetworkError(e) && copy !== undefined) return copy
      throw e
    }
  }

  async function orQueue<T>(run: () => Promise<T>, p: Omit<Pending, 'id' | 'at'>, local: () => T): Promise<T> {
    // Des changements attendent déjà : on garde l'ordre en passant derrière eux.
    if (navigator.onLine && !pendingList().length) {
      try {
        return await run()
      } catch (e) {
        if (!isNetworkError(e)) throw e
      }
    }
    enqueue(p)
    return local()
  }

  return {
    ...b,
    async currentUser() {
      if (!navigator.onLine && me) return me
      try {
        const u = await b.currentUser()
        if (u || navigator.onLine) {
          me = u
          write(`${CACHE}user`, u)
        }
        return u ?? (!navigator.onLine ? me : null)
      } catch (e) {
        if (isNetworkError(e) && me) return me
        throw e
      }
    },
    async signOut() {
      clearOfflineCopy()
      write(QUEUE, [])
      me = null
      return b.signOut()
    },
    async loadWorkspace(gid) {
      const ws = await cached(`ws:${gid ?? 'last'}`, () => b.loadWorkspace(gid))
      return ws && pendingList().length ? withPending(ws) : ws
    },
    listGroups: () => cached('groups', () => b.listGroups()),
    listMessages: (cid) => cached(`msg:${cid}`, () => b.listMessages(cid)),
    async listComments(tid) {
      const list = await cached(`com:${tid}`, () => b.listComments(tid))
      const mine = pendingList().filter((p) => p.method === 'addComment' && p.args[0] === tid)
      return [...list, ...mine.map((p) => ({ id: p.id, taskId: tid, authorId: me?.id ?? '', body: p.args[1] as string, createdAt: p.at }))]
    },
    addComment: (tid, body) =>
      orQueue(() => b.addComment(tid, body), { method: 'addComment', args: [tid, body], kind: 'message', label: `Commentaire « ${body.length > 40 ? `${body.slice(0, 40)}…` : body} »` }, () => ({
        id: `local-${Date.now()}`, taskId: tid, authorId: me?.id ?? '', body, createdAt: new Date().toISOString(),
      })),
    loadNote: (id) => cached(`note:${id}`, () => b.loadNote(id)),
    saveTask: (task) =>
      orQueue(() => b.saveTask(task), {
        method: 'saveTask',
        args: [task],
        kind: 'task',
        label: `**${task.title}** ${STATUS_LABEL[task.status] ?? 'modifiée'}`,
      }, () => task),
    deleteTask: (id) => orQueue(() => b.deleteTask(id), { method: 'deleteTask', args: [id], kind: 'other', label: 'Tâche supprimée' }, () => undefined),
    sendMessage: (cid, body) =>
      orQueue(() => b.sendMessage(cid, body), { method: 'sendMessage', args: [cid, body], kind: 'message', label: `Message « ${body.length > 40 ? `${body.slice(0, 40)}…` : body} »` }, (): Message => ({
        id: `local-${Date.now()}`,
        channelId: cid,
        authorId: me?.id ?? '',
        body,
        createdAt: new Date().toISOString(),
        reactions: [],
      })),
    updateSprint: (id, patch) => orQueue(() => b.updateSprint(id, patch), { method: 'updateSprint', args: [id, patch], kind: 'other', label: 'Sprint modifié' }, () => undefined),
    updateProfile: (patch) => orQueue(() => b.updateProfile(patch), { method: 'updateProfile', args: [patch], kind: 'other', label: 'Profil modifié' }, () => undefined),
    saveNote: (id, patch) => orQueue(() => b.saveNote(id, patch), { method: 'saveNote', args: [id, patch], kind: 'other', label: `Document ${patch.title ? `**${patch.title}** ` : ''}modifié` }, () => undefined),
  }
}

/** La copie locale du projet, avec les changements pas encore envoyés par-dessus. */
function withPending(ws: Workspace): Workspace {
  let tasks = ws.tasks
  for (const p of pendingList()) {
    if (p.method === 'saveTask') {
      const t = p.args[0] as Task
      tasks = tasks.some((x) => x.id === t.id) ? tasks.map((x) => (x.id === t.id ? t : x)) : [...tasks, t]
    } else if (p.method === 'deleteTask') tasks = tasks.filter((x) => x.id !== p.args[0])
  }
  return { ...ws, tasks }
}

/** Libellé pour une nouvelle tâche créée hors ligne. */
export function markNewTask(task: Task) {
  const list = pendingList()
  const i = list.findIndex((x) => x.method === 'saveTask' && (x.args[0] as Task).id === task.id)
  if (i < 0) return
  list[i] = { ...list[i], kind: 'new', label: `Nouvelle tâche **${task.title}**` }
  write(QUEUE, list)
  emit()
}
