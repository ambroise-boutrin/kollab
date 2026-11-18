import { useState } from 'react'
import { useStore } from '../lib/store'

/** Affiché quand le groupe n'a pas pu être chargé, pour ne jamais rester bloqué au lancement. */
export function LoadError({ message }: { message: string }) {
  const { reload, backend } = useStore()
  const [busy, setBusy] = useState(false)

  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <div className="card appear" style={{ width: 'min(440px, 100%)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 26 }}>Kollab n'a pas pu charger ton groupe</h1>
          <p className="muted" style={{ margin: '6px 0 0' }}>Vérifie ta connexion internet, puis réessaie.</p>
        </div>
        <code style={{ fontSize: 13, padding: '10px 12px', borderRadius: 12, background: 'var(--subtle)', color: 'var(--muted)', overflowWrap: 'anywhere' }}>{message}</code>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button className="btn" disabled={busy} onClick={() => { setBusy(true); void reload().finally(() => setBusy(false)) }}>
            {busy ? 'Chargement…' : 'Réessayer'}
          </button>
          <button className="btn soft" onClick={() => void backend.signOut()}>Se déconnecter</button>
        </div>
      </div>
    </div>
  )
}
