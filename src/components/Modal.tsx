import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

/** Écran tactile : on n'ouvre pas le clavier d'office. */
export const touchScreen = () => window.matchMedia?.('(pointer: coarse)').matches ?? false

/** Fenêtre au centre de l'écran (en bas sur téléphone, plein écran si `full`). Échap ou clic dehors pour fermer. */
export function Modal({ title, onClose, children, wide = false, footer, full = false }: { title: ReactNode; onClose: () => void; children: ReactNode; wide?: boolean; footer?: ReactNode; full?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return createPortal(
    <div className="modal-back sheet-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal sheet${wide ? ' wide' : ''}${full ? ' full' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" aria-label="Fermer" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** Écran de téléphone (même seuil que le CSS), suivi au redimensionnement. */
export function usePhone() {
  const q = '(max-width: 820px)'
  const [phone, setPhone] = useState(() => window.matchMedia?.(q).matches ?? false)
  useEffect(() => {
    const m = window.matchMedia?.(q)
    if (!m) return
    const on = () => setPhone(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return phone
}
