import { useState, type FormEvent } from 'react'
import { useStore, useWorkspace } from '../lib/store'
import { Icon } from './Icon'
import { useToast } from './Toast'
import { Modal } from './Modal'
import type { LinkItem } from '../lib/types'

const KNOWN: [RegExp, string][] = [
  [/docs\.google\.com\/document/, 'Google Docs'],
  [/docs\.google\.com\/spreadsheets/, 'Google Sheets'],
  [/docs\.google\.com\/presentation/, 'Google Slides'],
  [/drive\.google\.com/, 'Google Drive'],
  [/figma\.com/, 'Figma'],
  [/notion\.(so|site)/, 'Notion'],
  [/trello\.com/, 'Trello'],
  [/vercel\.app|vercel\.com/, 'Vercel'],
]

/** Titre déduit de l'adresse : « compte/dépôt » pour GitHub, le service connu, sinon le domaine. */
export function titleFromUrl(raw: string): string {
  try {
    const u = new URL(raw)
    if (u.hostname.endsWith('github.com')) {
      const [owner, repo] = u.pathname.split('/').filter(Boolean)
      if (owner && repo) return `${owner}/${repo}`
    }
    for (const [re, name] of KNOWN) if (re.test(u.hostname + u.pathname)) return name
    return u.hostname.replace(/^www\./, '')
  } catch {
    return raw
  }
}

const host = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/** Icône du site (favicon), avec l'initiale si elle ne charge pas. */
function Favicon({ url, title }: { url: string; title: string }) {
  const h = host(url)
  const [failed, setFailed] = useState(false)
  if (!h || failed) return <span className="link-mark" aria-hidden="true">{(title.trim()[0] ?? '·').toUpperCase()}</span>
  return (
    <span className="link-mark fav" aria-hidden="true">
      <img src={`https://www.google.com/s2/favicons?domain=${encodeURIComponent(h)}&sz=64`} alt="" width={18} height={18} loading="lazy" onError={() => setFailed(true)} onLoad={(e) => (e.currentTarget.naturalWidth <= 16 ? setFailed(true) : undefined)} />
    </span>
  )
}

const normalize = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`)
const validUrl = (url: string) => /^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)

/** Fenêtre pour modifier ou retirer un lien. Retirer demande une confirmation. */
function LinkDialog({ link, startConfirm, onClose }: { link: LinkItem; startConfirm: boolean; onClose: () => void }) {
  const { backend, reload } = useStore()
  const toast = useToast()
  const [title, setTitle] = useState(link.title)
  const [url, setUrl] = useState(link.url)
  const [confirm, setConfirm] = useState(startConfirm)
  const [error, setError] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    const u = normalize(url.trim())
    if (!validUrl(u)) return setError(true)
    setBusy(true)
    try {
      await backend.updateLink(link.id, { title: title.trim() || titleFromUrl(u), url: u })
      await reload()
      onClose()
    } catch {
      toast('Modification impossible')
      setBusy(false)
    }
  }

  async function remove() {
    setBusy(true)
    try {
      await backend.removeLink(link.id)
      await reload()
      onClose()
      toast('Lien retiré', { label: 'Annuler', run: async () => { await backend.restoreItem('link', link.id); await reload() } })
    } catch {
      toast('Retrait impossible')
      setBusy(false)
    }
  }

  if (confirm)
    return (
      <Modal
        title="Retirer ce lien ?"
        onClose={onClose}
        footer={
          <>
            <button className="btn soft" onClick={() => (startConfirm ? onClose() : setConfirm(false))}>Garder</button>
            <button className="btn danger" disabled={busy} onClick={() => void remove()}>Retirer</button>
          </>
        }
      >
        <div className="link-confirm">
          <Favicon url={link.url} title={link.title} />
          <span className="link-text"><span>{link.title}</span><small>{host(link.url)}</small></span>
        </div>
        <p className="hint">Il ira dans la corbeille du projet.</p>
      </Modal>
    )

  return (
    <Modal title="Modifier le lien" onClose={onClose}>
      <form onSubmit={save} className="link-form">
        <label className="field">
          <span>Nom</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={titleFromUrl(normalize(url))} maxLength={120} />
        </label>
        <label className="field">
          <span>Adresse</span>
          <input className={`input${error ? ' invalid' : ''}`} value={url} onChange={(e) => { setUrl(e.target.value); setError(false) }} inputMode="url" />
        </label>
        <div className="link-form-foot">
          <button type="button" className="btn soft link-remove" onClick={() => setConfirm(true)}><Icon name="trash" size={16} /> Retirer</button>
          <button className="btn" disabled={busy}>Enregistrer</button>
        </div>
      </form>
    </Modal>
  )
}

/** Liste des liens du projet ; « + » ouvre une ligne où l'on colle une adresse. */
export function LinksCard() {
  const ws = useWorkspace()
  const { backend, reload } = useStore()
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [open, setOpen] = useState<{ link: LinkItem; confirm: boolean } | null>(null)

  async function add(e: FormEvent) {
    e.preventDefault()
    const v = value.trim()
    const url = normalize(v)
    if (!v || !validUrl(url)) return setError(true)
    await backend.addLink(titleFromUrl(url), url)
    setValue('')
    setAdding(false)
    await reload()
  }

  return (
    <section className="card appear appear-3 links-card">
      <div className="links-head">
        <h2>Liens importants</h2>
        <button className="icon-btn" aria-label="Ajouter un lien" aria-expanded={adding} onClick={() => setAdding((a) => !a)}>
          <Icon name="plus" size={18} />
        </button>
      </div>
      {adding && (
        <form onSubmit={add} className="link-add">
          <input
            className={`input${error ? ' invalid' : ''}`}
            autoFocus
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(false) }}
            onKeyDown={(e) => e.key === 'Escape' && setAdding(false)}
            placeholder="Colle une adresse puis Entrée"
            aria-label="Adresse du lien"
            inputMode="url"
          />
        </form>
      )}
      {ws.links.length === 0 && !adding && <p className="hint">Aucun lien.</p>}
      <ul className="links">
        {ws.links.map((l) => (
          <li key={l.id}>
            <a href={l.url} target="_blank" rel="noreferrer">
              <Favicon url={l.url} title={l.title} />
              <span className="link-text">
                <span>{l.title}</span>
                <small>{host(l.url)}</small>
              </span>
            </a>
            <button className="icon-btn link-del" aria-label={`Modifier ${l.title}`} onClick={() => setOpen({ link: l, confirm: false })}>
              <Icon name="edit" size={15} />
            </button>
            <button className="icon-btn link-del" aria-label={`Retirer ${l.title}`} onClick={() => setOpen({ link: l, confirm: true })}>
              <Icon name="trash" size={15} />
            </button>
          </li>
        ))}
      </ul>
      {open && <LinkDialog key={open.link.id} link={open.link} startConfirm={open.confirm} onClose={() => setOpen(null)} />}
    </section>
  )
}
