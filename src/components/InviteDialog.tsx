import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { useStore, useWorkspace } from '../lib/store'
import { ROLES, type Invite, type Role } from '../lib/types'
import { Icon, type IconName } from './Icon'
import { Modal } from './Modal'
import { useToast } from './Toast'

/** Adresse de l'app (elle peut vivre sous /app quand le site vitrine occupe la racine). */
export function inviteUrl(code: string) {
  const base = window.location.pathname.startsWith('/app') ? '/app/' : '/'
  return `${window.location.origin}${base}?invitation=${code}`
}

function expiresIn(iso: string) {
  const days = Math.ceil((new Date(iso).getTime() - Date.now()) / 86400000)
  return days <= 1 ? 'expire demain' : `${days} jours`
}

const ROLE_LOOK: Record<Role, { icon: IconName; color: string }> = {
  member: { icon: 'board', color: 'var(--accent)' },
  guest: { icon: 'info', color: '#2F6FD0' },
  admin: { icon: 'shield', color: '#D98A1C' },
}
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Inviter : un lien prêt à partager, ou des emails, avec le rôle choisi. */
export function InviteDialog({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace()
  const { backend } = useStore()
  const toast = useToast()
  const [role, setRole] = useState<Role>('member')
  const [days, setDays] = useState(7)
  const [invites, setInvites] = useState<Invite[]>([])
  const [link, setLink] = useState<Invite | null>(null)
  const [emails, setEmails] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)

  const loadInvites = useCallback(async () => setInvites(await backend.listInvites()), [backend])
  useEffect(() => {
    void loadInvites()
  }, [loadInvites])

  // Un lien est prêt dès l'ouverture, et suit le rôle et la durée choisis.
  useEffect(() => {
    let alive = true
    setLink(null)
    const reuse = invites.find((i) => i.role === role && !i.maxUses && Math.abs(new Date(i.expiresAt).getTime() - Date.now() - days * 86400000) < 86400000)
    if (reuse) return setLink(reuse)
    const id = setTimeout(() => {
      void backend.createInvite(role, { days, maxUses: null }).then((inv) => {
        if (!alive) return
        setLink(inv)
        void loadInvites()
      }).catch((e: Error) => toast(e.message))
    }, 150)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [role, days]) // eslint-disable-line react-hooks/exhaustive-deps

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(inviteUrl(link.code))
    } catch {
      /* le lien reste visible et sélectionnable */
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1600)
  }

  async function share() {
    if (!link) return
    const nav = navigator as Navigator & { share?: (d: ShareData) => Promise<void> }
    if (nav.share) await nav.share({ title: `Rejoins ${ws.group.name} sur Kollab`, url: inviteUrl(link.code) }).catch(() => {})
    else await copy()
  }

  function addEmail(raw: string) {
    const list = raw.split(/[\s,;]+/).map((s) => s.trim()).filter(Boolean)
    const ok = list.filter((e) => EMAIL.test(e) && !emails.includes(e))
    if (ok.length) setEmails((e) => [...e, ...ok])
    setTyped(list.filter((e) => !EMAIL.test(e)).join(' '))
  }
  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (['Enter', ',', ' ', ';'].includes(e.key) && typed.trim()) {
      e.preventDefault()
      addEmail(typed)
    } else if (e.key === 'Backspace' && !typed && emails.length) setEmails((l) => l.slice(0, -1))
  }

  async function sendEmails() {
    const list = [...emails, ...(EMAIL.test(typed.trim()) ? [typed.trim()] : [])]
    if (!list.length) return
    setSending(true)
    const missing: string[] = []
    for (const email of list) {
      try {
        if (!(await backend.inviteByEmail(email, role))) missing.push(email)
      } catch (e) {
        toast(`${email} : ${e instanceof Error ? e.message : 'impossible'}`)
      }
    }
    setSending(false)
    setEmails(missing)
    setTyped('')
    if (missing.length) toast(`Pas encore de compte : envoie-leur le lien (${missing.length})`)
    else toast(list.length > 1 ? `${list.length} invitations envoyées` : 'Invitation envoyée')
  }

  return (
    <Modal title={`Inviter dans ${ws.group.name}`} onClose={onClose}>
      <div className="role-tiles" role="radiogroup" aria-label="Rôle">
        {(['member', 'guest', 'admin'] as Role[]).map((r) => (
          <button key={r} type="button" role="radio" aria-checked={role === r} className="role-tile" style={{ ['--tile' as string]: ROLE_LOOK[r].color }} onClick={() => setRole(r)}>
            <span className="role-ico"><Icon name={ROLE_LOOK[r].icon} size={18} /></span>
            <strong>{ROLES[r].label}</strong>
            <small>{ROLES[r].help}</small>
          </button>
        ))}
      </div>

      <div className="invite-link">
        <span className="invite-link-label">Lien d'invitation · {ROLES[role].label.toLowerCase()}</span>
        <div className="invite-link-row">
          <code>{link ? inviteUrl(link.code).replace(/^https?:\/\//, '') : 'Création…'}</code>
          <button className={`btn${copied ? ' ok' : ''}`} disabled={!link} onClick={() => void copy()}>
            {copied ? <><Icon name="check" size={16} /> Copié</> : 'Copier'}
          </button>
        </div>
        <div className="invite-link-foot">
          <div className="seg-mini" role="radiogroup" aria-label="Validité">
            {[1, 7, 30].map((d) => (
              <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)}>{d === 1 ? '1 jour' : `${d} jours`}</button>
            ))}
          </div>
          <button className="link-btn" onClick={() => void share()}>Partager…</button>
        </div>
      </div>

      {backend.mode === 'supabase' && (
        <div className="invite-emails">
          <span className="invite-link-label">Ou par email</span>
          <div className="chips-input" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
            {emails.map((e) => (
              <span key={e} className="email-chip">{e}<button aria-label={`Retirer ${e}`} onClick={() => setEmails((l) => l.filter((x) => x !== e))}><Icon name="close" size={12} /></button></span>
            ))}
            <input value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={onKey} onBlur={() => typed.trim() && addEmail(typed)} onPaste={(e) => { e.preventDefault(); addEmail(typed + ' ' + e.clipboardData.getData('text')) }} placeholder={emails.length ? '' : 'nom@exemple.fr, autre@exemple.fr'} aria-label="Emails" />
          </div>
          <button className="btn" style={{ alignSelf: 'flex-end' }} disabled={sending || (!emails.length && !EMAIL.test(typed.trim()))} onClick={() => void sendEmails()}>
            {sending ? 'Envoi…' : `Inviter${emails.length > 1 ? ` (${emails.length})` : ''}`}
          </button>
        </div>
      )}

      {invites.length > 0 && (
        <details className="invite-active">
          <summary>{invites.length} lien{invites.length > 1 ? 's' : ''} actif{invites.length > 1 ? 's' : ''}</summary>
          {invites.map((inv) => (
            <div key={inv.id} className="invite-row">
              <span className="role-dot" style={{ background: ROLE_LOOK[inv.role].color }} />
              <span className="pop-grow">
                <strong>{ROLES[inv.role].label}</strong>
                <span className="muted">{expiresIn(inv.expiresAt)} · {inv.uses} arrivée{inv.uses > 1 ? 's' : ''}{inv.maxUses ? ` sur ${inv.maxUses}` : ''}</span>
              </span>
              <button className="icon-btn" aria-label="Révoquer" onClick={() => void backend.revokeInvite(inv.id).then(loadInvites).then(() => link?.id === inv.id && setLink(null))}>
                <Icon name="trash" size={16} />
              </button>
            </div>
          ))}
        </details>
      )}
    </Modal>
  )
}
