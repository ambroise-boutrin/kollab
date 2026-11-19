import { useRef, useState, type ChangeEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { Icon } from '../components/Icon'
import { useStore } from '../lib/store'
import { PRESENCE, type PresenceStatus, type ProfilePatch } from '../lib/types'

const COLORS = ['#5546E0', '#2F6FD0', '#0F7A63', '#2E7D4F', '#B5462E', '#C2413A', '#9B3FB8', '#14142B']

/** Réduit la photo à 256 px en WebP avant l'envoi : légère et rapide à afficher. */
async function shrink(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const size = 256
  const side = Math.min(bitmap.width, bitmap.height)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  canvas.getContext('2d')!.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size)
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Image illisible'))), 'image/webp', 0.85))
}

export function ProfileCard() {
  const { workspace, user, backend, reload } = useStore()
  const toast = useToast()
  const me = workspace?.members.find((m) => m.id === user?.id) ?? workspace?.members[0]
  const [name, setName] = useState(me?.name ?? '')
  const [title, setTitle] = useState(me?.title ?? '')
  const fileRef = useRef<HTMLInputElement>(null)
  if (!me) return null

  async function save(patch: ProfilePatch, msg?: string) {
    try {
      await backend.updateProfile(patch)
      await reload()
      if (msg) toast(msg)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Enregistrement impossible')
    }
  }

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    try {
      await backend.uploadAvatar(await shrink(file))
      await reload()
      toast('Photo mise à jour')
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible d'envoyer la photo")
    }
  }

  const [busy, setBusy] = useState(false)

  return (
    <section className="card appear profile-card" style={{ gridColumn: '1 / -1' }}>
      <div className="profile-hero">
        <button className="profile-photo" aria-label="Changer la photo" disabled={busy} onClick={() => fileRef.current?.click()}>
          <Avatar member={me} size={96} />
          <span className="profile-photo-edit" aria-hidden="true"><Icon name="photo" size={16} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => { setBusy(true); void onPhoto(e).finally(() => setBusy(false)) }} />
        <strong className="profile-name">{me.name}</strong>
        <span className="profile-sub">{me.title || 'Ajoute ton rôle ci-dessous'}</span>
        {me.avatarUrl && <button className="link-btn" onClick={() => void backend.removeAvatar().then(reload)}>Retirer la photo</button>}
      </div>

      <div className="profile-group" role="group" aria-label="Statut">
        {(Object.keys(PRESENCE) as PresenceStatus[]).map((s) => (
          <button key={s} className="profile-row" aria-pressed={me.status === s} onClick={() => void save({ status: s })}>
            <span className="presence" style={{ background: PRESENCE[s].color }} aria-hidden="true" />
            <span className="profile-row-label">{PRESENCE[s].label}</span>
            {me.status === s && <Icon name="check" size={18} />}
          </button>
        ))}
      </div>

      <div className="profile-group">
        <label className="profile-row">
          <span className="profile-row-label">Nom</span>
          <input className="profile-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && name !== me.name && void save({ name: name.trim() }, 'Nom enregistré')} />
        </label>
        <label className="profile-row">
          <span className="profile-row-label">Rôle</span>
          <input className="profile-input" value={title} maxLength={60} placeholder="ex. Développeuse front" onChange={(e) => setTitle(e.target.value)} onBlur={() => title !== me.title && void save({ title: title.trim() }, 'Rôle enregistré')} />
        </label>
      </div>

      {!me.avatarUrl && (
        <div className="field">
          Couleur
          <div className="colors" role="group" aria-label="Couleur de l'avatar">
            {COLORS.map((c) => (
              <button key={c} className={`color-dot${me.color === c ? ' selected' : ''}`} style={{ background: c }} aria-label={c} aria-pressed={me.color === c} onClick={() => void save({ color: c })} />
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
