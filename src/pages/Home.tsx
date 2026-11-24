import { useMemo, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AvatarGroup } from '../components/Avatar'
import { LinksCard } from '../components/LinksCard'
import { MembersStack } from '../components/Layout'
import { NotificationBell } from '../components/Notifications'
import { openInvite } from './Group'
import { PrStatus } from '../components/PrLink'
import { DockToggle } from '../components/Dock'
import { Icon } from '../components/Icon'
import { ActivityDialog, ActivityList, useActivity } from '../components/ActivityFeed'
import { DEFAULT, HomeEditGrid, useHomeLayout, type WidgetId } from '../components/HomeLayout'
import { boardProgress, boardTasks } from '../lib/sprints'
import { DueBadge, TaskPrChip, daysUntil } from '../components/TaskExtras'

const DOT: Record<string, string> = { todo: '#A3A9BA', doing: '#2F6FD0', review: '#D98A1C', done: '#2E7D4F' }
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES, type Task, type TaskStatus } from '../lib/types'

const NEXT: Record<TaskStatus, TaskStatus | null> = { todo: 'doing', doing: 'review', review: 'done', done: null }
const NEXT_LABEL: Record<TaskStatus, string> = { todo: 'Commencer', doing: 'En revue', review: 'Terminer', done: '' }


/** Accueil du projet, d'après la maquette : en-tête, tableau du sprint, PR à relire, liens. */
export function Home() {
  const ws = useWorkspace()
  const { user, saveTask, online } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [layout, setLayout] = useHomeLayout(ws.group.id)
  const [editing, setEditing] = useState(false)
  const me = ws.members.find((m) => m.id === user?.id) ?? ws.members[0]
  const firstName = me?.name.split(/\s+/)[0] ?? ''

  const sprintTasks = boardTasks(ws)
  const progress = boardProgress(ws)
  const pct = progress.pct
  const open = ws.tasks.filter((t) => t.status !== 'done').length

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? ws.tasks.filter((t) => t.title.toLowerCase().includes(q)) : sprintTasks), [ws.tasks, sprintTasks, q])
  const toReview = ws.tasks.filter((t) => t.status === 'review')
  const mine = ws.tasks
    .filter((t) => me && t.assigneeIds.includes(me.id) && t.status !== 'done')
    .sort((a, b) => ['doing', 'review', 'todo'].indexOf(a.status) - ['doing', 'review', 'todo'].indexOf(b.status))
  const onlineMembers = ws.members.filter((m) => online.includes(m.id))

  const withDue = ws.tasks.filter((t) => t.dueOn && t.status !== 'done').sort((a, b) => a.dueOn!.localeCompare(b.dueOn!))
  const late = withDue.filter((t) => daysUntil(t.dueOn!) < 0)
  const week = withDue.filter((t) => { const n = daysUntil(t.dueOn!); return n >= 0 && n <= 7 })
  const who = (t: Task) => ws.members.filter((m) => t.assigneeIds.includes(m.id)).map((m) => m.name.split(/\s+/)[0]).join(', ') || 'Personne'

  const activity = useActivity(12)
  const [history, setHistory] = useState(false)

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
          {mine.length > 0 && !ws.tasks.some((t) => t.prUrl) && (
            <Link to={`/tableau?tache=${mine[0].id}`} className="day-flow">
              <span className="day-flow-chips"><b>Tâche</b><i>→</i><b>Branche</b><i>→</i><b>PR</b><i>→</i><b>Terminé</b></span>
              <span>Relie une tâche à sa branche : Kollab suit la PR et la passe en Terminé à la fusion.</span>
            </Link>
          )}
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
                  <span className="muted day-meta">
                    {t.prUrl ? <TaskPrChip task={t} /> : <Link to={`/tableau?tache=${t.id}`} className="day-link">Lier une branche</Link>}
                    {STATUSES.find((s) => s.id === t.status)?.label}{t.points != null ? ` · ${t.points} pts` : ''}
                  </span>
                  <button className={`btn soft small next-${NEXT[t.status]}`} onClick={() => advance(t)}>{NEXT_LABEL[t.status]}</button>
                </li>
              ))}
            </ul>
          )}
        </section>
    ),
    due: (
        <section className={`card home-due${late.length ? ' has-late' : ''}`}>
          {late.length > 0 && (
            <>
              <div className="row-between"><h2 className="due-late-title">En retard · {late.length}</h2></div>
              <ul className="due-list">
                {late.slice(0, 5).map((t) => (
                  <li key={t.id}>
                    <i style={{ background: DOT[t.status] }} />
                    <Link to={`/tableau?tache=${t.id}`}><b>{t.title}</b><span className="muted">{who(t)} · {STATUSES.find((s) => s.id === t.status)?.label.toLowerCase()}</span></Link>
                    <b className="due-late-n">{-daysUntil(t.dueOn!) === 1 ? 'hier' : `${-daysUntil(t.dueOn!)} j`}</b>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="row-between"><h2>Cette semaine</h2></div>
          {week.length === 0 ? <p className="muted" style={{ margin: 0 }}>Aucune échéance dans les 7 jours. Ajoute-en une depuis la fiche d'une tâche.</p> : (
            <ul className="due-list">
              {week.slice(0, 6).map((t) => (
                <li key={t.id}>
                  <i style={{ background: DOT[t.status] }} />
                  <Link to={`/tableau?tache=${t.id}`}><b>{t.title}</b></Link>
                  <DueBadge task={t} />
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
          <div className="row-between">
            <h2>Activité</h2>
            <button className="mini-more ghost-link" onClick={() => setHistory(true)}>Historique</button>
          </div>
          {activity && activity.length === 0 && <p className="hint">Le projet démarre : invite l'équipe et crée les premières tâches.</p>}
          {activity && <ActivityList items={activity} max={6} />}
        </section>
    ),
    reviews: (
        <section className="card">
          <h2>Tâches en revue</h2>
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
          <p className="muted">{ws.group.name} · {open} tâche{open > 1 ? 's' : ''} ouverte{open > 1 ? 's' : ''} · {pct} % des points {progress.scope}</p>
        </div>
        <div className="home-tools">
          <label className="search">
            <span className="sr-only">Rechercher une tâche</span>
            <input type="search" placeholder="Rechercher une tâche" value={query} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <MembersStack />
          <NotificationBell />
          <DockToggle />
          <button className="icon-btn hide-phone" aria-label="Organiser l'accueil" title="Organiser l'accueil" aria-pressed={editing} onClick={() => setEditing(!editing)}><Icon name="layout" size={20} /></button>
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
          <b>{pct} %</b><span>{progress.scope}</span>
          <i><em style={{ width: `${pct}%` }} /></i>
        </div>
        <Link to="/tableau" className="strip-tile late show-phone-flex" style={{ ['--tile' as string]: '#C93636' }}>
          <b>{late.length}</b><span>en retard</span>
        </Link>
        <div className="strip-tile people" style={{ ['--tile' as string]: '#2F6FD0' }}>
          {onlineMembers.length ? <AvatarGroup members={onlineMembers} size={28} /> : <b>0</b>}
          <span>{onlineMembers.length ? `${onlineMembers.length} en ligne` : 'personne en ligne'}</span>
        </div>
      </div>

      {editing && (
        <div className="he-banner hide-phone" role="status">
          <span><b>Mode édition.</b> Glisse les blocs pour les déplacer, change leur taille avec le coin, masque ce que tu ne veux pas.</span>
          <button className="he-reset" onClick={() => setLayout(DEFAULT)}>Réinitialiser</button>
          <button className="he-done" onClick={() => setEditing(false)}>Terminé</button>
        </div>
      )}
      {editing ? <HomeEditGrid layout={layout} onChange={setLayout} widgets={widgets} /> : (
        <div className="home-grid">
          {(['main', 'side'] as const).map((col) => (
            <div key={col} className={col === 'main' ? 'home-main' : 'home-side'}>
              {layout[col].filter((id) => !layout.hidden.includes(id)).map((id) => {
                const h = layout.heights?.[id]
                return <div key={id} className={`home-widget w-${id}${h ? ' sized' : ''}`} style={h ? { height: h } : undefined}>{widgets[id]}</div>
              })}
            </div>
          ))}
        </div>
      )}
      {history && <ActivityDialog onClose={() => setHistory(false)} />}
    </div>
  )
}
