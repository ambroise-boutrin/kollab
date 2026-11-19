import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AvatarGroup } from '../components/Avatar'
import { LinksCard } from '../components/LinksCard'
import { MembersStack } from '../components/Layout'
import { NotificationBell } from '../components/Notifications'
import { openInvite } from './Group'
import { PrStatus } from '../components/PrLink'
import { Avatar } from '../components/Avatar'
import { DockToggle } from '../components/Dock'
import { Icon } from '../components/Icon'
import { HomeLayoutDialog, useHomeLayout, type WidgetId } from '../components/HomeLayout'
import { boardTasks } from '../lib/sprints'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES, type Task, type TaskStatus } from '../lib/types'

const NEXT: Record<TaskStatus, TaskStatus | null> = { todo: 'doing', doing: 'review', review: 'done', done: null }
const NEXT_LABEL: Record<TaskStatus, string> = { todo: 'Commencer', doing: 'En revue', review: 'Terminer', done: '' }

function ago(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return "à l'instant"
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'hier' : `il y a ${d} j`
}

/** Accueil du projet, d'après la maquette : en-tête, tableau du sprint, PR à relire, liens. */
export function Home() {
  const ws = useWorkspace()
  const { user, saveTask, notifications, online } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useHomeLayout(ws.group.id)
  const [customizing, setCustomizing] = useState(false)
  const me = ws.members.find((m) => m.id === user?.id) ?? ws.members[0]
  const firstName = me?.name.split(/\s+/)[0] ?? ''

  const sprintTasks = boardTasks(ws)
  const total = sprintTasks.reduce((n, t) => n + (t.points ?? 0), 0)
  const done = sprintTasks.filter((t) => t.status === 'done').reduce((n, t) => n + (t.points ?? 0), 0)
  const pct = total ? Math.round((done / total) * 100) : 0
  const open = ws.tasks.filter((t) => t.status !== 'done').length

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? ws.tasks.filter((t) => t.title.toLowerCase().includes(q)) : sprintTasks), [ws.tasks, sprintTasks, q])
  const toReview = ws.tasks.filter((t) => t.status === 'review')
  const mine = ws.tasks
    .filter((t) => me && t.assigneeIds.includes(me.id) && t.status !== 'done')
    .sort((a, b) => ['doing', 'review', 'todo'].indexOf(a.status) - ['doing', 'review', 'todo'].indexOf(b.status))
  const onlineMembers = ws.members.filter((m) => online.includes(m.id) && m.id !== me?.id)

  // Fil d'activité : notifications du projet + tâches récentes.
  type Item = { id: string; at: string; who?: string | null; text: string; link: string | null }
  const activity: Item[] = [
    ...notifications.filter((n) => !n.groupId || n.groupId === ws.group.id).map((n) => ({ id: n.id, at: n.createdAt, who: n.actorId, text: n.body ? `${n.title} : ${n.body}` : n.title, link: n.link })),
    ...[...ws.tasks].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 4).map((t) => ({ id: t.id, at: t.createdAt, who: null, text: `Nouvelle tâche : ${t.title}`, link: `/tableau?tache=${t.id}` })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 6)

  function advance(t: Task) {
    const next = NEXT[t.status]
    if (next) void saveTask({ ...t, status: next })
  }

  function newTask() {
    navigate('/tableau')
    setTimeout(() => window.dispatchEvent(new Event('kollab:new-task')), 50)
  }

  const widgets: Record<WidgetId, ReactNode> = {
    day: (
        <section className="card home-day">
          <div className="row-between">
            <h2>Ma journée</h2>
            <Link to="/tableau" className="mini-more">Tout voir</Link>
          </div>
          {mine.length === 0 ? (
            <div className="day-empty">
              <strong>Rien pour toi pour l'instant.</strong>
              <span className="muted">Prends une tâche du sprint ou crées-en une.</span>
              <button className="btn small" style={{ alignSelf: 'flex-start' }} onClick={newTask}>Nouvelle tâche</button>
            </div>
          ) : (
            <ul className="day-list">
              {mine.slice(0, 5).map((t) => (
                <li key={t.id} className={`day-task status-${t.status}`}>
                  <Link to={`/tableau?tache=${t.id}`} className="day-title">
                    <span className="day-dot" />
                    <span>{t.title}</span>
                  </Link>
                  <span className="muted day-meta">{STATUSES.find((s) => s.id === t.status)?.label}{t.points != null ? ` · ${t.points} pts` : ''}</span>
                  <button className="btn soft small" onClick={() => advance(t)}>{NEXT_LABEL[t.status]}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
    ),
    board: (
        <section className="card home-board">
          <div className="row-between">
            <h2>Tableau du sprint</h2>
            <button className="btn small" onClick={newTask}>Nouvelle tâche</button>
          </div>
          <div className="mini-board">
            {STATUSES.map((s) => {
              const list = shown.filter((t) => t.status === s.id).sort((a, b) => a.position - b.position)
              return (
                <div key={s.id} className="mini-col">
                  <div className="mini-col-head">{s.label} · {list.length}</div>
                  {list.slice(0, 4).map((t) => {
                    const who = ws.members.filter((m) => t.assigneeIds.includes(m.id))
                    return (
                      <Link key={t.id} to={`/tableau?tache=${t.id}`} className={`mini-task${s.id === 'done' ? ' is-done' : ''}`}>
                        {t.kind !== 'feature' && <span className={`tag ${t.kind}`}>{KINDS[t.kind]}</span>}
                        <span>{t.title}</span>
                        <span className="mini-meta">
                          {t.points != null ? `${t.points} pts` : ''}
                          <AvatarGroup members={who} size={20} />
                        </span>
                      </Link>
                    )
                  })}
                  {list.length > 4 && <Link to="/tableau" className="mini-more">+{list.length - 4} autres</Link>}
                </div>
              )
            })}
          </div>
        </section>
    ),
    activity: (
        <section className="card home-activity">
          <h2>Activité</h2>
          {activity.length === 0 && <p className="hint">Le projet démarre : invite l'équipe et crée les premières tâches.</p>}
          <ul className="feed">
            {activity.map((a) => {
              const who = a.who ? ws.members.find((m) => m.id === a.who) : undefined
              const inner = (
                <>
                  {who ? <Avatar member={who} size={26} /> : <span className="feed-dot" />}
                  <span className="feed-text">{a.text}</span>
                  <span className="muted feed-at">{ago(a.at)}</span>
                </>
              )
              return <li key={a.id}>{a.link ? <Link to={a.link}>{inner}</Link> : <div>{inner}</div>}</li>
            })}
          </ul>
        </section>
    ),
    reviews: (
        <section className="card">
          <h2>PR à relire</h2>
          {toReview.length === 0 && <p className="hint">Aucune tâche en revue.</p>}
          {toReview.map((t) => {
            const who = ws.members.filter((m) => t.assigneeIds.includes(m.id))
            return (
              <div key={t.id} className="pr-row">
                <span className="pr-title">{t.title}</span>
                <span className="hint">{who.map((m) => m.name).join(', ') || 'Personne'}</span>
                {t.prUrl ? (
                  <>
                    <PrStatus url={t.prUrl} />
                    <Link className="btn small" style={{ alignSelf: 'flex-start' }} to={`/revues?pr=${t.prUrl.split('/').pop()}`}>Relire</Link>
                  </>
                ) : (
                  <Link className="btn soft small pr-link" style={{ alignSelf: 'flex-start' }} to="/tableau">Lier une PR</Link>
                )}
              </div>
            )
          })}
        </section>
    ),
    links: <LinksCard />,
  }

  return (
    <div className="page home">
      <header className="home-head">
        <div>
          <h1>Bonjour {firstName}</h1>
          <p className="muted">{ws.group.name} · {open} tâche{open > 1 ? 's' : ''} ouverte{open > 1 ? 's' : ''} · {pct} % des points terminés</p>
        </div>
        <div className="home-tools">
          <label className="search">
            <span className="sr-only">Rechercher une tâche</span>
            <input type="search" placeholder="Rechercher une tâche" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <MembersStack />
          <NotificationBell />
          <DockToggle />
          <button className="icon-btn" aria-label="Organiser l'accueil" title="Organiser l'accueil" onClick={() => setCustomizing(true)}><Icon name="layout" size={20} /></button>
          <button className="btn" onClick={openInvite}>Inviter<span className="hide-phone"> des membres</span></button>
        </div>
      </header>

      <div className="home-strip">
        <div className="strip-tile" style={{ ['--tile' as string]: 'var(--accent)' }}>
          <b>{mine.length}</b><span>pour toi</span>
        </div>
        <div className="strip-tile" style={{ ['--tile' as string]: '#D98A1C' }}>
          <b>{toReview.length}</b><span>en revue</span>
        </div>
        <div className="strip-tile sprint" style={{ ['--tile' as string]: 'var(--ok)' }}>
          <b>{pct} %</b><span>du sprint</span>
          <i><em style={{ width: `${pct}%` }} /></i>
        </div>
        <div className="strip-tile people" style={{ ['--tile' as string]: '#2F6FD0' }}>
          {onlineMembers.length ? <AvatarGroup members={onlineMembers} size={28} /> : <b>0</b>}
          <span>{onlineMembers.length ? `${onlineMembers.length} en ligne` : 'personne en ligne'}</span>
        </div>
      </div>

      <div className="home-grid">
        {(['main', 'side'] as const).map((col) => (
          <div key={col} className={col === 'main' ? 'home-main' : 'home-side'}>
            {layout[col].filter((id) => !layout.hidden.includes(id)).map((id) => <div key={id} className="home-widget">{widgets[id]}</div>)}
          </div>
        ))}
      </div>
      {customizing && <HomeLayoutDialog layout={layout} onChange={setLayout} onClose={() => setCustomizing(false)} />}
    </div>
  )
}
