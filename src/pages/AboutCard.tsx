import { useState } from 'react'
import { useToast } from '../components/Toast'
import { LEGAL_PATHS } from '../lib/legal'
import { openExternal, SITE_URL } from '../lib/links'
import { APP_VERSION, checkNow, IS_DESKTOP, RELEASES } from '../lib/updates'

const LEGAL = [
  { label: "Conditions d'utilisation", path: LEGAL_PATHS.cgu },
  { label: 'Conditions de vente', path: LEGAL_PATHS.cgv },
  { label: 'Confidentialité', path: LEGAL_PATHS.confidentialite },
  { label: 'Cookies', path: LEGAL_PATHS.cookies },
  { label: 'Mentions légales', path: LEGAL_PATHS.mentions },
]

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

export function AboutCard() {
  const toast = useToast()
  const [checking, setChecking] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? RELEASES : RELEASES.slice(0, 1)

  async function check() {
    setChecking(true)
    try {
      if (!(await checkNow())) toast('Tu as déjà la dernière version')
    } catch {
      toast('Impossible de vérifier pour le moment')
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="card appear appear-3" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2>À propos</h2>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>
            Kollab <strong style={{ color: 'var(--text)' }}>{APP_VERSION}</strong> · {IS_DESKTOP ? 'appli bureau' : 'version web'}
          </p>
        </div>
        <button className="btn soft small" disabled={checking} onClick={() => void check()}>
          {checking ? 'Recherche…' : 'Rechercher une mise à jour'}
        </button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Historique des versions</span>
        {shown.map((r) => (
          <article key={r.version} className="release">
            <header>
              <span className="tag feature">{r.version}</span>
              <strong>{r.title}</strong>
              <span className="muted" style={{ marginLeft: 'auto', fontSize: 13 }}>{formatDate(r.date)}</span>
            </header>
            <ul>{r.items.map((it) => <li key={it}>{it}</li>)}</ul>
          </article>
        ))}
        {RELEASES.length > 1 && (
          <button className="link-btn" style={{ alignSelf: 'flex-start', fontSize: 14 }} onClick={() => setShowAll(!showAll)}>
            {showAll ? 'Masquer les anciennes versions' : `Voir les ${RELEASES.length - 1} versions précédentes`}
          </button>
        )}
      </div>

      {SITE_URL && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 14 }}>
          {LEGAL.map((l) => (
            <button key={l.path} className="link-btn" onClick={() => void openExternal(SITE_URL + l.path)}>{l.label}</button>
          ))}
        </div>
      )}
    </section>
  )
}
