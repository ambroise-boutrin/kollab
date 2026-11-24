import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { addDays, isoDay } from '../lib/sprints'
import { useStore } from '../lib/store'
import type { Task, TaskComment } from '../lib/types'

const DAY_MS = 86_400_000
const DAYS = ['dim.', 'lun.', 'mar.', 'mer.', 'jeu.', 'ven.', 'sam.']
const LONG_DAYS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi']
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.']
const at = (iso: string) => new Date(`${iso}T00:00:00`)
const today = () => isoDay(new Date())
/** Jours entre aujourd'hui et la date (négatif = passée). */
export const daysUntil = (iso: string) => Math.round((at(iso).getTime() - at(today()).getTime()) / DAY_MS)

/** Prochain vendredi (aujourd'hui si on est vendredi). */
function friday() {
  const d = new Date()
  d.setDate(d.getDate() + ((5 - d.getDay() + 7) % 7))
  return isoDay(d)
}

export function dueText(iso: string) {
  const d = at(iso)
  const n = daysUntil(iso)
  const date = `${LONG_DAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
  if (n === 0) return `${date}, aujourd'hui`
  if (n === 1) return `${date}, demain`
  if (n < 0) return `${date}, en retard de ${-n} jour${n < -1 ? 's' : ''}`
  return `${date}, dans ${n} jours`
}

/** Pastille d'échéance pour les cartes : rouge en retard, jaune dans les 3 jours, grise ensuite. */
export function dueBadge(task: Pick<Task, 'dueOn' | 'status'>) {
  if (!task.dueOn || task.status === 'done') return null
  const n = daysUntil(task.dueOn)
  const d = at(task.dueOn)
  if (n < 0) return { tone: 'late' as const, label: n === -1 ? 'en retard · hier' : `en retard · ${-n} j` }
  const label = n === 0 ? "aujourd'hui" : n === 1 ? 'demain' : `${DAYS[d.getDay()]} ${d.getDate()}`
  return { tone: n <= 3 ? ('soon' as const) : ('later' as const), label }
}

export function DueBadge({ task }: { task: Pick<Task, 'dueOn' | 'status'> }) {
  const b = dueBadge(task)
  return b ? <span className={`due-badge ${b.tone}`}>{b.label}</span> : null
}

/** Échéance dans la fiche : dates rapides, et un calendrier au centre pour une autre date. */
export function DueField({ value, onChange, sprintEnd, label = 'Échéance', className = 'task-field', labelClass = 'task-label' }: {
  value: string | null | undefined
  onChange: (iso: string | null) => void
  sprintEnd?: string | null
  label?: string
  className?: string
  labelClass?: string
}) {
  const [picking, setPicking] = useState(false)
  const quick: [string, string][] = [["Aujourd'hui", today()], ['Demain', addDays(today(), 1)], ['Vendredi', friday()]]
  if (sprintEnd && sprintEnd >= today()) quick.push(['Fin du sprint', sprintEnd])
  const isQuick = quick.some(([, d]) => d === value)
  const late = value ? daysUntil(value) < 0 : false
  return (
    <div className={className}>
      <span className={labelClass}>{label}{value ? <> · <b style={{ color: late ? 'var(--danger)' : 'var(--text)' }}>{dueText(value)}</b></> : null}</span>
      <div className="due-chips" role="radiogroup" aria-label={label}>
        {quick.map(([l, d]) => (
          <button key={l} type="button" role="radio" aria-checked={value === d} onClick={() => onChange(value === d ? null : d)}>{l}</button>
        ))}
        <button type="button" role="radio" aria-checked={!!value && !isQuick} className="other" onClick={() => setPicking(true)}>
          {value && !isQuick ? `${at(value).getDate()} ${MONTHS[at(value).getMonth()]}` : 'Autre date…'}
        </button>
        {value && <button type="button" className="none" onClick={() => onChange(null)}>Aucune</button>}
      </div>
      {picking && <DuePicker value={value ?? null} sprintEnd={sprintEnd} onClose={() => setPicking(false)} onPick={(d) => { onChange(d); setPicking(false) }} />}
    </div>
  )
}

function DuePicker({ value, sprintEnd, onClose, onPick }: { value: string | null; sprintEnd?: string | null; onClose: () => void; onPick: (iso: string | null) => void }) {
  const [sel, setSel] = useState(value ?? addDays(today(), 1))
  const [month, setMonth] = useState(() => { const d = at(value ?? today()); return new Date(d.getFullYear(), d.getMonth(), 1) })
  const first = new Date(month)
  first.setDate(1 - ((first.getDay() + 6) % 7))
  const cells = Array.from({ length: 42 }, (_, i) => { const d = new Date(first); d.setDate(first.getDate() + i); return d })
  const shift = (n: number) => setMonth(new Date(month.getFullYear(), month.getMonth() + n, 1))
  const t = today()
  const s = at(sel)
  return (
    <Modal title="Échéance" onClose={onClose} footer={
      <button className="btn" style={{ width: '100%' }} onClick={() => onPick(sel)}>Mettre le {s.getDate()} {MONTHS[s.getMonth()]}</button>
    }>
      <div className="cal">
        <div className="cal-head">
          <button type="button" className="icon-btn" aria-label="Mois précédent" onClick={() => shift(-1)}><Icon name="chevron" size={18} /></button>
          <b>{month.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}</b>
          <button type="button" className="icon-btn next" aria-label="Mois suivant" onClick={() => shift(1)}><Icon name="chevron" size={18} /></button>
        </div>
        <div className="cal-grid">
          {['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d, i) => <span key={i} className="cal-dow">{d}</span>)}
          {cells.map((d) => {
            const iso = isoDay(d)
            const cls = [d.getMonth() !== month.getMonth() ? 'out' : '', iso === t ? 'today' : '', iso === sel ? 'on' : '', iso > t && iso < sel ? 'span' : ''].filter(Boolean).join(' ')
            return <button key={iso} type="button" className={cls} aria-pressed={iso === sel} onClick={() => setSel(iso)}>{d.getDate()}</button>
          })}
        </div>
        <div className="due-chips">
          <button type="button" onClick={() => onPick(addDays(t, 1))}>Demain</button>
          {sprintEnd && sprintEnd >= t && <button type="button" onClick={() => onPick(sprintEnd)}>Fin du sprint · {at(sprintEnd).getDate()} {MONTHS[at(sprintEnd).getMonth()]}</button>}
          <button type="button" className="none" onClick={() => onPick(null)}>Aucune</button>
        </div>
      </div>
    </Modal>
  )
}

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60e3)
  if (min < 1) return "à l'instant"
  if (min < 60) return `il y a ${min} min`
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`
  const d = new Date(iso)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

/** Texte avec les @mentions des membres en couleur. */
function WithMentions({ text, names }: { text: string; names: string[] }) {
  const sorted = [...names].filter(Boolean).sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  if (!sorted.length) return <>{text}</>
  const re = new RegExp(`(@(?:${sorted.join('|')}))`, 'gi')
  return <>{text.split(re).map((p, i) => (i % 2 ? <b key={i} className="mention">{p}</b> : p))}</>
}

/** Fil de commentaires d'une tâche : les plus récents en bas, @ pour mentionner. */
export function TaskComments({ task, compact = false }: { task: Task; compact?: boolean }) {
  const { backend, workspace, user } = useStore()
  const toast = useToast()
  const [list, setList] = useState<TaskComment[] | null>(null)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const members = workspace?.members ?? []
  const meId = user?.id ?? (backend.mode === 'demo' ? 'me' : '')
  const names = members.flatMap((m) => [m.name, m.name.split(/\s+/)[0]])

  useEffect(() => {
    let alive = true
    const load = () => void backend.listComments(task.id).then((l) => alive && setList(l)).catch(() => alive && setList((x) => x ?? []))
    load()
    const onShow = () => document.visibilityState === 'visible' && load()
    document.addEventListener('visibilitychange', onShow)
    const every = setInterval(load, 20_000)
    return () => { alive = false; clearInterval(every); document.removeEventListener('visibilitychange', onShow) }
  }, [backend, task.id])

  useEffect(() => {
    if (list?.length) endRef.current?.scrollIntoView({ block: 'nearest' })
  }, [list?.length])

  // Suggestions de mention : le mot en cours commence par @.
  const at = /(^|\s)@([\p{L}-]*)$/u.exec(text)
  const suggest = at ? members.filter((m) => m.id !== meId && m.name.toLowerCase().startsWith(at[2].toLowerCase())).slice(0, 4) : []

  async function send(e?: FormEvent) {
    e?.preventDefault()
    const body = text.trim()
    if (!body || busy) return
    setBusy(true)
    try {
      const c = await backend.addComment(task.id, body)
      setList((l) => [...(l ?? []), c])
      setText('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Envoi impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className={`tc${compact ? ' compact' : ''}`} aria-label="Commentaires">
      <div className="tc-head"><b>Commentaires{list?.length ? ` · ${list.length}` : ''}</b>{(list?.length ?? 0) > 1 && <span>les plus récents en bas</span>}</div>
      {list === null ? <p className="muted tc-empty">Chargement…</p> : list.length === 0 ? <p className="muted tc-empty">Pas encore de commentaire.</p> : (
        <div className="tc-list">
          {list.map((c) => {
            const mine = c.authorId === meId
            const m = members.find((x) => x.id === c.authorId)
            return (
              <div key={c.id} className={`tc-item${mine ? ' mine' : ''}`}>
                {m ? <Avatar member={m} size={34} /> : <span className="tc-ghost" />}
                <div>
                  <div className="tc-meta">{mine ? <><span>{ago(c.createdAt)} · </span><b>Toi</b></> : <><b>{m?.name.split(/\s+/)[0] ?? 'Ancien membre'}</b><span> · {ago(c.createdAt)}</span></>}</div>
                  <div className="tc-bubble"><WithMentions text={c.body} names={names} /></div>
                </div>
              </div>
            )
          })}
          <div ref={endRef} />
        </div>
      )}
      <form className="tc-form" onSubmit={send}>
        {suggest.length > 0 && (
          <div className="tc-suggest" role="listbox" aria-label="Mentionner">
            {suggest.map((m) => (
              <button key={m.id} type="button" role="option" aria-selected="false" onClick={() => setText(text.replace(/@[\p{L}-]*$/u, `@${m.name.split(/\s+/)[0]} `))}>
                <Avatar member={m} size={24} />{m.name}
              </button>
            ))}
          </div>
        )}
        <input className="tc-input" value={text} maxLength={4000} placeholder="Commenter, @ pour mentionner" aria-label="Commenter" onChange={(e) => setText(e.target.value)} />
        <button className="tc-send" aria-label="Envoyer" disabled={!text.trim() || busy}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 12 20 4l-6 16-3-7z" /></svg>
        </button>
      </form>
    </section>
  )
}
