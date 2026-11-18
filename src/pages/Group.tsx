import { useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import type { Role } from '../lib/types'

const ROLES: Record<Role, string> = { admin: 'Admin', member: 'Membre', guest: 'Invité (lecture seule)' }

export function Group() {
  const ws = useWorkspace()
  const { user, online, backend, reload } = useStore()
  const toast = useToast()
  const [hook, setHook] = useState('')
  const isAdmin = ws.members.find((m) => m.id === user?.id)?.role === 'admin' || backend.mode === 'demo'
  const inviteLink = `${window.location.origin}/?invitation=${ws.group.inviteCode}`

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteLink)
      toast("Lien d'invitation copié")
    } catch {
      toast(inviteLink)
    }
  }

  async function saveHook(e: FormEvent) {
    e.preventDefault()
    try {
      await backend.setDiscordWebhook(hook.trim() || null)
      setHook('')
      await reload()
      toast(hook.trim() ? 'Discord est relié' : 'Discord est délié')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Impossible de relier Discord')
    }
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-head">
        <h1>{ws.group.name}</h1>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
        <section className="card appear" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Membres</h2>
          {ws.members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar member={m} size={38} online={online.includes(m.id)} />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <strong style={{ fontWeight: 600 }}>{m.name}</strong>
                <span className="muted" style={{ fontSize: 13 }}>{ROLES[m.role]}{online.includes(m.id) ? ' · en ligne' : ''}</span>
              </span>
            </div>
          ))}
        </section>

        <section className="card appear appear-2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Inviter des personnes</h2>
          <p className="muted" style={{ margin: 0 }}>Envoie ce lien. La personne se connecte avec GitHub, Google, Discord ou son email, et rejoint le groupe.</p>
          <div className="input" style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 14 }}>{inviteLink}</span>
          </div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => void copy()}>Copier le lien</button>
            <span className="muted" style={{ fontSize: 13 }}>Code : <strong>{ws.group.inviteCode}</strong></span>
          </div>
        </section>

        <section className="card appear appear-3" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h2>Notifications Discord</h2>
            <span className="tag" style={{ marginLeft: 'auto', background: ws.group.discordWebhookSet ? 'color-mix(in srgb, var(--ok) 15%, transparent)' : 'var(--subtle)', color: ws.group.discordWebhookSet ? 'var(--ok)' : 'var(--muted)' }}>
              {ws.group.discordWebhookSet ? 'Relié' : 'Non relié'}
            </span>
          </div>
          <p className="muted" style={{ margin: 0 }}>
            Kollab poste dans un salon de ton serveur quand une tâche est attribuée ou terminée, ou quand une PR est liée. Sur Discord : Paramètres du salon › Intégrations › Webhooks › Nouveau webhook, puis « Copier l'URL ».
          </p>
          {isAdmin ? (
            <form onSubmit={saveHook} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label className="field">
                URL du webhook
                <input className="input" type="url" placeholder="https://discord.com/api/webhooks/…" value={hook} onChange={(e) => setHook(e.target.value)} />
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ background: '#5865F2' }} disabled={!hook.trim()}>Relier Discord</button>
                {ws.group.discordWebhookSet && <button type="button" className="btn soft" onClick={() => { setHook(''); void backend.setDiscordWebhook(null).then(reload) }}>Délier</button>}
              </div>
            </form>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Seul un admin du groupe peut relier Discord.</p>
          )}
        </section>
      </div>
    </div>
  )
}
