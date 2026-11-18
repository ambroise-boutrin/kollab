import { useEffect, useState, type DragEvent } from 'react'
import { Icon } from './Icon'
import { Modal } from './Modal'

export type WidgetId = 'day' | 'board' | 'activity' | 'reviews' | 'links'
export interface HomeLayout {
  main: WidgetId[]
  side: WidgetId[]
  hidden: WidgetId[]
}

const LABEL: Record<WidgetId, string> = { day: 'Ma journée', board: 'Tableau du sprint', activity: 'Activité', reviews: 'PR à relire', links: 'Liens importants' }
const DEFAULT: HomeLayout = { main: ['day', 'board'], side: ['activity', 'reviews', 'links'], hidden: [] }
const ALL = Object.keys(LABEL) as WidgetId[]

function read(gid: string): HomeLayout {
  try {
    const v = JSON.parse(localStorage.getItem(`kollab-home:${gid}`) ?? '') as HomeLayout
    const known = (l: unknown) => (Array.isArray(l) ? (l as WidgetId[]).filter((x) => ALL.includes(x)) : [])
    const out = { main: known(v.main), side: known(v.side), hidden: known(v.hidden) }
    // Un bloc ajouté plus tard va en bas de la colonne étroite.
    for (const id of ALL) if (!out.main.includes(id) && !out.side.includes(id)) out.side.push(id)
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

/** Fenêtre « Organiser l'accueil » : glisser les blocs d'une colonne à l'autre, les masquer, revenir à l'origine. */
export function HomeLayoutDialog({ layout, onChange, onClose }: { layout: HomeLayout; onChange: (l: HomeLayout) => void; onClose: () => void }) {
  const [dragging, setDragging] = useState<WidgetId | null>(null)
  const [over, setOver] = useState<{ col: 'main' | 'side'; index: number } | null>(null)

  function move(id: WidgetId, col: 'main' | 'side', index: number) {
    const next: HomeLayout = { main: layout.main.filter((x) => x !== id), side: layout.side.filter((x) => x !== id), hidden: layout.hidden }
    const list = next[col]
    list.splice(Math.min(index, list.length), 0, id)
    onChange(next)
  }
  function shift(id: WidgetId, col: 'main' | 'side', d: -1 | 1) {
    const i = layout[col].indexOf(id)
    const j = i + d
    if (j < 0 || j >= layout[col].length) return
    move(id, col, j)
  }
  const toggle = (id: WidgetId) => onChange({ ...layout, hidden: layout.hidden.includes(id) ? layout.hidden.filter((x) => x !== id) : [...layout.hidden, id] })

  const column = (col: 'main' | 'side') => (
    <div
      className={`hl-col ${col}${over?.col === col ? ' over' : ''}`}
      onDragOver={(e: DragEvent) => {
        e.preventDefault()
        const items = [...(e.currentTarget as HTMLElement).querySelectorAll('.hl-item')]
        const index = items.findIndex((el) => e.clientY < el.getBoundingClientRect().top + el.getBoundingClientRect().height / 2)
        setOver({ col, index: index < 0 ? items.length : index })
      }}
      onDragLeave={() => setOver(null)}
      onDrop={(e) => {
        e.preventDefault()
        if (dragging && over) move(dragging, over.col, over.index)
        setDragging(null)
        setOver(null)
      }}
    >
      <span className="task-label">{col === 'main' ? 'Colonne large' : 'Colonne étroite'}</span>
      {layout[col].map((id, i) => {
        const hidden = layout.hidden.includes(id)
        return (
          <div key={id} className={`hl-item${hidden ? ' hidden' : ''}${dragging === id ? ' dragging' : ''}${over?.col === col && over.index === i && dragging ? ' gap' : ''}`} draggable onDragStart={() => setDragging(id)} onDragEnd={() => { setDragging(null); setOver(null) }}>
            <span className="hl-grip" aria-hidden="true">⋮⋮</span>
            <span className={`hl-thumb w-${id}`} aria-hidden="true" />
            <strong>{LABEL[id]}</strong>
            <span className="hl-actions">
              <button className="icon-btn" aria-label={`Monter ${LABEL[id]}`} disabled={i === 0} onClick={() => shift(id, col, -1)}><Icon name="chevron" size={16} /></button>
              <button className="icon-btn down" aria-label={`Descendre ${LABEL[id]}`} disabled={i === layout[col].length - 1} onClick={() => shift(id, col, 1)}><Icon name="chevron" size={16} /></button>
              <button className="icon-btn" aria-label={col === 'main' ? 'Mettre dans la colonne étroite' : 'Mettre dans la colonne large'} title={col === 'main' ? 'Colonne étroite' : 'Colonne large'} onClick={() => move(id, col === 'main' ? 'side' : 'main', 99)}><Icon name="panel" size={16} /></button>
              <button className="icon-btn" aria-label={hidden ? `Afficher ${LABEL[id]}` : `Masquer ${LABEL[id]}`} aria-pressed={hidden} onClick={() => toggle(id)}><Icon name={hidden ? 'eyeOff' : 'eye'} size={16} /></button>
            </span>
          </div>
        )
      })}
      {layout[col].length === 0 && <div className="hl-empty">Glisse un bloc ici</div>}
    </div>
  )

  return (
    <Modal
      title="Organiser l'accueil"
      wide
      onClose={onClose}
      footer={<><button className="btn soft" onClick={() => onChange(DEFAULT)}>Disposition d'origine</button><button className="btn" onClick={onClose}>Terminé</button></>}
    >
      <p className="muted" style={{ margin: '0 0 14px' }}>Glisse les blocs pour les ranger, ou masque ceux dont tu n'as pas besoin. C'est gardé sur cet appareil.</p>
      <div className="hl-grid">
        {column('main')}
        {column('side')}
      </div>
    </Modal>
  )
}
