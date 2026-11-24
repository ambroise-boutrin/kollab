import { useEffect, useState, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'

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
 * Accueil en mode édition : on glisse les blocs directement, on règle leur hauteur au coin,
 * on les masque, et les blocs masqués attendent en bas de la colonne étroite.
 */
export function HomeEditGrid({ layout, onChange, widgets }: { layout: HomeLayout; onChange: (l: HomeLayout) => void; widgets: Record<WidgetId, ReactNode> }) {
  const [dragging, setDragging] = useState<WidgetId | null>(null)
  const [over, setOver] = useState<{ col: 'main' | 'side'; index: number } | null>(null)

  function move(id: WidgetId, col: 'main' | 'side', index: number) {
    const next: HomeLayout = { ...layout, main: layout.main.filter((x) => x !== id), side: layout.side.filter((x) => x !== id), hidden: layout.hidden.filter((x) => x !== id) }
    next[col].splice(Math.min(index, next[col].length), 0, id)
    onChange(next)
  }
  const hide = (id: WidgetId) => onChange({ ...layout, hidden: [...layout.hidden, id] })
  const show = (id: WidgetId) => onChange({ ...layout, hidden: layout.hidden.filter((x) => x !== id) })

  function startResize(id: WidgetId, e: ReactPointerEvent<HTMLSpanElement>) {
    e.preventDefault()
    const box = (e.currentTarget.parentElement as HTMLElement)
    const start = e.clientY
    const h0 = box.getBoundingClientRect().height
    let last = h0
    const onMove = (ev: PointerEvent) => {
      last = Math.max(140, Math.round(h0 + ev.clientY - start))
      box.style.height = `${last}px`
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      onChange({ ...layout, heights: { ...layout.heights, [id]: last } })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  const column = (col: 'main' | 'side') => {
    const ids = layout[col].filter((id) => !layout.hidden.includes(id))
    const slot = (i: number) => (dragging && over?.col === col && over.index === i ? <div key={`slot-${i}`} className="he-slot">Dépose ici</div> : null)
    return (
      <div
        className={col === 'main' ? 'home-main' : 'home-side'}
        onDragOver={(e: DragEvent) => {
          e.preventDefault()
          const items = [...(e.currentTarget as HTMLElement).querySelectorAll(':scope > .he-block')]
          const index = items.findIndex((el) => e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)
          const target = index < 0 ? items.length : index
          if (over?.col !== col || over.index !== target) setOver({ col, index: target })
        }}
        onDrop={(e) => {
          e.preventDefault()
          if (dragging && over) {
            // Le bloc visible devant lequel on dépose → sa place dans la colonne complète.
            const shown = layout[over.col].filter((x) => !layout.hidden.includes(x))
            const before = shown.slice(over.index).find((x) => x !== dragging)
            const full = layout[over.col].filter((x) => x !== dragging)
            move(dragging, over.col, before ? full.indexOf(before) : full.length)
          }
          setDragging(null)
          setOver(null)
        }}
      >
        {ids.map((id, i) => [
          slot(i),
          <div
            key={id}
            className={`he-block${dragging === id ? ' dragging' : ''}`}
            style={layout.heights?.[id] ? { height: layout.heights[id] } : undefined}
            draggable
            onDragStart={(e) => { e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', id); setDragging(id) }}
            onDragEnd={() => { setDragging(null); setOver(null) }}
          >
            <div className="he-bar">
              <span className="he-grip" aria-hidden="true">⋮⋮</span>
              <b>{LABEL[id]}</b>
              <button className="he-hide" onClick={() => hide(id)}>Masquer</button>
            </div>
            <div className="he-content" aria-hidden="true">{widgets[id]}</div>
            <span className="he-corner" role="separator" aria-label={`Hauteur de ${LABEL[id]}`} onPointerDown={(e) => startResize(id, e)} />
          </div>,
        ])}
        {slot(ids.length)}
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
