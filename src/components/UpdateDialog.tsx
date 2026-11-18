import { useEffect, useState } from 'react'
import { dismissUpdate, IS_DESKTOP, onUpdate, RELEASES, type PendingUpdate } from '../lib/updates'
import { Icon } from './Icon'
import { LogoMark } from './Logo'

type Phase = 'offer' | 'downloading' | 'restarting'

/** Fenêtre « Nouvelle version » : nouveautés, téléchargement, puis redémarrage en fondu. */
export function UpdateDialog() {
  const [update, setUpdate] = useState<PendingUpdate | null>(null)
  const [phase, setPhase] = useState<Phase>('offer')
  const [progress, setProgress] = useState<number | null>(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => onUpdate((u) => {
    setUpdate(u)
    setPhase('offer')
    setError(null)
  }), [])

  if (!update) return null

  // Nouveautés : celles de la release, sinon celles de l'historique local pour cette version.
  const items = update.items.length ? update.items : (RELEASES.find((r) => r.version === update.version)?.items ?? [])

  async function install() {
    if (!update) return
    setPhase('downloading')
    setError(null)
    try {
      await update.install((f) => {
        setProgress(f)
        if (f === 1) {
          setPhase('restarting')
          document.documentElement.classList.add('restarting')
        }
      })
    } catch (e) {
      document.documentElement.classList.remove('restarting')
      setPhase('offer')
      setError(e instanceof Error ? e.message : 'La mise à jour a échoué. Réessaie plus tard.')
    }
  }

  const pct = progress === null ? null : Math.round(progress * 100)

  return (
    <div className="update-bg" role="presentation">
      <section className="update" role="dialog" aria-modal="true" aria-labelledby="update-title">
        <div className="update-head">
          <span className="update-logo"><LogoMark size={34} /></span>
          <div style={{ minWidth: 0 }}>
            <span className="update-eyebrow"><Icon name="sparkle" size={14} /> Nouvelle version</span>
            <h2 id="update-title">{update.version ? `Kollab ${update.version} est prête` : 'Une nouvelle version est prête'}</h2>
          </div>
        </div>

        {items.length > 0 && (
          <ul className="update-list">
            {items.map((it, i) => (
              <li key={it} style={{ animationDelay: `${0.12 + i * 0.04}s` }}>
                <span className="update-check"><Icon name="check" size={13} /></span>
                {it}
              </li>
            ))}
          </ul>
        )}

        {phase === 'offer' ? (
          <>
            {error && <p role="alert" style={{ color: 'var(--danger)', margin: 0, fontSize: 14 }}>{error}</p>}
            <div className="update-actions">
              <button className="btn soft" onClick={dismissUpdate}>Plus tard</button>
              <button className="btn update-go" onClick={() => void install()} autoFocus>
                <Icon name="download" size={18} />
                {IS_DESKTOP ? 'Mettre à jour' : 'Recharger'}
              </button>
            </div>
          </>
        ) : (
          <div className="update-progress" aria-live="polite">
            <div className={`update-bar${pct === null ? ' indeterminate' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
              <i style={pct === null ? undefined : { width: `${Math.max(pct, 4)}%` }} />
            </div>
            <span className="muted" style={{ fontSize: 13 }}>
              {phase === 'restarting' ? 'Redémarrage de Kollab…' : pct === null ? 'Téléchargement…' : `Téléchargement… ${pct} %`}
            </span>
          </div>
        )}
      </section>
    </div>
  )
}
