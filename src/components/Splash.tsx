import { useEffect, useState } from 'react'
import { LogoMark } from './Logo'

/** Animation de lancement : un fondu sobre du logo puis du nom. */
export function Splash() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2000)
    return () => clearTimeout(t)
  }, [])
  if (!visible) return null
  return (
    <div className="splash" role="status" aria-label="Chargement de Kollab">
      <div className="splash-inner">
        <div className="mark"><LogoMark size={96} /></div>
        <div className="word">Kollab</div>
      </div>
    </div>
  )
}
