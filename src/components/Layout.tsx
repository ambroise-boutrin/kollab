import { useCallback, useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { DEMO_SESSION, leaveDemo, useStore } from '../lib/store'
import { PRESENCE, type Member } from '../lib/types'
import { AppTour } from './AppTour'
import { Avatar } from './Avatar'
import { DesktopMenu } from './DesktopMenu'
import { Icon, type IconName } from './Icon'
import { LogoMark } from './Logo'
import { NewProjectDialog } from './NewProjectDialog'
import { Popover } from './Popover'
import { NotificationBell } from './Notifications'
import { InviteDialog } from './InviteDialog'
import { CommandPalette, openSearch } from './CommandPalette'
import { VoiceProvider } from '../lib/voice'
import { VoiceBar } from './VoiceBar'
import { Dock, DockToggle } from './Dock'

const NAV: { to: string; label: string; icon: IconName; more?: boolean }[] = [
  { to: '/', label: 'Accueil', icon: 'home' },
  { to: '/tableau', label: 'Tableau', icon: 'board' },
  { to: '/sprints', label: 'Sprints', icon: 'sprint', more: true },
  { to: '/revues', label: 'Revues', icon: 'pr', more: true },
  { to: '/chat', label: 'Chat', icon: 'chat' },
  { to: '/documents', label: 'Documents', icon: 'doc', more: true },
  { to: '/equipe', label: 'Équipe', icon: 'group' },
]

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)

const ROLE_LABEL = { admin: 'Admin', member: 'Membre', guest: 'Invité' } as const

/** Pastille de couleur avec l'initiale du projet. */
function ProjectMark({ name, size = 30 }: { name: string; size?: number }) {
  return (
    <span className="project-mark" style={{ width: size, height: size, fontSize: size * 0.46 }} aria-hidden="true">
      {name.trim()[0]?.toUpperCase() ?? 'K'}
    </span>
  )
}

/** En haut à gauche : le projet ouvert, et le menu pour en changer. */
function ProjectSwitcher({ onNew, compact = false }: { onNew: () => void; compact?: boolean }) {
  const { workspace, groups, switchGroup } = useStore()
  const navigate = useNavigate()
  if (!workspace) return null
  const g = workspace.group
  const role = groups.find((x) => x.id === g.id)?.role
  return (
    <Popover
      label="Projets"
      className={compact ? 'switcher compact' : 'switcher'}
      button={({ open, toggle }) => (
        <button className="switcher-btn" aria-expanded={open} aria-haspopup="menu" onClick={toggle} data-tour="project">
          <ProjectMark name={g.name} size={compact ? 28 : 32} />
          <span className="switcher-text">
            <strong>{g.name}</strong>
            {!compact && <span>{workspace.members.length} membre{workspace.members.length > 1 ? 's' : ''}{role ? ` · ${ROLE_LABEL[role]}` : ''}</span>}
          </span>
          <Icon name="chevron" size={16} />
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="pop-title">Tes projets</p>
          {groups.map((p) => (
            <button
              key={p.id}
              role="menuitemradio"
              aria-checked={p.id === g.id}
              className="pop-item"
              onClick={() => {
                close()
                if (p.id !== g.id) void switchGroup(p.id).then(() => navigate('/'))
              }}
            >
              <ProjectMark name={p.name} size={24} />
              <span className="pop-grow">{p.name}</span>
              {p.id === g.id && <Icon name="check" size={16} />}
            </button>
          ))}
          <hr />
          <button role="menuitem" className="pop-item" onClick={() => { close(); navigate('/projet') }}>
            <Icon name="settings" size={18} /> Réglages du projet
          </button>
          <button role="menuitem" className="pop-item" onClick={() => { close(); onNew() }}>
            <Icon name="plus" size={18} /> Nouveau projet ou rejoindre
          </button>
        </>
      )}
    </Popover>
  )
}

/** En haut à droite : les membres, ceux en ligne d'abord. */
export function MembersStack() {
  const { workspace, online } = useStore()
  const navigate = useNavigate()
  if (!workspace) return null
  const sorted = [...workspace.members].sort((a, b) => Number(online.includes(b.id)) - Number(online.includes(a.id)))
  const shown = sorted.slice(0, 5)
  const rest = sorted.length - shown.length
  const onlineCount = workspace.members.filter((m) => online.includes(m.id)).length
  const row = (m: Member) => {
    const on = online.includes(m.id)
    return (
      <div className="pop-member" key={m.id}>
        <Avatar member={m} size={30} online={on} />
        <span className="pop-grow">
          <strong>{m.name}</strong>
          <span className="muted">{on ? PRESENCE[m.status ?? 'available'].label : 'Hors ligne'}{m.title ? ` · ${m.title}` : ''}</span>
        </span>
      </div>
    )
  }
  return (
    <Popover
      label="Membres du projet"
      className={workspace.members.length > 1 ? 'members-pop' : 'members-pop solo'}
      button={({ open, toggle }) => (
        <button className="members-btn" aria-expanded={open} onClick={toggle} aria-label={`${workspace.members.length} membres, ${onlineCount} en ligne`} data-tour="members">
          {workspace.members.length > 1 && <span className="members-online"><b>{onlineCount}</b> en ligne</span>}
          <span className="stack-avatars">
            {shown.map((m) => <Avatar key={m.id} member={m} size={30} online={online.includes(m.id)} />)}
            {rest > 0 && <span className="avatar more">+{rest}</span>}
          </span>
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="pop-title">{workspace.members.length} membre{workspace.members.length > 1 ? 's' : ''} · {onlineCount} en ligne</p>
          <div className="pop-scroll">{sorted.map(row)}</div>
          <hr />
          <button role="menuitem" className="pop-item" onClick={() => { close(); window.dispatchEvent(new Event('kollab:invite')) }}>
            <Icon name="plus" size={18} /> Inviter
          </button>
          <button role="menuitem" className="pop-item" onClick={() => { close(); navigate('/equipe') }}>
            <Icon name="group" size={18} /> Voir l'équipe
          </button>
        </>
      )}
    </Popover>
  )
}

/** En bas à gauche (en haut sur téléphone) : le profil et son menu. */
function ProfileMenu({ compact = false }: { compact?: boolean }) {
  const { workspace, user, online, backend } = useStore()
  const navigate = useNavigate()
  const me = workspace?.members.find((m) => m.id === user?.id) ?? workspace?.members[0]
  const go = (close: () => void, to: string) => { close(); navigate(to) }
  return (
    <Popover
      label="Mon compte"
      className={compact ? 'profile-pop compact' : 'profile-pop'}
      button={({ open, toggle }) => (
        <button className="profile-btn" aria-expanded={open} aria-haspopup="menu" onClick={toggle} aria-label="Mon compte" data-tour="profile">
          <Avatar member={me} size={compact ? 32 : 34} online={!!me && online.includes(me.id)} />
          {!compact && (
            <span className="switcher-text">
              <strong>{me?.name}</strong>
              <span>{user?.email ?? 'Mon compte'}</span>
            </span>
          )}
        </button>
      )}
    >
      {(close) => (
        <>
          <div className="pop-head">
            <Avatar member={me} size={38} />
            <span className="pop-grow">
              <strong>{me?.name}</strong>
              <span className="muted">{user?.email ?? 'Compte de démonstration'}</span>
            </span>
          </div>
          <hr />
          <button role="menuitem" className="pop-item" onClick={() => go(close, '/reglages#profil')}><Icon name="user" size={18} /> Mon profil</button>
          <button role="menuitem" className="pop-item" onClick={() => go(close, '/reglages#comptes')}><Icon name="link" size={18} /> Comptes liés</button>
          <button role="menuitem" className="pop-item" onClick={() => go(close, '/reglages#apparence')}><Icon name="palette" size={18} /> Apparence</button>
          <button role="menuitem" className="pop-item" onClick={() => go(close, '/reglages')}><Icon name="settings" size={18} /> Réglages du compte</button>
          <hr />
          <button role="menuitem" className="pop-item" onClick={() => { close(); window.dispatchEvent(new Event('kollab:tour')) }}><Icon name="play" size={18} /> Revoir la visite</button>
          <button role="menuitem" className="pop-item" onClick={() => { close(); if (DEMO_SESSION) leaveDemo(); else void backend.signOut() }}>
            <Icon name="logout" size={18} /> {DEMO_SESSION ? 'Quitter la démo' : 'Se déconnecter'}
          </button>
        </>
      )}
    </Popover>
  )
}

export function Layout() {
  const { workspace, user, backend } = useStore()
  const [creating, setCreating] = useState(false)
  const [inviting, setInviting] = useState(false)
  useEffect(() => {
    const on = () => setInviting(true)
    window.addEventListener('kollab:invite', on)
    return () => window.removeEventListener('kollab:invite', on)
  }, [])
  const openNew = useCallback(() => setCreating(true), [])
  const { pathname } = useLocation()
  const onHome = pathname === '/'
  const myOpen = workspace?.tasks.filter((t) => t.assigneeIds.includes(user?.id ?? 'me') && t.status !== 'done').length ?? 0

  return (
    <VoiceProvider>
    <div className="shell">
      <nav className="sidebar" aria-label="Navigation principale">
        <div className="brand"><LogoMark size={24} /> Kollab</div>
        <ProjectSwitcher onNew={() => setCreating(true)} />
        <button className="nav-search" onClick={openSearch}>
          <Icon name="search" size={18} />
          Rechercher
          <kbd>{IS_MAC ? '⌘' : 'Ctrl'} K</kbd>
        </button>
        <div className="nav-list" data-tour="nav">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => `nav${isActive ? ' active' : ''}`}>
              <Icon name={n.icon} size={18} />
              {n.label}
              {n.to === '/tableau' && myOpen > 0 && <span className="badge" aria-label={`${myOpen} tâches pour toi`}>{myOpen}</span>}
            </NavLink>
          ))}
        </div>
        <div className="sidebar-foot">
          <ProfileMenu />
        </div>
      </nav>

      <main className="main">
        <header className={onHome ? 'topbar on-home' : 'topbar'}>
          <div className="topbar-mobile">
            <ProjectSwitcher onNew={() => setCreating(true)} compact />
          </div>
          <MembersStack />
          <button className="icon-btn topbar-search" aria-label="Rechercher" onClick={openSearch}><Icon name="search" size={20} /></button>
          <DockToggle />
          <NotificationBell />
          <div className="topbar-mobile">
            <ProfileMenu compact />
          </div>
        </header>
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
      <Dock />
      <CommandPalette />
      <VoiceBar />

      <nav className="tabbar" aria-label="Navigation" data-tour="nav">
        {NAV.filter((n) => !n.more).map((n) => (
          <NavLink key={n.to} to={n.to} end={n.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}>
            <Icon name={n.icon} size={22} />
            {n.label}
          </NavLink>
        ))}
        <Popover
          label="Plus"
          className="tab-more"
          button={({ open, toggle }) => (
            <button className={`tab-more-btn${NAV.some((n) => n.more && pathname.startsWith(n.to)) ? ' active' : ''}`} aria-expanded={open} onClick={toggle}>
              <Icon name="grid" size={22} />
              Plus
            </button>
          )}
        >
          {(close) => (
            <div className="tab-more-grid">
              {NAV.filter((n) => n.more).map((n) => (
                <NavLink key={n.to} to={n.to} onClick={close} className={({ isActive }) => `tab-more-item${isActive ? ' active' : ''}`}>
                  <span><Icon name={n.icon} size={22} /></span>
                  {n.label}
                </NavLink>
              ))}
            </div>
          )}
        </Popover>
      </nav>

      {creating && <NewProjectDialog onClose={() => setCreating(false)} />}
      {inviting && workspace && <InviteDialog onClose={() => setInviting(false)} />}
      {!DEMO_SESSION && <AppTour />}
      <DesktopMenu onNewProject={openNew} />
    </div>
    </VoiceProvider>
  )
}
