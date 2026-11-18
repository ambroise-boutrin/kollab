import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Chat } from '../pages/Chat'
import { Icon } from './Icon'

const KEY = 'kollab-dock'
type DockState = { open: boolean; width: number }

function load(): DockState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? '') as DockState
    if (typeof v.open === 'boolean' && typeof v.width === 'number') return v
  } catch {
    /* rien d'enregistré */
  }
  return { open: false, width: 380 }
}
function save(s: DockState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* stockage indisponible */
  }
  window.dispatchEvent(new Event('kollab:dock'))
}

function useDock() {
  const [s, setS] = useState(load)
  useEffect(() => {
    const on = () => setS(load())
    window.addEventListener('kollab:dock', on)
    return () => window.removeEventListener('kollab:dock', on)
  }, [])
  return [s, (next: DockState) => save(next)] as const
}

/** Bouton de la barre du haut : ouvre le chat à côté de la page. */
export function DockToggle() {
  const [s, set] = useDock()
  const { pathname } = useLocation()
  if (pathname.startsWith('/chat')) return null
  return (
    <button className={`icon-btn dock-toggle${s.open ? ' on' : ''}`} aria-pressed={s.open} aria-label={s.open ? 'Fermer le chat à côté' : 'Ouvrir le chat à côté'} title="Chat à côté" onClick={() => set({ ...s, open: !s.open })}>
      <Icon name="panel" size={20} />
    </button>
  )
}

/** Panneau à droite, redimensionnable : le chat reste ouvert pendant qu'on travaille ailleurs. Largeur gardée. */
export function Dock() {
  const [s, set] = useDock()
  const { pathname } = useLocation()
  const [w, setW] = useState(s.width)
  const drag = useRef<{ x: number; w: number } | null>(null)
  useEffect(() => setW(s.width), [s.width])
  if (!s.open || pathname.startsWith('/chat')) return null

  function down(e: React.PointerEvent) {
    drag.current = { x: e.clientX, w }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }
  function move(e: React.PointerEvent) {
    if (!drag.current) return
    setW(Math.max(300, Math.min(640, drag.current.w + drag.current.x - e.clientX)))
  }
  function up() {
    if (!drag.current) return
    drag.current = null
    set({ ...s, width: w })
  }

  return (
    <aside className="dock" style={{ width: w }} aria-label="Chat à côté">
      <div className="dock-handle" role="separator" aria-orientation="vertical" aria-label="Largeur du panneau" onPointerDown={down} onPointerMove={move} onPointerUp={up} onDoubleClick={() => set({ ...s, width: 380 })} />
      <div className="dock-head">
        <strong>Chat</strong>
        <button className="icon-btn" aria-label="Fermer le panneau" onClick={() => set({ ...s, open: false })}><Icon name="close" size={18} /></button>
      </div>
      <Chat docked />
    </aside>
  )
}
