import { APP_BASE } from '../lib/base'
import { useState, type FormEvent } from 'react'
import { LogoMark } from '../components/Logo'
import { useStore } from '../lib/store'

/** Premier passage : créer un groupe ou en rejoindre un avec un code. */
export function Welcome() {
  const { backend, reload } = useStore()
  const params = new URLSearchParams(window.location.search)
  const [name, setName] = useState('')
  const [code, setCode] = useState(params.get('invitation') ?? '')
  const [error, setError] = useState<string | null>(null)

  async function run(fn: () => Promise<void>) {
    setError(null)
    try {
      await fn()
      window.history.replaceState(null, '', `${APP_BASE}/`)
      await reload()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    }
  }

  const create = (e: FormEvent) => { e.preventDefault(); void run(() => backend.createGroup(name.trim() || 'Mon équipe')) }
  const join = (e: FormEvent) => { e.preventDefault(); void run(() => backend.joinGroup(code)) }

  return (
    <div className="page" style={{ minHeight: '100%', display: 'grid', placeItems: 'center', padding: 20 }}>
      <div style={{ width: '100%', maxWidth: 440, display: 'flex', flexDirection: 'column', gap: 18 }}>
        <LogoMark size={56} />
        <div>
          <h1>Bienvenue sur Kollab</h1>
          <p className="muted" style={{ margin: '4px 0 0' }}>Crée le groupe de ton équipe, ou rejoins-en un avec ton code d'invitation.</p>
        </div>
        <form className="card appear" onSubmit={join} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="field">
            Code d'invitation
            <input className="input" value={code} onChange={(e) => setCode(e.target.value)} placeholder="ex. 4F9A2C7B1D" />
          </label>
          <button className="btn" disabled={!code.trim()}>Rejoindre le groupe</button>
        </form>
        <form className="card appear appear-2" onSubmit={create} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="field">
            Nom du nouveau groupe
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Projet L3" />
          </label>
          <button className="btn soft">Créer le groupe</button>
        </form>
        {error && <p role="alert" style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
        <button className="btn soft small" style={{ alignSelf: 'flex-start' }} onClick={() => void backend.signOut()}>Se déconnecter</button>
      </div>
    </div>
  )
}
