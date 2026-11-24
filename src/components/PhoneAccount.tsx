import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
import { PromptDialog } from './PromptDialog'
import { useToast } from './Toast'
import { shrinkSquare } from '../lib/image'
import { pushEnabled } from '../lib/push'
import { DEMO_SESSION, leaveDemo, useStore } from '../lib/store'
import { PRESENCE, liveStatus, type PresenceStatus, type Provider } from '../lib/types'
import { StatusSheet, untilLabel } from './StatusSheet'
import { PROVIDERS } from '../pages/Login'

/** « Mon compte » sur téléphone, plein écran : photo, statut, réglages en lignes, déconnexion. */
export function PhoneAccount({ onClose }: { onClose: () => void }) {
  const { workspace, user, backend, reload } = useStore()
  const navigate = useNavigate()
  const toast = useToast()
  const me = workspace?.members.find((m) => m.id === user?.id) ?? workspace?.members[0]
  const [linked, setLinked] = useState<Provider[]>([])
  const [push, setPush] = useState<boolean | null>(null)
  const [naming, setNaming] = useState(false)
  const [statusOpen, setStatusOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    void backend.linkedProviders().then(setLinked).catch(() => undefined)
    void pushEnabled().then(setPush).catch(() => setPush(false))
  }, [backend])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!me) return null
  const go = (to: string) => { onClose(); navigate(to) }
  const shownProviders = PROVIDERS.filter((p) => linked.includes(p.id))

  async function photo(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      await backend.uploadAvatar(await shrinkSquare(file))
      await reload()
      toast('Photo mise à jour')
    } catch (e) {
      toast(e instanceof Error ? e.message : "Impossible d'envoyer la photo")
    } finally {
      setBusy(false)
    }
  }

  async function setStatus(s: PresenceStatus) {
    try {
      await backend.updateProfile({ status: s })
      await reload()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible')
    }
  }

  return createPortal(
    <div className="wizard-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="wizard projects-screen" role="dialog" aria-modal="true" aria-label="Mon compte">
        <header className="pt-head ac-head">
          <button className="wz-text-btn accent" onClick={onClose}>Fermer</button>
          <span>Mon compte</span>
          <span className="pt-head-spacer" />
        </header>
        <div className="pj-body ac-body">
          <div className="ac-hero">
            <button className="ac-photo" aria-label="Changer la photo" disabled={busy} onClick={() => fileRef.current?.click()}>
              <Avatar member={me} size={104} />
              <span className="ac-photo-edit" aria-hidden="true"><Icon name="photo" size={17} /></span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { void photo(e.target.files?.[0]); e.target.value = '' }} />
            <strong>{me.name}</strong>
            <span>{[me.title, workspace?.group.name].filter(Boolean).join(' · ')}</span>
          </div>

          <section className="ac-group" role="group" aria-label="Statut">
            {(Object.keys(PRESENCE) as PresenceStatus[]).map((s) => (
              <button key={s} className={me.status === s ? 'on' : ''} aria-pressed={me.status === s} onClick={() => void setStatus(s)}>
                <i style={{ background: PRESENCE[s].color }} aria-hidden="true" />
                <span>{PRESENCE[s].label}</span>
                {me.status === s && <Icon name="check" size={18} />}
              </button>
            ))}
            <button onClick={() => setStatusOpen(true)}>
              {liveStatus(me) ? (
                <><i style={{ background: me.statusColor ?? 'var(--accent)' }} aria-hidden="true" /><span><b>{liveStatus(me)}</b></span><em className="ac-until">{untilLabel(me.statusUntil)}</em></>
              ) : <span className="ac-key">Ajouter un message de statut…</span>}
            </button>
          </section>

          <section className="ac-group">
            <button onClick={() => setNaming(true)}><span className="ac-key">Nom</span><b>{me.name}</b></button>
            <button onClick={() => go('/reglages#comptes')}>
              <span className="ac-key">Comptes liés</span>
              {shownProviders.length ? (
                <span className="ac-tags">{shownProviders.map((p) => <b key={p.id} style={{ background: p.bg }}>{p.label}</b>)}</span>
              ) : <em>Relier</em>}
            </button>
            <button onClick={() => go('/reglages#notifications')}>
              <span className="ac-key">Notifications</span>
              {push == null ? null : push ? <b style={{ color: 'var(--ok)' }}>Activées</b> : <em>Activer</em>}
            </button>
            <button onClick={() => go('/reglages#apparence')}>
              <span className="ac-key">Apparence</span>
              <span className="ac-dots"><i style={{ background: 'var(--accent)' }} /><i style={{ background: 'var(--text)' }} /></span>
            </button>
          </section>

          <button className="ac-logout" onClick={() => { onClose(); if (DEMO_SESSION) leaveDemo(); else void backend.signOut() }}>
            {DEMO_SESSION ? 'Quitter la démo' : 'Se déconnecter'}
          </button>
        </div>
      </div>
      {statusOpen && <StatusSheet me={me} onClose={() => setStatusOpen(false)} />}
      {naming && (
        <PromptDialog
          title="Ton nom"
          confirm="Enregistrer"
          fields={[{ name: 'name', label: 'Nom', initial: me.name, maxLength: 40, required: true }]}
          onClose={() => setNaming(false)}
          onSubmit={async ({ name }) => {
            if (!name.trim()) return 'Écris ton nom'
            await backend.updateProfile({ name: name.trim() })
            await reload()
            setNaming(false)
            toast('Nom enregistré')
          }}
        />
      )}
    </div>,
    document.body,
  )
}
