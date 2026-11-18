import { useEffect, useState, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Icon, type IconName } from './Icon'

export interface Section { id: string; label: string; icon: IconName; render: () => ReactNode }

/** Page de réglages : menu des sections à gauche (en onglets sur téléphone), contenu à droite. */
export function SectionsPage({ title, subtitle, sections }: { title: string; subtitle?: string; sections: Section[] }) {
  const { hash } = useLocation()
  const navigate = useNavigate()
  const fromHash = () => sections.find((s) => `#${s.id}` === hash)?.id ?? sections[0].id
  const [active, setActive] = useState(fromHash)
  useEffect(() => setActive(fromHash()), [hash]) // eslint-disable-line react-hooks/exhaustive-deps
  const current = sections.find((s) => s.id === active) ?? sections[0]

  return (
    <div className="page settings">
      <div>
        <h1>{title}</h1>
        {subtitle && <p className="muted" style={{ margin: '2px 0 0' }}>{subtitle}</p>}
      </div>
      <div className="settings-grid">
        <nav className="settings-nav" aria-label={title}>
          {sections.map((s) => (
            <button key={s.id} className={s.id === current.id ? 'active' : undefined} aria-current={s.id === current.id ? 'page' : undefined} onClick={() => navigate(`#${s.id}`, { replace: true })}>
              <Icon name={s.icon} size={18} />
              {s.label}
            </button>
          ))}
        </nav>
        <div className="settings-body" key={current.id}>{current.render()}</div>
      </div>
    </div>
  )
}
