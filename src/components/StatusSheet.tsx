import { useState } from 'react'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { useStore } from '../lib/store'
import { liveStatus, type Member, type PresenceStatus } from '../lib/types'

/** Statuts tout prêts : texte, couleur et présence associée. */
export const STATUS_PRESETS: { text: string; color: string; presence: PresenceStatus }[] = [
  { text: 'En réunion', color: '#D9822B', presence: 'busy' },
  { text: 'Focus', color: '#5546E0', presence: 'busy' },
  { text: 'En pause', color: '#2F6FD0', presence: 'away' },
  { text: 'En télétravail', color: '#8A90A2', presence: 'available' },
  { text: 'En déplacement', color: '#0F7A63', presence: 'away' },
  { text: 'Malade', color: '#C2413A', presence: 'away' },
]

const DURATIONS: { id: string; label: string; until: () => string | null }[] = [
  { id: '30', label: '30 min', until: () => new Date(Date.now() + 30 * 60e3).toISOString() },
  { id: '60', label: '1 h', until: () => new Date(Date.now() + 60 * 60e3).toISOString() },
  { id: '120', label: '2 h', until: () => new Date(Date.now() + 120 * 60e3).toISOString() },
  { id: 'soir', label: 'Ce soir', until: () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.toISOString() } },
  { id: 'jamais', label: 'Jamais', until: () => null },
]

export function untilLabel(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  const today = d.toDateString() === new Date().toDateString()
  const h = d.getHours() === 23 && d.getMinutes() === 59 ? 'ce soir' : `jusqu'à ${d.getHours()} h${d.getMinutes() ? ` ${String(d.getMinutes()).padStart(2, '0')}` : ''}`
  return today ? h : `jusqu'au ${d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`
}

/** « Ton statut » : un statut tout prêt ou ton message, et quand il s'efface. */
export function StatusSheet({ me, onClose }: { me: Member; onClose: () => void }) {
  const { backend, reload } = useStore()
  const toast = useToast()
  const current = liveStatus(me)
  const [text, setText] = useState(current)
  const [custom, setCustom] = useState(current && !STATUS_PRESETS.some((p) => p.text === current) ? current : '')
  const [duration, setDuration] = useState('60')
  const [busy, setBusy] = useState(false)
  const preset = STATUS_PRESETS.find((p) => p.text === text)

  async function save(clear = false) {
    setBusy(true)
    try {
      const t = clear ? '' : (custom.trim() || text).slice(0, 60)
      const p = STATUS_PRESETS.find((x) => x.text === t)
      await backend.updateProfile({
        statusText: t,
        statusColor: t ? p?.color ?? 'var(--accent)' : null,
        statusUntil: t ? DURATIONS.find((d) => d.id === duration)!.until() : null,
        ...(p ? { status: p.presence } : clear ? { status: 'available' as const } : {}),
      })
      await reload()
      toast(t ? 'Statut mis' : 'Statut effacé')
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setBusy(false)
    }
  }

  const shown = custom.trim() || text
  const shownColor = custom.trim() ? 'var(--accent)' : preset?.color

  return (
    <Modal title="Ton statut" onClose={onClose} footer={
      <div className="st-foot">
        {current && <button className="btn soft" disabled={busy} onClick={() => void save(true)}>Effacer</button>}
        <button className="btn" disabled={busy || !shown} onClick={() => void save()}>Mettre ce statut</button>
      </div>
    }>
      <div className="st-body">
        <div className={`st-now${shown ? ' on' : ''}`}>
          <i style={{ background: shownColor ?? 'var(--line)' }} />
          <span>{shown || 'Aucun statut'}</span>
          {shown && <em>{untilLabel(DURATIONS.find((d) => d.id === duration)!.until()) || 'sans fin'}</em>}
        </div>
        <div className="st-group">
          <b>Choisir</b>
          <div className="st-grid">
            {STATUS_PRESETS.map((p) => {
              const on = !custom.trim() && text === p.text
              return (
                <button key={p.text} aria-pressed={on} className={on ? 'on' : ''} style={{ ['--c' as string]: p.color }} onClick={() => { setText(p.text); setCustom('') }}>
                  {!on && <i />}{p.text}
                </button>
              )
            })}
          </div>
          <input className="wz-input" placeholder="Ou écris ton message" value={custom} maxLength={60} onChange={(e) => setCustom(e.target.value)} />
        </div>
        <div className="st-group">
          <b>Effacer après</b>
          <div className="wz-chips" role="radiogroup" aria-label="Effacer après">
            {DURATIONS.map((d) => <button key={d.id} role="radio" aria-checked={duration === d.id} onClick={() => setDuration(d.id)}>{d.label}</button>)}
          </div>
        </div>
      </div>
    </Modal>
  )
}
