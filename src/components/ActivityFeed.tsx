import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore, useWorkspace } from '../lib/store'
import { STATUSES, type ActivityItem, type Member } from '../lib/types'
import { Avatar } from './Avatar'
import { Modal } from './Modal'

/** Historique de l'équipe, rechargé à chaque action notée par la base. */
export function useActivity(limit = 60) {
  const { backend } = useStore()
  const ws = useWorkspace()
  const [items, setItems] = useState<ActivityItem[] | null>(null)
  const load = useCallback(() => void backend.listActivity(limit).then(setItems).catch(() => setItems([])), [backend, limit])
  useEffect(load, [load, ws])
  useEffect(() => {
    window.addEventListener('kollab:activity', load)
    return () => window.removeEventListener('kollab:activity', load)
  }, [load])
  return items
}

const STATUS = Object.fromEntries(STATUSES.map((s) => [s.id, s.label]))
const COLOR: Record<string, string> = { tasks: 'var(--accent)', links: '#2F6FD0', documents: '#D9822B', notes: '#D9822B', sprints: '#9B3FB8', group_members: 'var(--ok)', groups: 'var(--ok)' }
const q = (s: string | null) => (s ? `« ${s} »` : '')

/** Phrase lisible : verbe (coloré) + objet. */
export function describe(a: ActivityItem): { verb: string; what: string } {
  const t = a.target
  switch (a.verb) {
    case 'joined': return { verb: 'a rejoint', what: 'le projet' }
    case 'renamed': return { verb: 'a renommé', what: `le projet en ${q(a.label)}` }
    case 'logo': return { verb: 'a changé', what: 'le logo du projet' }
    case 'moved': return { verb: `a passé en ${STATUS[a.meta.to] ?? a.meta.to}`, what: q(a.label) }
    case 'assigned': return { verb: 'a réparti', what: q(a.label) }
    case 'pr_linked': return { verb: 'a lié une PR à', what: q(a.label) }
    case 'trashed': return { verb: 'a mis à la corbeille', what: q(a.label) }
    case 'restored': return { verb: 'a restauré', what: q(a.label) }
    case 'edited': return { verb: 'a modifié le lien', what: q(a.label) }
    case 'sprint_active': return { verb: 'a lancé', what: q(a.label) }
    case 'sprint_closed': return { verb: 'a clôturé', what: q(a.label) }
    case 'created':
      if (t === 'tasks') return { verb: 'a créé la tâche', what: q(a.label) }
      if (t === 'links') return { verb: 'a ajouté le lien', what: q(a.label) }
      if (t === 'documents') return { verb: 'a déposé', what: q(a.label) }
      if (t === 'notes') return { verb: 'a écrit', what: q(a.label) }
      if (t === 'sprints') return { verb: 'a préparé', what: q(a.label) }
      return { verb: 'a créé', what: q(a.label) }
    default: return { verb: a.verb, what: q(a.label) }
  }
}

function linkFor(a: ActivityItem): string | null {
  if (!a.targetId || a.verb === 'trashed') return null
  if (a.target === 'tasks') return `/tableau?tache=${a.targetId}`
  if (a.target === 'notes') return `/documents?note=${a.targetId}`
  if (a.target === 'documents') return '/documents'
  if (a.target === 'sprints') return '/sprints'
  return null
}

export function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'hier' : `il y a ${d} j`
}

function Row({ a, members, time }: { a: ActivityItem; members: Member[]; time: string }) {
  const who = members.find((m) => m.id === a.actorId)
  const { verb, what } = describe(a)
  const to = linkFor(a)
  const inner = (
    <>
      {who ? <Avatar member={who} size={28} /> : <span className="act-blank" aria-hidden="true" />}
      <span className="act-text">
        <b>{who ? who.name.split(/\s+/)[0] : a.actorId ? 'Ancien membre' : 'Équipe'}</b> <span className="act-verb" style={{ color: COLOR[a.target] ?? 'var(--accent)' }}>{verb}</span> {what}
      </span>
      <span className="muted act-at">{time}</span>
    </>
  )
  return <li className="act-row">{to ? <Link to={to}>{inner}</Link> : <div>{inner}</div>}</li>
}

/** Quelques lignes d'historique (accueil). */
export function ActivityList({ items, max }: { items: ActivityItem[]; max?: number }) {
  const ws = useWorkspace()
  return (
    <ul className="act-list">
      {items.slice(0, max).map((a) => <Row key={a.id} a={a} members={ws.members} time={ago(a.createdAt)} />)}
    </ul>
  )
}

const FILTERS: { id: string; label: string; match: (a: ActivityItem) => boolean }[] = [
  { id: 'all', label: 'Tout', match: () => true },
  { id: 'tasks', label: 'Tâches', match: (a) => a.target === 'tasks' || a.target === 'sprints' },
  { id: 'docs', label: 'Documents', match: (a) => a.target === 'documents' || a.target === 'notes' },
  { id: 'links', label: 'Liens', match: (a) => a.target === 'links' },
  { id: 'team', label: 'Équipe', match: (a) => a.target === 'group_members' || a.target === 'groups' },
]

const dayLabel = (iso: string) => {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(Date.now() - 86400e3)
  if (d.toDateString() === today.toDateString()) return "Aujourd'hui"
  if (d.toDateString() === y.toDateString()) return 'Hier'
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Fenêtre « Historique de l'équipe » : par jour, filtrable par personne et par type. */
export function ActivityDialog({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace()
  const items = useActivity(300)
  const [filter, setFilter] = useState('all')
  const [person, setPerson] = useState('')
  const days = useMemo(() => {
    const f = FILTERS.find((x) => x.id === filter)!
    const list = (items ?? []).filter((a) => f.match(a) && (!person || a.actorId === person))
    const out: { day: string; items: ActivityItem[] }[] = []
    for (const a of list) {
      const day = dayLabel(a.createdAt)
      if (out.at(-1)?.day !== day) out.push({ day, items: [] })
      out.at(-1)!.items.push(a)
    }
    return out
  }, [items, filter, person])

  return (
    <Modal title="Historique de l'équipe" onClose={onClose} wide full>
      <div className="act-filters">
        <div className="chips" role="radiogroup" aria-label="Type d'action">
          {FILTERS.map((f) => (
            <button key={f.id} type="button" role="radio" aria-checked={filter === f.id} className="chip" onClick={() => setFilter(f.id)}>{f.label}</button>
          ))}
        </div>
        <select className="title-select" value={person} onChange={(e) => setPerson(e.target.value)} aria-label="Personne">
          <option value="">Tout le monde</option>
          {ws.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      {items === null && <p className="hint">Chargement…</p>}
      {items && days.length === 0 && <p className="hint">Rien pour l'instant.</p>}
      {days.map((d) => (
        <section key={d.day} className="act-day">
          <h3>{d.day}</h3>
          <ul className="act-list">
            {d.items.map((a) => <Row key={a.id} a={a} members={ws.members} time={new Date(a.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} />)}
          </ul>
        </section>
      ))}
    </Modal>
  )
}
