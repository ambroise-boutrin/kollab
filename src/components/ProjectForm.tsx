import { useState, type FormEvent } from 'react'
import { touchScreen } from './Modal'
import { hasWizardDraft, ProjectWizard } from './ProjectWizard'
import { useStore } from '../lib/store'

export type ProjectOutcome = { id: string; how: 'created' | 'joined' }

/** Créer un projet (en étapes), ou en rejoindre un avec un code. */
export function ProjectForm({ onDone, initialCode = '' }: { onDone: (r: ProjectOutcome) => void | Promise<void>; initialCode?: string }) {
  const { backend } = useStore()
  const [tab, setTab] = useState<'create' | 'join'>(initialCode ? 'join' : 'create')
  const [wizard, setWizard] = useState(() => !initialCode && hasWizardDraft())
  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function join(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onDone({ id: await backend.joinGroup(code.trim()), how: 'joined' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="project-form">
      <div className="tabs-seg" role="tablist" aria-label="Créer ou rejoindre">
        <button role="tab" aria-selected={tab === 'create'} onClick={() => setTab('create')}>Créer un projet</button>
        <button role="tab" aria-selected={tab === 'join'} onClick={() => setTab('join')}>Rejoindre avec un code</button>
      </div>

      {tab === 'create' ? (
        <div className="stack appear">
          <p className="muted" style={{ margin: 0 }}>Nom, modèle, dépôt GitHub, équipe, rythme et Discord : six étapes, toutes passables sauf le nom.</p>
          <button className="btn" onClick={() => setWizard(true)}>Créer un projet</button>
          {wizard && <ProjectWizard onClose={() => setWizard(false)} onDone={async (id) => { setWizard(false); await onDone({ id, how: 'created' }) }} />}
        </div>
      ) : (
        <form onSubmit={join} className="stack appear">
          <label className="field">
            Code ou lien d'invitation
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/^.*[?&]invitation=/, ''))}
              placeholder="ex. 4F9A2C7B1D"
              autoFocus={!touchScreen()}
            />
            <span className="field-help">Demande-le à un admin du projet : il le trouve dans Équipe › Inviter.</span>
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="btn" disabled={busy || !code.trim()}>{busy ? 'Connexion…' : 'Rejoindre le projet'}</button>
        </form>
      )}
    </div>
  )
}
