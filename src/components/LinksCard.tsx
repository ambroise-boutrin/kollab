import { useState, type FormEvent } from 'react'
import { useStore, useWorkspace } from '../lib/store'
import { Icon } from './Icon'

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

/** Liste des liens du projet ; « + » ouvre une ligne où l'on colle une adresse. */
export function LinksCard() {
  const ws = useWorkspace()
  const { backend, reload } = useStore()
  const [adding, setAdding] = useState(false)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  async function add(e: FormEvent) {
    e.preventDefault()
    const v = value.trim()
    const url = /^https?:\/\//i.test(v) ? v : `https://${v}`
    if (!v || !/^https?:\/\/[^\s.]+\.[^\s]+$/i.test(url)) return setError(true)
    await backend.addLink(titleFromUrl(url), url)
    setValue('')
    setAdding(false)
    await reload()
  }

  return (
    <section className="card appear appear-3 links-card">
      <div className="links-head">
        <h2>Liens</h2>
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
              <span className="link-mark" aria-hidden="true">{(l.title.trim()[0] ?? '·').toUpperCase()}</span>
              <span className="link-text">
                <span>{l.title}</span>
                <small>{host(l.url)}</small>
              </span>
            </a>
            <button className="icon-btn link-del" aria-label={`Retirer ${l.title}`} onClick={() => void backend.removeLink(l.id).then(reload)}>
              <Icon name="close" size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}
