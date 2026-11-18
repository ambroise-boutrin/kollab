import { useState } from 'react'
import { useToast } from '../components/Toast'
import { useStore } from '../lib/store'

const CONFIRM = 'SUPPRIMER'

/** Suppression du compte, avec une confirmation à taper pour éviter les erreurs. */
export function DangerCard() {
  const { backend } = useStore()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)

  async function remove() {
    setBusy(true)
    try {
      await backend.deleteAccount()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Suppression impossible')
      setBusy(false)
    }
  }

  return (
    <section className="card appear appear-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <h2>Supprimer mon compte</h2>
        <p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>
          Ton profil, ta photo et tes messages sont effacés pour de bon. Si tu es le seul admin d'un groupe, un autre membre le devient.
        </p>
      </div>
      {open ? (
        <div className="appear" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label className="field">
            Tape {CONFIRM} pour confirmer
            <input className="input" value={typed} autoComplete="off" onChange={(e) => setTyped(e.target.value)} />
          </label>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn danger" disabled={typed !== CONFIRM || busy} onClick={() => void remove()}>
              {busy ? 'Suppression…' : 'Supprimer définitivement'}
            </button>
            <button className="btn soft" onClick={() => { setOpen(false); setTyped('') }}>Annuler</button>
          </div>
        </div>
      ) : (
        <button className="btn soft" style={{ alignSelf: 'flex-start', color: 'var(--danger)' }} onClick={() => setOpen(true)}>Supprimer mon compte</button>
      )}
    </section>
  )
}
