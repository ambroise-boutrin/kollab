import { useState } from 'react'
import { Modal } from './Modal'
import { useToast } from './Toast'
import { useStore } from '../lib/store'
import { PRESENCE, presenceOf, type Member, type PresenceStatus } from '../lib/types'
import { untilLabel } from './StatusSheet'

export const PRESENCE_ORDER: PresenceStatus[] = ['available', 'busy', 'dnd', 'away', 'invisible']

/** Pastille de présence : pleine, barrée (Ne pas déranger) ou creuse (Invisible). */
export function PresenceDot({ status, className = 'presence' }: { status: PresenceStatus; className?: string }) {
  return <i className={`${className} pres-${status}`} style={{ ['--pc' as string]: PRESENCE[status].color, background: status === 'invisible' ? 'transparent' : PRESENCE[status].color }} aria-hidden="true" />
}

const DURATIONS: { id: string; label: string; until: () => string | null }[] = [
  { id: 'toujours', label: 'Toujours', until: () => null },
  { id: '30', label: '30 min', until: () => new Date(Date.now() + 30 * 60e3).toISOString() },
  { id: '60', label: '1 h', until: () => new Date(Date.now() + 60 * 60e3).toISOString() },
  { id: '120', label: '2 h', until: () => new Date(Date.now() + 120 * 60e3).toISOString() },
  { id: 'soir', label: "Aujourd'hui", until: () => { const d = new Date(); d.setHours(23, 59, 0, 0); return d.toISOString() } },
]

/** « Ta présence » façon Teams : 5 présences et une durée, puis retour à « Disponible ». */
export function PresenceSheet({ me, onClose, onMessage }: { me: Member; onClose: () => void; onMessage?: () => void }) {
  const { backend, reload } = useStore()
  const toast = useToast()
  const current = presenceOf(me)
  const [pick, setPick] = useState<PresenceStatus>(current)
  const [duration, setDuration] = useState('toujours')
  const [busy, setBusy] = useState(false)

  async function save() {
    setBusy(true)
    try {
      const until = pick === 'available' ? null : DURATIONS.find((d) => d.id === duration)!.until()
      await backend.updateProfile({ status: pick, presenceUntil: until })
      await reload()
      toast(`${PRESENCE[pick].label}${until ? ` ${untilLabel(until)}` : ''}`)
      onClose()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Ta présence" onClose={onClose} footer={
      <div className="st-foot">
        {onMessage && <button className="btn soft" onClick={() => { onClose(); onMessage() }}>Message de statut</button>}
        <button className="btn" disabled={busy} onClick={() => void save()}>Valider</button>
      </div>
    }>
      <div className="st-body">
        <div className="pr-list" role="radiogroup" aria-label="Présence">
          {PRESENCE_ORDER.map((s) => (
            <button key={s} role="radio" aria-checked={pick === s} className={`pr-opt${pick === s ? ' on' : ''}`} style={{ ['--pc' as string]: PRESENCE[s].color }} onClick={() => setPick(s)}>
              <PresenceDot status={s} className="pr-dot" />
              <span><b>{PRESENCE[s].label}</b><small>{PRESENCE[s].hint}</small></span>
            </button>
          ))}
        </div>
        {pick !== 'available' && (
          <div className="st-group">
            <b>Pendant</b>
            <div className="wz-chips" role="radiogroup" aria-label="Pendant">
              {DURATIONS.map((d) => <button key={d.id} role="radio" aria-checked={duration === d.id} onClick={() => setDuration(d.id)}>{d.label}</button>)}
            </div>
          </div>
        )}
        {current !== 'available' && me.presenceUntil && <p className="muted" style={{ margin: 0, fontSize: 14 }}>Actuellement : {PRESENCE[current].label} {untilLabel(me.presenceUntil)}</p>}
      </div>
    </Modal>
  )
}

const QUICK = DURATIONS.filter((d) => d.id !== '30')

/** Menu flottant à côté de « Disponible » : un clic change la présence tout de suite. */
export function PresenceFlyout({ me, onDone }: { me: Member; onDone: () => void }) {
  const { backend, reload } = useStore()
  const toast = useToast()
  const current = presenceOf(me)
  const [duration, setDuration] = useState('toujours')
  async function choose(s: PresenceStatus) {
    try {
      const until = s === 'available' ? null : QUICK.find((d) => d.id === duration)!.until()
      onDone()
      await backend.updateProfile({ status: s, presenceUntil: until })
      await reload()
      if (until) toast(`${PRESENCE[s].label} ${untilLabel(until)}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible')
    }
  }
  return (
    <div className="pres-fly" role="menu" aria-label="Présence">
      {PRESENCE_ORDER.map((s) => (
        <button key={s} role="menuitemradio" aria-checked={current === s} className={`pres-fly-item${current === s ? ' on' : ''}`} style={{ ['--pc' as string]: PRESENCE[s].color }} onClick={() => void choose(s)}>
          <PresenceDot status={s} className="pres-ic" />
          <span>{PRESENCE[s].label}</span>
        </button>
      ))}
      <div className="pres-fly-dur">
        <span>Pendant</span>
        <div role="radiogroup" aria-label="Pendant">
          {QUICK.map((d) => <button key={d.id} role="radio" aria-checked={duration === d.id} onClick={() => setDuration(d.id)}>{d.label}</button>)}
        </div>
      </div>
    </div>
  )
}
