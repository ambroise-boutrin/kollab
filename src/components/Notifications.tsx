import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import type { AppNotification } from '../lib/types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { Popover } from './Popover'
import { useToast } from './Toast'

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 1) return 'à l’instant'
  if (min < 60) return `${min} min`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h`
  return `${Math.round(h / 24)} j`
}

/** Cloche avec le nombre de notifications non lues (attribution, mention, invitation, arrivée). */
export function NotificationBell() {
  const { notifications, unread, markAllRead, removeNotification, workspace, groups, switchGroup, backend } = useStore()
  const navigate = useNavigate()
  const toast = useToast()

  async function open(n: AppNotification, close: () => void) {
    close()
    if (n.kind === 'invited') return
    if (n.groupId && n.groupId !== workspace?.group.id && groups.some((g) => g.id === n.groupId)) await switchGroup(n.groupId)
    if (n.link) navigate(n.link)
  }

  async function join(n: AppNotification, close: () => void) {
    try {
      const id = await backend.joinGroup(n.data.code ?? '')
      await removeNotification(n.id)
      close()
      await switchGroup(id)
      navigate('/')
      toast(`Bienvenue dans ${n.title}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Invitation invalide')
    }
  }

  const actor = (n: AppNotification) => workspace?.members.find((m) => m.id === n.actorId)

  return (
    <Popover
      label="Notifications"
      className="notif-pop"
      button={({ open: isOpen, toggle }) => (
        <button
          className="icon-btn notif-btn"
          aria-expanded={isOpen}
          aria-label={unread ? `${unread} notification${unread > 1 ? 's' : ''} non lue${unread > 1 ? 's' : ''}` : 'Notifications'}
          onClick={() => {
            toggle()
            // Ouvrir la liste vaut lecture ; on garde le surlignage le temps de la parcourir.
            if (!isOpen && unread) setTimeout(() => void markAllRead(), 1500)
          }}
        >
          <Icon name="bell" size={20} />
          {unread > 0 && <span className="notif-count">{unread > 99 ? '99+' : unread}</span>}
        </button>
      )}
    >
      {(close) => (
        <>
          <p className="pop-title">Notifications</p>
          {notifications.length === 0 && <p className="hint" style={{ padding: '4px 12px 10px' }}>Rien de nouveau.</p>}
          <div className="pop-scroll">
            {notifications.map((n) => (
              <div key={n.id} className={`notif${n.readAt ? '' : ' unread'}`}>
                <button className="notif-main" onClick={() => void open(n, close)}>
                  {actor(n) ? <Avatar member={actor(n)} size={30} /> : <span className="notif-icon"><Icon name={n.kind === 'invited' ? 'group' : n.kind === 'mention' ? 'chat' : 'board'} size={16} /></span>}
                  <span className="pop-grow">
                    <strong>{n.title}</strong>
                    <span className="muted">{n.body}</span>
                  </span>
                  <small className="muted">{ago(n.createdAt)}</small>
                </button>
                {n.kind === 'invited' && (
                  <div className="notif-actions">
                    <button className="btn small" onClick={() => void join(n, close)}>Rejoindre</button>
                    <button className="btn small soft" onClick={() => void removeNotification(n.id)}>Refuser</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Popover>
  )
}
