import { useEffect, useState } from 'react'
import { Modal } from './Modal'
import { pendingList, type Pending } from '../lib/offline'

const DOT: Record<Pending['kind'], string> = { task: '#D98A1C', new: '#5546E0', message: '#2F6FD0', other: '#8A90A2' }

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60e3)
  return min < 1 ? "à l'instant" : min < 60 ? `il y a ${min} min` : `il y a ${Math.round(min / 60)} h`
}

/** Texte avec **gras**, sans HTML. */
function Bold({ text }: { text: string }) {
  return <>{text.split('**').map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part))}</>
}

/** Bandeau hors ligne (avec ce qui attend d'être envoyé) puis message vert au retour du réseau. */
export function OfflineBar() {
  const [offline, setOffline] = useState(() => !navigator.onLine)
  const [pending, setPending] = useState<Pending[]>(pendingList)
  const [sent, setSent] = useState(0)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const on = () => setOffline(false)
    const off = () => { setOffline(true); setSent(0) }
    const queue = () => setPending(pendingList())
    let timer: ReturnType<typeof setTimeout> | undefined
    const done = (e: Event) => {
      setSent((e as CustomEvent<number>).detail)
      clearTimeout(timer)
      timer = setTimeout(() => setSent(0), 5000)
    }
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    window.addEventListener('kollab:outbox', queue)
    window.addEventListener('kollab:outbox-sent', done)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
      window.removeEventListener('kollab:outbox', queue)
      window.removeEventListener('kollab:outbox-sent', done)
    }
  }, [])

  if (!offline && sent) {
    return (
      <div className="off-bar back" role="status">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true"><path d="m5 12 5 5 9-10" /></svg>
        <span><b>De retour en ligne.</b> {sent} changement{sent > 1 ? 's' : ''} envoyé{sent > 1 ? 's' : ''}.</span>
      </div>
    )
  }
  if (!offline) return null

  return (
    <>
      <button className="off-bar" onClick={() => setOpen(true)}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFD23F" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M2 8a15 15 0 0 1 20 0M5 12a10 10 0 0 1 14 0M8.5 15.5a5 5 0 0 1 7 0M12 19h0M3 3l18 18" /></svg>
        <span><b>Hors ligne.</b> Tu peux continuer, tout part au retour du réseau.</span>
        {pending.length > 0 && <b className="off-count">{pending.length}</b>}
      </button>
      {open && (
        <Modal title="Hors ligne" onClose={() => setOpen(false)}>
          <div className="off-body">
            <section>
              <b>En attente d'envoi</b>
              {pending.length === 0 && <span className="muted">Rien pour l'instant.</span>}
              {pending.map((p) => (
                <span key={p.id} className="off-item">
                  <i style={{ background: DOT[p.kind] }} />
                  <span><Bold text={p.label} /></span>
                  <small>{ago(p.at)}</small>
                </span>
              ))}
            </section>
            <section>
              <b>Ce qui marche hors ligne</b>
              <span className="muted">Tâches, tableau, sprints, documents déjà ouverts, messages (envoyés au retour).</span>
              <span className="muted">Pas de vocal, ni de GitHub, ni de nouveaux fichiers.</span>
            </section>
          </div>
        </Modal>
      )}
    </>
  )
}
