import { useCallback, useEffect, useState, type KeyboardEvent } from 'react'
import { useStore, useWorkspace } from '../lib/store'
import { ROLES, type EmailInvite, type Invite, type Role } from '../lib/types'
import { Avatar } from './Avatar'
import { Icon } from './Icon'
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

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLE_ORDER: Role[] = ['member', 'guest', 'admin']

function RoleSelect({ value, onChange, label }: { value: Role; onChange: (r: Role) => void; label: string }) {
  return (
    <label className="role-select">
      <span className="sr-only">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value as Role)}>
        {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLES[r].label}</option>)}
      </select>
      <Icon name="chevron" size={14} />
    </label>
  )
}

/** Inviter, façon Canva : des emails et un rôle en haut, les invitations en attente, puis un lien à partager. */
export function InviteDialog({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace()
  const { backend } = useStore()
  const toast = useToast()
  const [role, setRole] = useState<Role>('member')
  const [linkRole, setLinkRole] = useState<Role>('member')
  const [days, setDays] = useState(7)
  const [invites, setInvites] = useState<Invite[]>([])
  const [pending, setPending] = useState<EmailInvite[]>([])
  const [link, setLink] = useState<Invite | null>(null)
  const [emails, setEmails] = useState<string[]>([])
  const [typed, setTyped] = useState('')
  const [copied, setCopied] = useState(false)
  const [sending, setSending] = useState(false)

  const loadInvites = useCallback(async () => setInvites(await backend.listInvites()), [backend])
  const loadPending = useCallback(async () => setPending(await backend.listEmailInvites().catch(() => [])), [backend])
  useEffect(() => {
    void loadInvites()
    void loadPending()
  }, [loadInvites, loadPending])

  // Un lien est prêt dès l'ouverture, et suit le rôle et la durée choisis.
  useEffect(() => {
    let alive = true
    setLink(null)
    const reuse = invites.find((i) => i.role === linkRole && !i.maxUses && Math.abs(new Date(i.expiresAt).getTime() - Date.now() - days * 86400000) < 86400000)
    if (reuse) return setLink(reuse)
    const id = setTimeout(() => {
      void backend.createInvite(linkRole, { days, maxUses: null }).then((inv) => {
        if (!alive) return
        setLink(inv)
        void loadInvites()
      }).catch((e: Error) => toast(e.message))
    }, 150)
    return () => {
      alive = false
      clearTimeout(id)
    }
  }, [linkRole, days]) // eslint-disable-line react-hooks/exhaustive-deps

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
    if ([',', ' ', ';'].includes(e.key) && typed.trim()) {
      e.preventDefault()
      addEmail(typed)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      void send()
    } else if (e.key === 'Backspace' && !typed && emails.length) setEmails((l) => l.slice(0, -1))
  }

  async function send() {
    const list = [...emails, ...(EMAIL.test(typed.trim()) ? [typed.trim()] : [])]
    if (!list.length) return
    setSending(true)
    const failed: string[] = []
    let notEmailed = 0
    for (const email of list) {
      try {
        const r = await backend.inviteByEmail(email, role)
        if (!r.emailed && !r.account) notEmailed++
      } catch (e) {
        failed.push(email)
        toast(`${email} : ${e instanceof Error ? e.message : 'impossible'}`)
      }
    }
    setSending(false)
    setEmails(failed)
    setTyped('')
    void loadPending()
    const ok = list.length - failed.length
    if (!ok) return
    if (notEmailed) toast('Invitation créée, mais l’email n’a pas pu partir : envoie-leur le lien')
    else toast(ok > 1 ? `${ok} invitations envoyées` : 'Invitation envoyée')
  }

  async function cancel(inv: EmailInvite) {
    setPending((l) => l.filter((x) => x.id !== inv.id))
    try {
      await backend.cancelEmailInvite(inv.id)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Annulation impossible')
      void loadPending()
    }
  }

  const canSend = emails.length > 0 || EMAIL.test(typed.trim())

  return (
    <Modal title={`Inviter dans ${ws.group.name}`} onClose={onClose}>
      <div className="invite-compose">
        <div className="chips-input" onClick={(e) => (e.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>
          {emails.map((e) => (
            <span key={e} className="email-chip">{e}<button aria-label={`Retirer ${e}`} onClick={() => setEmails((l) => l.filter((x) => x !== e))}><Icon name="close" size={12} /></button></span>
          ))}
          <input
            autoFocus
            type="email"
            inputMode="email"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            onKeyDown={onKey}
            onBlur={() => typed.trim() && addEmail(typed)}
            onPaste={(e) => { e.preventDefault(); addEmail(typed + ' ' + e.clipboardData.getData('text')) }}
            placeholder={emails.length ? 'Ajouter une adresse' : 'Adresses email'}
            aria-label="Adresses email"
          />
        </div>
        <div className="invite-send">
          <RoleSelect value={role} onChange={setRole} label="Rôle des personnes invitées" />
          <button className="btn" disabled={sending || !canSend} onClick={() => void send()}>
            {sending ? 'Envoi…' : 'Envoyer l’invitation'}
          </button>
        </div>
        <p className="invite-hint">{ROLES[role].help}</p>
      </div>

      {pending.length > 0 && (
        <div className="invite-people">
          <span className="invite-section">En attente</span>
          {pending.map((p) => (
            <div key={p.id} className="invite-person">
              <Avatar member={{ id: p.email, name: p.email, color: '#8A90A2' } as never} size={32} />
              <span className="pop-grow">
                <strong>{p.email}</strong>
                <span className="muted">{ROLES[p.role].label} · invitation envoyée</span>
              </span>
              <button className="link-btn" onClick={() => void cancel(p)}>Annuler</button>
            </div>
          ))}
        </div>
      )}

      <div className="invite-linkbox">
        <span className="invite-section">Ou partage un lien</span>
        <div className="invite-link-row">
          <code>{link ? inviteUrl(link.code).replace(/^https?:\/\//, '') : 'Création…'}</code>
          <button className={`btn soft${copied ? ' ok' : ''}`} disabled={!link} onClick={() => void copy()}>
            {copied ? <><Icon name="check" size={16} /> Copié</> : 'Copier'}
          </button>
        </div>
        <div className="invite-link-opts">
          <RoleSelect value={linkRole} onChange={setLinkRole} label="Rôle via le lien" />
          <label className="role-select">
            <span className="sr-only">Validité du lien</span>
            <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
              <option value={1}>1 jour</option>
              <option value={7}>7 jours</option>
              <option value={30}>30 jours</option>
            </select>
            <Icon name="chevron" size={14} />
          </label>
          <button className="link-btn" style={{ marginLeft: 'auto' }} onClick={() => void share()}>Partager…</button>
        </div>
      </div>

      {invites.length > 0 && (
        <details className="invite-active">
          <summary>{invites.length} lien{invites.length > 1 ? 's' : ''} actif{invites.length > 1 ? 's' : ''}</summary>
          {invites.map((inv) => (
            <div key={inv.id} className="invite-row">
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
