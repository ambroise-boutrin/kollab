import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES } from '../lib/types'

export function Home() {
  const ws = useWorkspace()
  const { user, online, backend, reload } = useStore()
  const me = ws.members.find((m) => m.id === user?.id) ?? ws.members[0]
  const mine = ws.tasks.filter((t) => t.assigneeId === me?.id && t.status !== 'done')
  const total = ws.tasks.reduce((n, t) => n + (t.points ?? 0), 0)
  const done = ws.tasks.filter((t) => t.status === 'done').reduce((n, t) => n + (t.points ?? 0), 0)
  const pct = total ? Math.round((done / total) * 100) : 0
  const [title, setTitle] = useState('')
  const [url, setUrl] = useState('')

  async function addLink(e: FormEvent) {
    e.preventDefault()
    if (!title.trim() || !/^https?:\/\//.test(url)) return
    await backend.addLink(title.trim(), url.trim())
    setTitle('')
    setUrl('')
    await reload()
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Bonjour {me?.name}</h1>
          <p className="muted" style={{ margin: '2px 0 0' }}>{online.length} personne{online.length > 1 ? 's' : ''} en ligne dans {ws.group.name}.</p>
        </div>
        <div className="actions" style={{ display: 'flex' }}>
          {ws.members.map((m, i) => (
            <span key={m.id} style={{ marginLeft: i ? -8 : 0, borderRadius: '50%', boxShadow: '0 0 0 2px var(--bg)' }}>
              <Avatar member={m} size={34} online={online.includes(m.id)} />
            </span>
          ))}
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

        <section className="card appear appear-3" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <h2>Liens importants</h2>
          {ws.links.map((l) => (
            <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <a className="ref-card" style={{ flex: 1, maxWidth: 'none' }} href={l.url} target="_blank" rel="noreferrer">
                <Icon name="link" size={18} /> {l.title}
              </a>
              <button className="icon-btn" aria-label={`Retirer ${l.title}`} onClick={() => void backend.removeLink(l.id).then(reload)}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
          <form onSubmit={addLink} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input className="input" aria-label="Nom du lien" placeholder="Nom (ex. Maquettes)" value={title} onChange={(e) => setTitle(e.target.value)} />
            <input className="input" aria-label="Adresse du lien" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
            <button className="btn soft">Ajouter le lien</button>
          </form>
        </section>
      </div>
    </div>
  )
}
