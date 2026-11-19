import { Link, useNavigate } from 'react-router-dom'
import { ActivityList, useActivity } from '../components/ActivityFeed'
import { Icon, type IconName } from '../components/Icon'
import { activeSprint, boardTasks, daysLeft } from '../lib/sprints'
import { useStore, useWorkspace } from '../lib/store'
import { STATUSES, type Task, type TaskStatus } from '../lib/types'

const S_COLOR: Record<TaskStatus, string> = { todo: '#A3A9BA', doing: '#2F6FD0', review: '#D98A1C', done: 'var(--ok)' }
/** Chiffres et textes : teintes plus soutenues que les barres, pour rester lisibles. */
const S_TEXT: Record<TaskStatus, string> = { todo: '#5B6275', doing: '#2F6FD0', review: '#B06E0F', done: 'var(--ok)' }
const NEXT: Record<TaskStatus, TaskStatus | null> = { todo: 'doing', doing: 'review', review: 'done', done: null }
const NEXT_LABEL: Record<TaskStatus, string> = { todo: 'Commencer', doing: 'Envoyer en revue', review: 'Terminer', done: '' }

/** Accueil sur téléphone : le sprint en couleurs, des raccourcis, l'équipe en ligne, mes tâches à faire défiler. */
export function PhoneHome({ newTask }: { newTask: () => void }) {
  const ws = useWorkspace()
  const { user, saveTask } = useStore()
  const activity = useActivity(3)
  const navigate = useNavigate()
  const me = ws.members.find((m) => m.id === user?.id) ?? ws.members[0]
  const sprint = activeSprint(ws)
  const tasks = boardTasks(ws)
  const total = tasks.length || 1
  const by = (s: TaskStatus) => tasks.filter((t) => t.status === s)
  const pts = tasks.reduce((n, t) => n + (t.points ?? 0), 0)
  const donePts = by('done').reduce((n, t) => n + (t.points ?? 0), 0)
  const pct = pts ? Math.round((donePts / pts) * 100) : 0
  const mine = ws.tasks
    .filter((t) => me && t.assigneeIds.includes(me.id) && t.status !== 'done')
    .sort((a, b) => ['doing', 'review', 'todo'].indexOf(a.status) - ['doing', 'review', 'todo'].indexOf(b.status))

  const actions: { label: string; icon: IconName; color: string; run: () => void }[] = [
    { label: 'Tâche', icon: 'plus', color: 'var(--accent)', run: newTask },
    { label: 'Chat', icon: 'chat', color: '#2F6FD0', run: () => navigate('/chat') },
    { label: 'Poker', icon: 'cards', color: '#D9822B', run: () => navigate('/sprints?poker=1') },
    { label: 'Docs', icon: 'doc', color: '#0F7A63', run: () => navigate('/documents') },
    { label: 'Revues', icon: 'pr', color: '#9B3FB8', run: () => navigate('/revues') },
  ]

  function advance(t: Task) {
    const next = NEXT[t.status]
    if (next) void saveTask({ ...t, status: next })
  }

  return (
    <div className="phone-home">
      <Link to="/sprints" className="ph-sprint">
        <div className="ph-sprint-top">
          <span>
            <strong>{sprint?.name ?? 'Tableau'}</strong>
            <span className="muted">{sprint ? `${daysLeft(sprint)} jour${daysLeft(sprint) > 1 ? 's' : ''} restant${daysLeft(sprint) > 1 ? 's' : ''}` : `${tasks.length} tâches`}{pts ? ` · ${pts} points` : ''}</span>
          </span>
          <b className="ph-pct">{pct}<small> %</small></b>
        </div>
        <div className="ph-bar" aria-hidden="true">
          {STATUSES.map((s) => {
            const n = by(s.id).length
            return n ? <i key={s.id} style={{ flexGrow: n / total, background: S_COLOR[s.id] }} /> : null
          })}
        </div>
        <div className="ph-legend">
          {STATUSES.map((s) => (
            <span key={s.id}><b style={{ color: S_TEXT[s.id] }}>{by(s.id).length}</b>{s.label}</span>
          ))}
        </div>
      </Link>

      <div className="ph-actions">
        {actions.map((a) => (
          <button key={a.label} className="ph-action" style={{ ['--a' as string]: a.color }} onClick={a.run}>
            <span><Icon name={a.icon} size={22} /></span>
            {a.label}
          </button>
        ))}
      </div>

      <section className="ph-block">
        <div className="row-between"><h2>Pour toi</h2><Link to="/tableau" className="mini-more">Tableau</Link></div>
        {mine.length === 0 ? (
          <button className="ph-empty" onClick={newTask}>
            <strong>Rien pour toi en ce moment</strong>
            <span>Crée une tâche ou prends-en une dans le tableau.</span>
          </button>
        ) : (
          <div className="ph-cards">
            {mine.map((t) => (
              <article key={t.id} className="ph-card" style={{ ['--s' as string]: S_TEXT[t.status] }}>
                <span className="ph-card-status">{STATUSES.find((s) => s.id === t.status)?.label}{t.points != null ? ` · ${t.points} pts` : ''}</span>
                <Link to={`/tableau?tache=${t.id}`} className="ph-card-title">{t.title}</Link>
                <button className="ph-next" style={{ ['--n' as string]: S_COLOR[NEXT[t.status] ?? 'done'] }} onClick={() => advance(t)}>{NEXT_LABEL[t.status]}</button>
              </article>
            ))}
          </div>
        )}
      </section>

      {activity && activity.length > 0 && (
        <section className="ph-block ph-activity">
          <h2>Activité</h2>
          <ActivityList items={activity} max={3} />
        </section>
      )}
    </div>
  )
}
