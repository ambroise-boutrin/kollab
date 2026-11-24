import { useState } from 'react'
import { ActivityDialog, ActivityList, useActivity } from '../components/ActivityFeed'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Popover } from '../components/Popover'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import { PRESENCE, liveStatus, ROLES, TEAM_TITLES, type Role } from '../lib/types'

export const openInvite = () => window.dispatchEvent(new Event('kollab:invite'))

const ROLE_COLOR: Record<Role, string> = { admin: '#D98A1C', member: 'var(--accent)', guest: '#2F6FD0' }

/** L'équipe du projet : une carte par personne, sa charge, son rôle ; inviter en un clic. */
export function Group() {
  const ws = useWorkspace()
  const { user, online, backend, reload } = useStore()
  const toast = useToast()
  const me = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const isAdmin = me?.role === 'admin'
  const activity = useActivity(8)
  const [history, setHistory] = useState(false)

  async function changeRole(memberId: string, next: Role) {
    try {
      await backend.setMemberRole(memberId, next)
      await reload()
      toast('Rôle mis à jour')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Changement impossible')
    }
  }

  async function changeTitle(memberId: string, title: string) {
    try {
      await backend.setMemberTitle(memberId, title)
      await reload()
      toast(title ? `Rôle : ${title}` : 'Rôle retiré')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Changement impossible')
    }
  }

  const sorted = [...ws.members].sort((a, b) => Number(online.includes(b.id)) - Number(online.includes(a.id)))
  const onlineCount = ws.members.filter((m) => online.includes(m.id)).length

  return (
    <div className="page team-page">
      <div className="page-head">
        <div>
          <h1>Équipe</h1>
          <p className="muted" style={{ margin: '2px 0 0' }}>{ws.members.length} membre{ws.members.length > 1 ? 's' : ''} · {onlineCount} en ligne</p>
        </div>
        {isAdmin && <button className="btn" onClick={openInvite}><Icon name="plus" size={18} /> Inviter</button>}
      </div>

      <div className="team-grid">
        {sorted.map((m) => {
          const mine = ws.tasks.filter((t) => t.assigneeIds.includes(m.id))
          const open = mine.filter((t) => t.status !== 'done')
          const doing = open.filter((t) => t.status === 'doing')
          const pts = open.reduce((n, t) => n + (t.points ?? 0), 0)
          const done = mine.length - open.length
          const on = online.includes(m.id)
          return (
            <article key={m.id} className="member-card appear" style={{ ['--member' as string]: m.color }}>
              <div className="member-band" />
              <Avatar member={m} size={56} online={on} />
              <div className="member-id">
                <strong>{m.name}{m.id === me?.id && <span className="muted"> · toi</span>}</strong>
                {isAdmin ? (
                  <select className="title-select" value={m.title} aria-label={`Rôle de ${m.name} dans l'équipe`} onChange={(e) => void changeTitle(m.id, e.target.value)}>
                    <option value="">Choisir un rôle…</option>
                    {m.title && !(TEAM_TITLES as readonly string[]).includes(m.title) && <option value={m.title}>{m.title}</option>}
                    {TEAM_TITLES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                ) : (
                  <span className="member-title">{m.title || 'Rôle non défini'}</span>
                )}
                <span className="muted">
                  <span className="member-presence" style={{ ['--p' as string]: on ? PRESENCE[m.status ?? 'available'].color : 'var(--muted)' }}>
                    {liveStatus(m) || (on ? PRESENCE[m.status ?? 'available'].label : 'Hors ligne')}
                  </span>
                </span>
              </div>
              <div className="member-stats">
                <span><b>{open.length}</b> à faire</span>
                <span><b>{doing.length}</b> en cours</span>
                <span><b>{done}</b> finies</span>
              </div>
              <div className="member-load" title={`${pts} points en cours`}>
                <span style={{ width: `${Math.min(100, (pts / 21) * 100)}%`, background: pts >= 13 ? 'var(--danger)' : 'var(--ok)' }} />
              </div>
              {doing[0] && <p className="member-now"><Icon name="play" size={12} /> {doing[0].title}</p>}
              {isAdmin && m.id !== me?.id ? (
                <Popover
                  label={`Rôle de ${m.name}`}
                  className="role-pop"
                  button={({ open: o, toggle }) => (
                    <button className="role-pill" aria-expanded={o} onClick={toggle} style={{ ['--tile' as string]: ROLE_COLOR[m.role] }}>
                      {ROLES[m.role].label} <Icon name="chevron" size={14} />
                    </button>
                  )}
                >
                  {(close) => (
                    <>
                      {(Object.keys(ROLES) as Role[]).map((r) => (
                        <button key={r} role="menuitemradio" aria-checked={m.role === r} className="pop-item" onClick={() => { close(); if (r !== m.role) void changeRole(m.id, r) }}>
                          <span className="role-dot" style={{ background: ROLE_COLOR[r] }} />
                          <span className="pop-grow"><strong>{ROLES[r].label}</strong><span className="muted">{ROLES[r].help}</span></span>
                          {m.role === r && <Icon name="check" size={16} />}
                        </button>
                      ))}
                    </>
                  )}
                </Popover>
              ) : (
                <span className="role-pill static" style={{ ['--tile' as string]: ROLE_COLOR[m.role] }}>{ROLES[m.role].label}</span>
              )}
            </article>
          )
        })}

        {isAdmin && (
          <button className="member-card invite-card" onClick={openInvite}>
            <span className="invite-plus"><Icon name="plus" size={26} /></span>
            <strong>Inviter quelqu'un</strong>
            <span>Lien à partager ou email</span>
          </button>
        )}
      </div>

      <section className="card team-history">
        <div className="row-between">
          <h2>Historique</h2>
          <button className="btn soft small" onClick={() => setHistory(true)}>Tout voir</button>
        </div>
        {activity && activity.length === 0 && <p className="hint">Aucune action pour l'instant.</p>}
        {activity && <ActivityList items={activity} max={8} />}
      </section>
      {history && <ActivityDialog onClose={() => setHistory(false)} />}
    </div>
  )
}