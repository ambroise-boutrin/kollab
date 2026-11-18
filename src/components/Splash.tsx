import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { LogoMark } from './Logo'

/**
 * Écran de lancement : un fondu sobre du logo puis du nom.
 * Il reste affiché tant que les polices et les données ne sont pas prêtes,
 * pour que la première page apparaisse d'un coup, sans saut de texte.
 */
export function Splash() {
  const { ready } = useStore()
  const [fonts, setFonts] = useState(false)
  const [minDone, setMinDone] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    void document.fonts.ready.then(() => setFonts(true))
    // Filets de sécurité : l'écran de lancement ne reste jamais affiché indéfiniment.
    const fontsLate = setTimeout(() => setFonts(true), 2500)
    const t = setTimeout(() => setMinDone(true), 1400)
    return () => {
      clearTimeout(t)
      clearTimeout(fontsLate)
    }
  }, [])

  const leaving = ready && fonts && minDone
  useEffect(() => {
    if (!leaving) return
    const t = setTimeout(() => setGone(true), 500)
    return () => clearTimeout(t)
  }, [leaving])

  if (gone) return null
  return (
    <div className={`splash${leaving ? ' leaving' : ''}`} role="status" aria-label="Chargement de Kollab">
      <div className="splash-inner">
        <div className="mark"><LogoMark size={96} /></div>
        {/* Le nom attend que la police soit chargée : aucun changement de police en pleine animation. */}
        <div className={`word${fonts ? ' go' : ''}`} aria-label="Kollab">
          {'Kollab'.split('').map((c, i) => (
            <span key={i} aria-hidden="true" style={{ animationDelay: `${0.35 + i * 0.045}s` }}>{c}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
