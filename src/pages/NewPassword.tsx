import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'

/** Écran ouvert par le lien « mot de passe oublié ». */
export function NewPassword({ onDone }: { onDone(): void }) {
  const { backend } = useStore()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await backend.setPassword(password)
      onDone()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Changement impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="page" style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
      <form className="card appear" onSubmit={submit} style={{ width: 'min(420px, 100%)', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h1 style={{ fontSize: 28 }}>Nouveau mot de passe</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Choisis-en un que tu n'utilises pas ailleurs.</p>
        </div>
        <label className="field">
          Mot de passe
          <input className="input" type="password" required minLength={8} autoComplete="new-password" placeholder="8 caractères minimum" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn" disabled={busy}>Enregistrer</button>
        {error && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
      </form>
    </div>
  )
}
