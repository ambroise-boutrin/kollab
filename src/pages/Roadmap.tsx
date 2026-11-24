import { useEffect, useRef, useState } from 'react'
import { addDays, isoDay, shortDate } from '../lib/sprints'
import { useWorkspace } from '../lib/store'
import { STATUSES, type Sprint, type Task, type TaskStatus } from '../lib/types'
import { TaskDrawer } from './TaskDrawer'

const DAY_MS = 86_400_000
const BIG = 8
const STRIPE: Record<TaskStatus, string> = { todo: '#A3A9BA', doing: '#2F6FD0', review: '#D98A1C', done: '#2E7D4F' }
const INK: Record<TaskStatus, string> = { todo: '#5B6275', doing: '#2F6FD0', review: '#B06E0F', done: '#2E7D4F' }
const toDay = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`).getTime()
/** Lundi de la semaine d'une date. */
const monday = (iso: string) => {
  const d = new Date(toDay(iso))
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return isoDay(d)
}

/** Feuille de route : les sprints et les grosses tâches sur une frise qu'on fait défiler. */
export function Roadmap() {
  const ws = useWorkspace()
  const [scale, setScale] = useState<'weeks' | 'months'>('weeks')
  const [openId, setOpenId] = useState<string | null>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const pxDay = scale === 'weeks' ? 12 : 4

  const today = isoDay(new Date())
  const sprints = [...ws.sprints].sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const byId = new Map(sprints.map((s) => [s.id, s]))
  const lastEnd = sprints.reduce((m, s) => (s.endsOn > m ? s.endsOn : m), today)
  const first = sprints[0]?.startsOn && sprints[0].startsOn < today ? sprints[0].startsOn : addDays(today, -14)
  const start = monday(addDays(first, -7))
  const end = addDays(lastEnd > today ? lastEnd : today, 42)
  const days = Math.round((toDay(end) - toDay(start)) / DAY_MS)
  const x = (iso: string) => Math.round((toDay(iso) - toDay(start)) / DAY_MS) * pxDay

  // Colonnes : chaque lundi en semaines, chaque 1er du mois en mois.
  const ticks: string[] = []
  for (let i = 0; i <= days; i++) {
    const d = addDays(start, i)
    if (scale === 'weeks' ? new Date(toDay(d)).getDay() === 1 : d.endsWith('-01')) ticks.push(d)
  }

  const span = (t: Task): [string, string] => {
    const s = t.sprintId ? byId.get(t.sprintId) : undefined
    if (s) return [s.startsOn, t.status === 'done' && t.doneAt ? t.doneAt.slice(0, 10) : s.endsOn]
    // Backlog : après le dernier sprint, le temps d'un sprint.
    return [addDays(lastEnd, 1), addDays(lastEnd, 14)]
  }
  const big = ws.tasks
    .filter((t) => (t.points ?? 0) >= BIG)
    .map((t) => ({ t, at: span(t) }))
    .sort((a, b) => a.at[0].localeCompare(b.at[0]) || (b.t.points ?? 0) - (a.t.points ?? 0))

  const pct = (s: Sprint) => {
    const list = ws.tasks.filter((t) => t.sprintId === s.id)
    const total = list.reduce((n, t) => n + (t.points ?? 0), 0)
    const done = list.filter((t) => t.status === 'done').reduce((n, t) => n + (t.points ?? 0), 0)
    return total ? Math.round((done / total) * 100) : 0
  }

  function goToday(smooth = true) {
    const el = scroller.current
    if (el) el.scrollTo({ left: Math.max(0, x(today) - el.clientWidth / 3), behavior: smooth ? 'smooth' : 'auto' })
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => goToday(false), [scale])

  const open = ws.tasks.find((t) => t.id === openId)
  const width = days * pxDay + 40

  return (
    <div className="page roadmap-page">
      <div className="rm-head">
        <h1>Feuille de route</h1>
        <button className="rm-today" onClick={() => goToday()}>Aujourd'hui</button>
      </div>
      <div className="rm-scales" role="radiogroup" aria-label="Échelle">
        <button role="radio" aria-checked={scale === 'weeks'} onClick={() => setScale('weeks')}>Semaines</button>
        <button role="radio" aria-checked={scale === 'months'} onClick={() => setScale('months')}>Mois</button>
      </div>

      <div
        className="rm-frame"
        ref={scroller}
        onPointerDown={(e) => {
          if (e.pointerType !== 'mouse' || (e.target as HTMLElement).closest('button')) return
          const el = e.currentTarget
          const x0 = e.clientX
          const s0 = el.scrollLeft
          const move = (ev: PointerEvent) => { el.scrollLeft = s0 - (ev.clientX - x0) }
          const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); el.classList.remove('grabbing') }
          el.classList.add('grabbing')
          window.addEventListener('pointermove', move)
          window.addEventListener('pointerup', up)
        }}
      >
        <div className="rm-canvas" style={{ width }}>
          <div className="rm-ticks">
            {ticks.map((d) => (
              <span key={d} style={{ left: x(d) }}>{scale === 'weeks' ? shortDate(d) : new Date(toDay(d)).toLocaleDateString('fr-FR', { month: 'long' })}</span>
            ))}
          </div>
          {ticks.map((d) => <i key={d} className="rm-line" style={{ left: x(d) }} />)}
          <i className="rm-now" style={{ left: x(today) }} />
          <span className="rm-now-label" style={{ left: x(today) + 6 }}>auj.</span>

          <div className="rm-rows">
            {sprints.length === 0 && <p className="rm-empty">Pas encore de sprint. Crée-en un dans Sprints.</p>}
            {sprints.map((s) => {
              const w = Math.max(x(addDays(s.endsOn, 1)) - x(s.startsOn) - 6, 60)
              const label = s.status === 'done' ? `${s.name} · fini` : s.status === 'active' ? `${s.name} · ${pct(s)} %` : s.name
              return (
                <div key={s.id} className="rm-row">
                  <span className={`rm-sprint ${s.status}`} style={{ left: x(s.startsOn), width: w }} title={`${shortDate(s.startsOn)} → ${shortDate(s.endsOn)}`}>{label}</span>
                </div>
              )
            })}
            <b className="rm-sub">Grosses tâches</b>
            {big.length === 0 && <p className="rm-empty">Aucune tâche de {BIG} points ou plus.</p>}
            {big.map(({ t, at }) => {
              const w = Math.max(x(addDays(at[1], 1)) - x(at[0]) - 6, 150)
              return (
                <div key={t.id} className="rm-row tall">
                  <button className="rm-task" style={{ left: x(at[0]), width: w, ['--c' as string]: STRIPE[t.status] }} onClick={() => setOpenId(t.id)}>
                    <b>{t.title}</b>
                    <span style={{ color: INK[t.status] }}>{STATUSES.find((s) => s.id === t.status)?.label} · {t.points} pts</span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      </div>
      <p className="rm-hint">Glisse pour avancer dans le temps. Les grosses tâches : {BIG} points et plus.</p>
      {open && <TaskDrawer task={open} onClose={() => setOpenId(null)} />}
    </div>
  )
}
