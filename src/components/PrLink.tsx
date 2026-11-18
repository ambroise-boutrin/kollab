import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { checkRuns, getPull, ghToken, listPulls, parsePrUrl, projectRepo, summarize, type Pull } from '../lib/github'
import { useStore } from '../lib/store'
import { useAsync } from '../lib/useAsync'
import { Icon } from './Icon'

/** État lisible d'une PR. */
export function prState(p: Pull): { label: string; cls: string } {
  if (p.merged) return { label: 'Fusionnée', cls: 'merged' }
  if (p.state === 'closed') return { label: 'Fermée', cls: 'closed' }
  if (p.draft) return { label: 'Brouillon', cls: 'draft' }
  return { label: 'Ouverte', cls: 'open' }
}

/** La PR liée à une tâche, avec son vrai état et ses checks. */
export function PrStatus({ url, onMerged }: { url: string; onMerged?: () => void }) {
  const ref = parsePrUrl(url)
  const pr = useAsync(ref ? () => getPull(ref, ref.number) : null, [url], ghToken() ? 60000 : 0)
  const checks = useAsync(pr.data ? () => checkRuns(ref!, pr.data!.sha) : null, [pr.data?.sha], ghToken() ? 60000 : 0)
  const merged = !!pr.data?.merged
  useEffect(() => {
    if (merged) onMerged?.()
  }, [merged]) // eslint-disable-line react-hooks/exhaustive-deps
  if (!ref) return null
  if (pr.error) return <p className="hint">{pr.error}</p>
  if (!pr.data) return <p className="hint">Chargement de la PR…</p>
  const st = prState(pr.data)
  const sum = checks.data ? summarize(checks.data) : null
  return (
    <div className="pr-status">
      <span className={`pr-state ${st.cls}`}>{st.label}</span>
      <Link to={`/revues?pr=${ref.number}`} className="pr-status-title">#{ref.number} {pr.data.title}</Link>
      {sum && sum.total > 0 && (
        <span className={`pr-checks${sum.failed ? ' bad' : sum.running ? ' wait' : ' good'}`}>
          {sum.failed ? `${sum.failed} échec${sum.failed > 1 ? 's' : ''}` : sum.running ? 'Tests en cours' : `Tests OK ${sum.passed}/${sum.total}`}
        </span>
      )}
    </div>
  )
}

/** Choisir la PR d'une tâche dans la liste des PR du dépôt du projet. */
export function PrPicker({ value, onChange, onMerged }: { value: string | null; onChange: (url: string | null) => void; onMerged?: () => void }) {
  const { workspace } = useStore()
  const repo = projectRepo(workspace)
  const [open, setOpen] = useState(false)
  const [closed, setClosed] = useState(false)
  const [q, setQ] = useState('')
  const pulls = useAsync(open && repo ? () => listPulls(repo, closed ? 'all' : 'open') : null, [open, closed, repo?.owner, repo?.repo])
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (pulls.data ?? []).filter((p) => !s || p.title.toLowerCase().includes(s) || String(p.number).includes(s))
  }, [pulls.data, q])

  if (!repo) {
    return <p className="hint">Aucun dépôt relié. <Link to="/projet#general">Relier un dépôt</Link></p>
  }

  return (
    <div className="pr-picker">
      {value ? (
        <div className="pr-picked">
          <PrStatus url={value} onMerged={onMerged} />
          <button type="button" className="icon-btn" aria-label="Délier la PR" onClick={() => onChange(null)}><Icon name="close" size={16} /></button>
        </div>
      ) : (
        !open && <button type="button" className="btn soft small" style={{ alignSelf: 'flex-start' }} onClick={() => setOpen(true)}>Choisir une PR</button>
      )}
      {open && (
        <div className="pr-list">
          <div className="row-between" style={{ flexWrap: 'nowrap' }}>
            <input className="input" autoFocus placeholder={`PR de ${repo.owner}/${repo.repo}`} value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une PR" />
            <button type="button" className="icon-btn" aria-label="Fermer" onClick={() => setOpen(false)}><Icon name="close" size={16} /></button>
          </div>
          <label className="check-row"><input type="checkbox" checked={closed} onChange={(e) => setClosed(e.target.checked)} />Inclure les PR fermées</label>
          {pulls.loading && <p className="hint">Chargement…</p>}
          {pulls.error && <p className="hint">{pulls.error}</p>}
          {pulls.data && shown.length === 0 && <p className="hint">Aucune PR.</p>}
          <ul>
            {shown.map((p) => {
              const st = prState(p)
              return (
                <li key={p.number}>
                  <button type="button" onClick={() => { onChange(p.url); setOpen(false) }}>
                    <span className={`pr-state ${st.cls}`}>{st.label}</span>
                    <span className="pr-list-title">#{p.number} {p.title}</span>
                    <small>{p.author}</small>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
