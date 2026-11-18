import { Link } from 'react-router-dom'
import { LinksCard } from '../components/LinksCard'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES } from '../lib/types'

export function Home() {
  const ws = useWorkspace()
  const { user } = useStore()
  const me = ws.members.find((m) => m.id === user?.id) ?? ws.members[0]
  const mine = ws.tasks.filter((t) => t.assigneeId === me?.id && t.status !== 'done')
  const total = ws.tasks.reduce((n, t) => n + (t.points ?? 0), 0)
  const done = ws.tasks.filter((t) => t.status === 'done').reduce((n, t) => n + (t.points ?? 0), 0)
  const pct = total ? Math.round((done / total) * 100) : 0
  const open = ws.tasks.filter((t) => t.status !== 'done').length
  const repo = ws.links.find((l) => /^https:\/\/github\.com\/[^/]+\/[^/]+/.test(l.url))

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>{ws.group.name}</h1>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            {open} tâche{open > 1 ? 's' : ''} ouverte{open > 1 ? 's' : ''}{repo && <> · <a href={repo.url} target="_blank" rel="noreferrer">{repo.url.replace('https://github.com/', '')}</a></>}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18, alignItems: 'start' }}>
        <section className="card appear" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Avancement</h2>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong style={{ fontFamily: 'var(--display)', fontSize: 34 }}>{pct} %</strong>
            <span className="muted">{done} points sur {total}</span>
          </div>
          <div className="load" style={{ height: 10 }}><span style={{ width: `${pct}%`, background: 'var(--accent)' }} /></div>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13 }} className="muted">
            {STATUSES.map((s) => (
              <span key={s.id}>{s.label} : {ws.tasks.filter((t) => t.status === s.id).length}</span>
            ))}
          </div>
        </section>

        <section className="card appear appear-2" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <h2>Mes tâches</h2>
            <Link to="/tableau" style={{ marginLeft: 'auto', fontSize: 14 }}>Voir le tableau</Link>
          </div>
          {mine.length === 0 && <p className="muted" style={{ margin: 0 }}>Rien pour toi pour l'instant.</p>}
          {mine.map((t) => (
            <Link key={t.id} to="/tableau" className="ref-card" style={{ maxWidth: 'none' }}>
              <span className={`tag ${t.kind}`}>{KINDS[t.kind]}</span>
              <span style={{ flex: 1 }}>{t.title}</span>
              <span className="muted" style={{ fontSize: 12 }}>{STATUSES.find((s) => s.id === t.status)?.label}</span>
            </Link>
          ))}
        </section>

        <LinksCard />
      </div>
    </div>
  )
}
