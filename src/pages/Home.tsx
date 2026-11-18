import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { LinksCard } from '../components/LinksCard'
import { MembersStack } from '../components/Layout'
import { PrStatus } from '../components/PrLink'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES } from '../lib/types'

/** Accueil du projet, d'après la maquette : en-tête, tableau du sprint, PR à relire, liens. */
export function Home() {
  const ws = useWorkspace()
  const { user } = useStore()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const me = ws.members.find((m) => m.id === user?.id) ?? ws.members[0]
  const firstName = me?.name.split(/\s+/)[0] ?? ''

  const total = ws.tasks.reduce((n, t) => n + (t.points ?? 0), 0)
  const done = ws.tasks.filter((t) => t.status === 'done').reduce((n, t) => n + (t.points ?? 0), 0)
  const pct = total ? Math.round((done / total) * 100) : 0
  const open = ws.tasks.filter((t) => t.status !== 'done').length

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? ws.tasks.filter((t) => t.title.toLowerCase().includes(q)) : ws.tasks), [ws.tasks, q])
  const toReview = ws.tasks.filter((t) => t.status === 'review')

  function newTask() {
    navigate('/tableau')
    setTimeout(() => window.dispatchEvent(new Event('kollab:new-task')), 50)
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
          <button className="btn" onClick={() => navigate('/equipe')}>Inviter des membres</button>
        </div>
      </header>

      <div className="home-grid">
        <section className="card home-board">
          <div className="row-between">
            <h2>Tableau du sprint</h2>
            <button className="btn dark small" onClick={newTask}>Nouvelle tâche</button>
          </div>
          <div className="mini-board">
            {STATUSES.map((s) => {
              const list = shown.filter((t) => t.status === s.id).sort((a, b) => a.position - b.position)
              return (
                <div key={s.id} className="mini-col">
                  <div className="mini-col-head">{s.label} · {list.length}</div>
                  {list.slice(0, 4).map((t) => {
                    const who = ws.members.find((m) => m.id === t.assigneeId)
                    return (
                      <Link key={t.id} to="/tableau" className={`mini-task${s.id === 'done' ? ' is-done' : ''}`}>
                        <span className={`tag ${t.kind}`}>{KINDS[t.kind]}</span>
                        <span>{t.title}</span>
                        <span className="mini-meta">
                          {t.points != null ? `${t.points} pts` : ''}
                          {who && <Avatar member={who} size={20} />}
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

        <div className="home-side">
        <section className="card">
          <h2>PR à relire</h2>
          {toReview.length === 0 && <p className="hint">Aucune tâche en revue.</p>}
          {toReview.map((t) => {
            const who = ws.members.find((m) => m.id === t.assigneeId)
            return (
              <div key={t.id} className="pr-row">
                <span className="pr-title">{t.title}</span>
                <span className="hint">{who?.name ?? 'Personne'}</span>
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

        <LinksCard />
        </div>
      </div>
    </div>
  )
}
