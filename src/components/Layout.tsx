import { NavLink, Outlet } from 'react-router-dom'
import { DEMO_SESSION, leaveDemo, useStore } from '../lib/store'
import { Avatar } from './Avatar'
import { Icon, type IconName } from './Icon'
import { LogoMark } from './Logo'

const NAV: { to: string; label: string; icon: IconName }[] = [
  { to: '/', label: 'Accueil', icon: 'home' },
  { to: '/tableau', label: 'Tableau', icon: 'board' },
  { to: '/chat', label: 'Chat', icon: 'chat' },
  { to: '/groupe', label: 'Groupe', icon: 'group' },
  { to: '/reglages', label: 'Réglages', icon: 'settings' },
]

export function Layout() {
  const { workspace, user, online, backend } = useStore()
  const me = workspace?.members.find((m) => m.id === user?.id) ?? workspace?.members[0]
  const myOpen = workspace?.tasks.filter((t) => t.assigneeId === me?.id && t.status !== 'done').length ?? 0

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Navigation principale">
        <NavLink to="/" className="brand">
          <LogoMark size={30} />
          Kollab
        </NavLink>
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>
            <Icon name={n.icon} />
            {n.label}
            {n.to === '/tableau' && myOpen > 0 && <span className="badge" aria-label={`${myOpen} tâches pour toi`}>{myOpen}</span>}
          </NavLink>
        ))}
        <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '12px' }}>
          <Avatar member={me} size={34} online={!!me && online.includes(me.id)} />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <strong style={{ fontSize: 14, fontWeight: 600 }}>{me?.name}</strong>
            <span className="muted" style={{ fontSize: 12 }}>{workspace?.group.name}</span>
          </div>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Se déconnecter" onClick={() => (DEMO_SESSION ? leaveDemo() : void backend.signOut())}>
            <Icon name="logout" size={18} />
          </button>
        </div>
      </nav>

      <main className="main">
        {DEMO_SESSION ? (
          <div className="demo-banner" role="status">
            <span><strong>Mode démo</strong> · une équipe d'exemple, rien n'est envoyé.</span>
            <button className="btn small" onClick={leaveDemo}>Créer mon compte</button>
          </div>
        ) : backend.mode === 'demo' && (
          <div className="muted" style={{ fontSize: 13, background: 'var(--subtle)', borderRadius: 12, padding: '8px 12px' }}>
            Mode démo : les données restent dans ce navigateur. Ouvre un deuxième onglet pour voir le temps réel.
          </div>
        )}
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Navigation">
        {NAV.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
