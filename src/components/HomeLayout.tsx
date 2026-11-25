import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

export type WidgetId = 'day' | 'board' | 'due' | 'activity' | 'reviews' | 'links'
export interface HomeLayout {
  main: WidgetId[]
  side: WidgetId[]
  hidden: WidgetId[]
  /** Hauteur choisie au coin du bloc (px), sinon hauteur naturelle. */
  heights?: Partial<Record<WidgetId, number>>
}

export const LABEL: Record<WidgetId, string> = { day: 'Ma journée', board: 'Tableau du sprint', due: 'Échéances', activity: 'Activité', reviews: 'Tâches en revue', links: 'Liens importants' }
export const DEFAULT: HomeLayout = { main: ['day', 'board'], side: ['due', 'activity', 'reviews', 'links'], hidden: [] }
const ALL = Object.keys(LABEL) as WidgetId[]

function read(gid: string): HomeLayout {
  try {
    const v = JSON.parse(localStorage.getItem(`kollab-home:${gid}`) ?? '') as HomeLayout
    const known = (l: unknown) => (Array.isArray(l) ? (l as WidgetId[]).filter((x) => ALL.includes(x)) : [])
    const out: HomeLayout = { main: known(v.main), side: known(v.side), hidden: known(v.hidden), heights: v.heights && typeof v.heights === 'object' ? v.heights : {} }
    // Un bloc ajouté plus tard va en haut de la colonne étroite.
    for (const id of ALL) if (!out.main.includes(id) && !out.side.includes(id) && !out.hidden.includes(id)) out.side.unshift(id)
    return out
  } catch {
    return DEFAULT
  }
}

/** Disposition de l'accueil, gardée par projet sur cet appareil. */
export function useHomeLayout(gid: string) {
  const [layout, setLayout] = useState(() => read(gid))
  useEffect(() => setLayout(read(gid)), [gid])
  const update = (next: HomeLayout) => {
    setLayout(next)
    try {
      localStorage.setItem(`kollab-home:${gid}`, JSON.stringify(next))
    } catch {
      /* stockage indisponible : la disposition vaut pour cette visite */
    }
  }
  return [layout, update] as const
}

/**
 * Accueil en mode édition : on attrape un bloc et on le pose ailleurs, on tire son coin pour
 * changer sa hauteur (et sa largeur : vers la gauche il passe en large, vers la droite en étroit),
 * on le masque. Les blocs masqués attendent en bas de la colonne étroite.
 * Tout passe par les événements « pointer » : le glisser-déposer natif du navigateur
 * ne marche pas dans l'appli bureau et bloquait le coin de taille.
 */
type Col = 'main' | 'side'
interface Drag { id: WidgetId; dx: number; dy: number; x: number; y: number; w: number; h: number }
interface Resize { id: WidgetId; x0: number; y0: number; h0: number; h: number; col: Col; to: Col; w?: number }

export function HomeEditGrid({ layout, onChange, widgets }: { layout: HomeLayout; onChange: (l: HomeLayout) => void; widgets: Record<WidgetId, ReactNode> }) {
  const [drag, setDrag] = useState<Drag | null>(null)
  const [over, setOver] = useState<{ col: Col; index: number } | null>(null)
  const [resize, setResize] = useState<Resize | null>(null)
  const cols = useRef<Record<Col, HTMLDivElement | null>>({ main: null, side: null })

  const visible = (col: Col) => layout[col].filter((id) => !layout.hidden.includes(id))
  /** Pose `id` dans `col`, devant le bloc visible n° `index` (sans compter `id`). */
  function place(id: WidgetId, col: Col, index: number, heights = layout.heights) {
    const shown = visible(col).filter((x) => x !== id)
    const before = shown[index]
    const next: HomeLayout = { ...layout, heights, main: layout.main.filter((x) => x !== id), side: layout.side.filter((x) => x !== id) }
    const at = before ? next[col].indexOf(before) : next[col].length
    next[col].splice(at, 0, id)
    onChange(next)
  }
  const hide = (id: WidgetId) => onChange({ ...layout, hidden: [...layout.hidden, id] })
  const show = (id: WidgetId) => onChange({ ...layout, hidden: layout.hidden.filter((x) => x !== id) })

  /** Colonne et rang visés par le pointeur. */
  function target(x: number, y: number, id: WidgetId) {
    const near = (['main', 'side'] as Col[])
      .map((col) => ({ col, el: cols.current[col] }))
      .filter((c): c is { col: Col; el: HTMLDivElement } => !!c.el)
      .map((c) => { const r = c.el.getBoundingClientRect(); return { ...c, d: x < r.left ? r.left - x : x > r.right ? x - r.right : 0 } })
      .sort((a, b) => a.d - b.d)[0]
    if (!near) return null
    const items = [...near.el.querySelectorAll<HTMLElement>(':scope > .he-block')].filter((el) => el.dataset.id !== id)
    const index = items.filter((el) => { const r = el.getBoundingClientRect(); return y > r.top + r.height / 2 }).length
    return { col: near.col, index }
  }

  function startDrag(id: WidgetId, e: ReactPointerEvent<HTMLDivElement>) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, .he-corner')) return
    const box = e.currentTarget.getBoundingClientRect()
    const x0 = e.clientX
    const y0 = e.clientY
    let started = false
    let last: { col: Col; index: number } | null = null
    const onMove = (ev: PointerEvent) => {
      if (!started) {
        if (Math.hypot(ev.clientX - x0, ev.clientY - y0) < 5) return
        started = true
        document.body.classList.add('he-grabbing')
      }
      setDrag({ id, dx: x0 - box.left, dy: y0 - box.top, x: ev.clientX, y: ev.clientY, w: box.width, h: Math.min(box.height, 320) })
      last = target(ev.clientX, ev.clientY, id)
      setOver((o) => (o && last && o.col === last.col && o.index === last.index ? o : last))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.classList.remove('he-grabbing')
      if (started && last) place(id, last.col, last.index)
      setDrag(null)
      setOver(null)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  function startResize(id: WidgetId, col: Col, e: ReactPointerEvent<HTMLSpanElement>) {
    e.preventDefault()
    e.stopPropagation()
    const box = (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect()
    const other = cols.current[col === 'main' ? 'side' : 'main']?.getBoundingClientRect()
    const r0: Resize = { id, x0: e.clientX, y0: e.clientY, h0: box.height, h: box.height, col, to: col }
    let cur = r0
    setResize(r0)
    document.body.classList.add('he-sizing')
    const onMove = (ev: PointerEvent) => {
      const h = Math.max(140, Math.round(r0.h0 + ev.clientY - r0.y0))
      // Large → étroit en tirant le coin jusque dans la colonne de droite, et l'inverse.
      let to: Col = col
      if (other && col === 'main' && ev.clientX < box.left + box.width * 0.6) to = 'side'
      if (other && col === 'side' && ev.clientX > box.right + 60) to = 'main'
      cur = { ...r0, h, to, w: to === 'side' && col === 'main' && other ? other.width : undefined }
      setResize(cur)
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
      document.body.classList.remove('he-sizing')
      setResize(null)
      const heights = { ...layout.heights, [id]: cur.h }
      if (cur.to !== col) place(id, cur.to, visible(col).indexOf(id), heights)
      else onChange({ ...layout, heights })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  const column = (col: Col) => {
    const ids = visible(col)
    const slot = (i: number) => (drag && over?.col === col && over.index === i ? <div key={`slot-${i}`} className="he-slot" style={{ height: Math.max(90, Math.min(drag.h, 220)) }}>Dépose ici</div> : null)
    let n = 0
    return (
      <div className={col === 'main' ? 'home-main' : 'home-side'} ref={(el) => { cols.current[col] = el }}>
        {ids.map((id) => {
          const isDrag = drag?.id === id
          const sizing = resize?.id === id ? resize : null
          const h = sizing ? sizing.h : layout.heights?.[id]
          const out = [
            isDrag ? null : slot(n),
            <div
              key={id}
              data-id={id}
              className={`he-block${isDrag ? ' dragging' : ''}${sizing ? ' sizing' : ''}${sizing && sizing.to !== col ? ` to-${sizing.to}` : ''}`}
              style={isDrag ? { position: 'fixed', left: drag.x - drag.dx, top: drag.y - drag.dy, width: drag.w, height: drag.h, zIndex: 60 } : h || sizing?.w ? { height: h, width: sizing?.w } : undefined}
              onPointerDown={(e) => startDrag(id, e)}
            >
              <div className="he-bar">
                <span className="he-grip" aria-hidden="true">⋮⋮</span>
                <b>{LABEL[id]}</b>
                {sizing && sizing.to !== col && <em className="he-hint">{sizing.to === 'main' ? 'Large' : 'Étroit'}</em>}
                <button className="he-hide" onClick={() => hide(id)}>Masquer</button>
              </div>
              <div className="he-content" aria-hidden="true">{widgets[id]}</div>
              <span className="he-corner" role="separator" aria-label={`Taille de ${LABEL[id]}`} title="Tirer pour changer la taille" onPointerDown={(e) => startResize(id, col, e)} />
            </div>,
          ]
          if (!isDrag) n++
          return out
        })}
        {slot(n)}
        {n === 0 && !(drag && over?.col === col) && <div className="he-empty">{col === 'main' ? 'Colonne large vide : glisse un bloc ici' : 'Colonne étroite vide : glisse un bloc ici'}</div>}
        {col === 'side' && layout.hidden.length > 0 && (
          <div className="he-hidden">
            <b>Blocs masqués</b>
            <div>{layout.hidden.map((id) => <button key={id} onClick={() => show(id)}>+ {LABEL[id]}</button>)}</div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="home-grid editing">
      {column('main')}
      {column('side')}
    </div>
  )
}
