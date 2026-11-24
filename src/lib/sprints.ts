import type { Workspace } from './backend'
import type { Sprint, Task } from './types'

export const activeSprint = (ws: Workspace): Sprint | undefined => ws.sprints.find((s) => s.status === 'active')

/** Tâches du tableau : celles du sprint en cours, sinon tout sauf les sprints terminés. */
export function boardTasks(ws: Workspace): Task[] {
  const active = activeSprint(ws)
  if (active) return ws.tasks.filter((t) => t.sprintId === active.id)
  const closed = new Set(ws.sprints.filter((s) => s.status === 'done').map((s) => s.id))
  return ws.tasks.filter((t) => !t.sprintId || !closed.has(t.sprintId))
}

/** Avancement du tableau, le même partout : pourcentage des points faits et ce qu'il mesure. */
export function boardProgress(ws: Workspace) {
  const tasks = boardTasks(ws)
  const total = tasks.reduce((n, t) => n + (t.points ?? 0), 0)
  const done = tasks.filter((t) => t.status === 'done').reduce((n, t) => n + (t.points ?? 0), 0)
  const active = activeSprint(ws)
  return { pct: total ? Math.round((done / total) * 100) : 0, scope: active ? `du ${active.name}` : 'du tableau', done, total }
}

export const sprintPoints = (tasks: Task[]) => tasks.reduce((n, t) => n + (t.points ?? 0), 0)

const day = (iso: string) => new Date(`${iso}T00:00:00`)
export const DAY_MS = 86400e3

export function daysLeft(s: Sprint) {
  const end = day(s.endsOn).getTime() + DAY_MS
  return Math.max(0, Math.ceil((end - Date.now()) / DAY_MS))
}

export function sprintLength(s: Sprint) {
  return Math.round((day(s.endsOn).getTime() - day(s.startsOn).getTime()) / DAY_MS) + 1
}

/** Points restants à la fin de chaque jour du sprint (jusqu'à aujourd'hui). */
export function burndown(s: Sprint, tasks: Task[]) {
  const total = sprintPoints(tasks)
  const len = sprintLength(s)
  const actual: number[] = []
  for (let i = 0; i < len; i++) {
    const begin = day(addDays(s.startsOn, i)).getTime()
    const end = day(addDays(s.startsOn, i + 1)).getTime()
    if (begin > Date.now()) break
    const done = tasks.filter((t) => t.status === 'done' && t.doneAt && new Date(t.doneAt).getTime() < end).reduce((n, t) => n + (t.points ?? 0), 0)
    actual.push(total - done)
  }
  return { total, len, actual }
}

const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
export function shortDate(iso: string) {
  const d = day(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
export function addDays(iso: string, n: number) {
  const d = day(iso)
  d.setDate(d.getDate() + n)
  return isoDay(d)
}
