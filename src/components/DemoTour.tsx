import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { APP_BASE } from '../lib/base'
import { leaveDemo } from '../lib/store'
import { LogoMark } from './Logo'

/**
 * Visite guidée de la démo : un projecteur met en lumière une zone de l'app,
 * le reste est assombri, et une bulle explique quoi faire. Chaque étape peut changer de page.
 * Les zones sont repérées par des attributs data-tour="…" dans les pages.
 */
type Step = { path: string; target?: string; title: string; text: string }

const STEPS: Step[] = [
  { path: '/', title: 'Bienvenue dans Kollab', text: "Une équipe d'exemple, déjà remplie. Le tour prend une minute." },
  { path: '/', target: 'nav', title: 'La navigation', text: 'Accueil, tableau, chat et groupe.' },
  { path: '/tableau', target: 'column', title: 'Les colonnes du sprint', text: 'Glisse une carte pour la faire avancer.' },
  { path: '/tableau', target: 'task', title: 'Une tâche', text: "Ouvre-la pour l'attribuer en voyant la charge de chacun." },
  { path: '/tableau', target: 'new-task', title: 'Nouvelle tâche', text: 'Type, estimation et PR liée.' },
  { path: '/chat', target: 'channels', title: 'Les salons', text: 'Un salon par sujet, en direct.' },
  { path: '/chat', target: 'composer', title: 'Le message', text: '@ pour mentionner, /tache pour créer une tâche.' },
  { path: '/', title: 'À toi', text: 'Explore, puis crée ton compte. C’est gratuit.' },
]

const DONE_KEY = 'kollab-demo-tour'
const PAD = 8

function readDone() {
  try {
    return sessionStorage.getItem(DONE_KEY) === 'done'
  } catch {
    return false
  }
}

function markDone() {
  try {
    sessionStorage.setItem(DONE_KEY, 'done')
  } catch {
    /* sans stockage, la visite reviendra au prochain chargement */
  }
}

/** Change de page dans l'app sans recharger : le routeur écoute popstate. */
function goTo(path: string) {
  const full = `${APP_BASE}${path === '/' ? '/' : path}`
  if (location.pathname.replace(/\/+$/, '') === full.replace(/\/+$/, '')) return
  history.pushState(null, '', full)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** Premier élément visible portant data-tour=name. */
function findTarget(name: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)
  for (const el of all) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0) return el
  }
  return null
}

type Box = { top: number; left: number; width: number; height: number }

export function DemoTour() {
  const [open, setOpen] = useState(() => !readDone())
  const [i, setI] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const step = STEPS[i]

  const close = useCallback(() => {
    markDone()
    setOpen(false)
  }, [])

  // Va sur la bonne page, attend que la zone existe, puis la cadre.
  useLayoutEffect(() => {
    if (!open) return
    goTo(step.path)
    if (!step.target) {
      setBox(null)
      return
    }
    let raf = 0
    let tries = 0
    let el: HTMLElement | null = null
    const measure = () => {
      if (!el) return
      const r = el.getBoundingClientRect()
      setBox({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 })
    }
    const seek = () => {
      el = findTarget(step.target!)
      if (el) {
        el.scrollIntoView({ block: 'nearest', inline: 'nearest' })
        measure()
      } else if (tries++ < 120) {
        raf = requestAnimationFrame(seek)
      } else {
        setBox(null)
      }
    }
    seek()
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [open, step])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, STEPS.length - 1))
      if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, close])

  if (!open) {
    return (
      <button className="tour-restart" onClick={() => { setI(0); setOpen(true) }}>
        Revoir la visite
      </button>
    )
  }

  const last = i === STEPS.length - 1
  const vw = window.innerWidth
  const vh = window.innerHeight
  const cardW = Math.min(360, vw - 32)

  // Bulle sous la zone si la place le permet, sinon au-dessus, sinon à côté ; centrée sans zone.
  let cardStyle: React.CSSProperties
  if (!box) {
    cardStyle = { left: (vw - cardW) / 2, top: Math.max(16, vh / 2 - 140), width: cardW }
  } else {
    const below = box.top + box.height + 14
    const left = Math.min(Math.max(16, box.left), vw - cardW - 16)
    if (below + 220 < vh) cardStyle = { left, top: below, width: cardW }
    else if (box.top - 14 - 220 > 0) cardStyle = { left, top: box.top - 14, width: cardW, transform: 'translateY(-100%)' }
    else if (box.left + box.width + cardW + 30 < vw) cardStyle = { left: box.left + box.width + 14, top: Math.max(16, Math.min(box.top, vh - 260)), width: cardW }
    else cardStyle = { left: (vw - cardW) / 2, top: vh - 260, width: cardW }
  }

  return (
    <div className="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {box ? (
        <div className="tour-spot" style={box} />
      ) : (
        <div className="tour-dim" />
      )}
      <div className="tour-card" style={cardStyle} key={i}>
        {!box && <LogoMark size={40} />}
        <p className="tour-count">Étape {i + 1} sur {STEPS.length}</p>
        <h2 id="tour-title">{step.title}</h2>
        <p className="tour-text">{step.text}</p>
        <div className="tour-bar" aria-hidden="true">
          <span style={{ width: `${((i + 1) / STEPS.length) * 100}%` }} />
        </div>
        <div className="tour-actions">
          {!last && <button className="tour-skip" onClick={close}>Passer</button>}
          {i > 0 && <button className="btn soft small" onClick={() => setI(i - 1)}>Précédent</button>}
          {last ? (
            <>
              <button className="btn soft small" onClick={close}>Explorer</button>
              <button className="btn small" onClick={() => { markDone(); leaveDemo() }}>Créer mon compte</button>
            </>
          ) : (
            <button className="btn small" onClick={() => setI(i + 1)} autoFocus>Suivant</button>
          )}
        </div>
      </div>
    </div>
  )
}
