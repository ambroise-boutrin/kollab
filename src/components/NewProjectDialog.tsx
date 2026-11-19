import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Modal, touchScreen } from './Modal'
import { ProjectWizard } from './ProjectWizard'
import { useToast } from './Toast'

/** Nouveau projet (création en étapes) ou rejoindre un projet avec un code. */
export function NewProjectDialog({ onClose, mode = 'create' }: { onClose: () => void; mode?: 'create' | 'join' }) {
  const { switchGroup, backend } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function open(id: string) {
    await switchGroup(id)
    onClose()
    navigate('/')
  }

  if (mode === 'create') return <ProjectWizard onClose={onClose} onDone={open} />

  async function join(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await open(await backend.joinGroup(code.trim()))
      toast('Tu as rejoint le projet')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Code refusé')
      setBusy(false)
    }
  }

  return (
    <Modal title="Rejoindre avec un code" onClose={onClose}>
      <form onSubmit={join} className="stack">
        <label className="field">
          Code ou lien d'invitation
          <input className="input" value={code} onChange={(e) => setCode(e.target.value.replace(/^.*[?&]invitation=/, ''))} placeholder="ex. 4F9A2C7B1D" autoFocus={!touchScreen()} />
          <span className="field-help">Demande-le à un admin du projet.</span>
        </label>
        {error && <p role="alert" className="form-error">{error}</p>}
        <button className="btn" disabled={busy || !code.trim()}>{busy ? 'Connexion…' : 'Rejoindre le projet'}</button>
      </form>
    </Modal>
  )
}
