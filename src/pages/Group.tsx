import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import { ROLES, type Invite, type Role } from '../lib/types'

/** Adresse de l'app (elle peut vivre sous /app quand le site vitrine occupe la racine). */
function inviteUrl(code: string) {
  const base = window.location.pathname.startsWith('/app') ? '/app/' : '/'
  return `${window.location.origin}${base}?invitation=${code}`
}

function expiresIn(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return days <= 1 ? 'expire demain' : `expire dans ${days} jours`
}

export function Group() {
  const ws = useWorkspace()
  const { user, online, backend, reload } = useStore()
  const toast = useToast()
  const me = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const isAdmin = me?.role === 'admin'

  const [invites, setInvites] = useState<Invite[]>([])
  const [role, setRole] = useState<Role>('member')
  const [days, setDays] = useState(7)
  const [single, setSingle] = useState(false)
  const [hook, setHook] = useState('')

  const loadInvites = useCallback(async () => {
    if (isAdmin) setInvites(await backend.listInvites())
  }, [backend, isAdmin])
  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  async function copy(text: string, msg: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast(msg)
    } catch {
      toast(text)
    }
  }

  async function createInvite(e: FormEvent) {
    e.preventDefault()
    try {
      const inv = await backend.createInvite(role, { days, maxUses: single ? 1 : null })
      await loadInvites()
      await copy(inviteUrl(inv.code), `Lien ${ROLES[role].label.toLowerCase()} copié`)
    } catch (err) {
      toast(err instanceof Error ? err.message : "Impossible de créer l'invitation")
    }
  }

  async function changeRole(memberId: string, next: Role) {
    try {
      await backend.setMemberRole(memberId, next)
      await reload()
      toast('Droits mis à jour')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Changement impossible')
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 18, alignItems: 'start' }}>
        <section className="card appear" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Membres</h2>
          {ws.members.map((m) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar member={m} size={40} online={online.includes(m.id)} />
              <span style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <strong style={{ fontWeight: 600 }}>{m.name}{m.id === me?.id && <span className="muted" style={{ fontWeight: 400 }}> (toi)</span>}</strong>
                <span className="muted" style={{ fontSize: 13 }}>{m.title || ROLES[m.role].label}</span>
              </span>
              {isAdmin ? (
                <select className="input" style={{ width: 'auto', minHeight: 36, padding: '6px 10px' }} aria-label={`Droits de ${m.name}`} value={m.role} onChange={(e) => void changeRole(m.id, e.target.value as Role)}>
                  {(Object.keys(ROLES) as Role[]).map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
                </select>
              ) : (
                <span className="tag" style={{ background: 'var(--subtle)', color: 'var(--muted)' }}>{ROLES[m.role].label}</span>
              )}
            </div>
          ))}
        </section>

        <section className="card appear appear-2" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <h2>Inviter quelqu'un</h2>
          {isAdmin ? (
            <form onSubmit={createInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="field">
                Ce que la personne pourra faire
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }} role="group" aria-label="Droits">
                  {(Object.keys(ROLES) as Role[]).map((r) => (
                    <button type="button" key={r} className="role-card" aria-pressed={role === r} onClick={() => setRole(r)}>
                      <strong style={{ fontSize: 14 }}>{ROLES[r].label}</strong>
                      <span className="muted" style={{ fontSize: 12, fontWeight: 400 }}>{ROLES[r].help}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid-2">
                <label className="field">
                  Valable
                  <select className="input" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                    <option value={1}>1 jour</option>
                    <option value={7}>7 jours</option>
                    <option value={30}>30 jours</option>
                  </select>
                </label>
                <label className="field" style={{ justifyContent: 'flex-end' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 44 }}>
                    <input type="checkbox" checked={single} onChange={(e) => setSingle(e.target.checked)} style={{ width: 18, height: 18, accentColor: 'var(--accent)' }} />
                    Une seule personne
                  </span>
                </label>
              </div>
              <button className="btn">Créer et copier le lien</button>
            </form>
          ) : (
            <p className="muted" style={{ margin: 0 }}>Seul un admin du groupe peut inviter des personnes.</p>
          )}

          {invites.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Invitations actives</span>
              {invites.map((inv) => (
                <div key={inv.id} className="invite">
                  <span className="tag feature">{ROLES[inv.role].label}</span>
                  <span style={{ flex: 1, fontSize: 13 }} className="muted">
                    {expiresIn(inv.expiresAt)}{inv.maxUses ? ` · ${inv.uses}/${inv.maxUses} utilisée` : ` · ${inv.uses} utilisation${inv.uses > 1 ? 's' : ''}`}
                  </span>
                  <button className="btn soft small" onClick={() => void copy(inviteUrl(inv.code), 'Lien copié')}>Copier</button>
                  <button className="icon-btn" aria-label="Révoquer l'invitation" onClick={() => void backend.revokeInvite(inv.id).then(loadInvites)}>
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
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
