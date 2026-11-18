import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Popover } from '../components/Popover'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import { PRESENCE, ROLES, type Role } from '../lib/types'

export const openInvite = () => window.dispatchEvent(new Event('kollab:invite'))

const ROLE_COLOR: Record<Role, string> = { admin: '#D98A1C', member: 'var(--accent)', guest: '#2F6FD0' }

/** L'équipe du projet : une carte par personne, sa charge, son rôle ; inviter en un clic. */
export function Group() {
  const ws = useWorkspace()
  const { user, online, backend, reload } = useStore()
  const toast = useToast()
  const me = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const isAdmin = me?.role === 'admin'

  async function changeRole(memberId: string, next: Role) {
    try {
      await backend.setMemberRole(memberId, next)
      await reload()
      toast('Rôle mis à jour')
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
                <span className="muted">{m.title || 'Sans intitulé'}</span>
              </div>
              <div className="member-presence">
                <i style={{ background: on ? PRESENCE[m.status ?? 'available'].color : 'var(--line)' }} />
                {on ? PRESENCE[m.status ?? 'available'].label : 'Hors ligne'}
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
    </div>
  )
}
