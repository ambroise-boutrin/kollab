import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { branchName, checkRuns, createTaskPr, getPull, ghToken, listBranches, listPulls, parsePrUrl, prFromBranch, projectRepo, summarize, typedBranch, type Pull } from '../lib/github'
import { useStore } from '../lib/store'
import { useAsync } from '../lib/useAsync'
import { Icon } from './Icon'
import { Modal, touchScreen } from './Modal'
import { useToast } from './Toast'

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

/**
 * Branche et PR d'une tâche : liste déroulante des branches du dépôt du projet.
 * Choisir une branche ouvre sa PR (ou la crée) ; « Nouvelle branche » crée feature/… ou fix/… et la PR.
 */
export function PrPicker({ value, onChange, onMerged, task, card = false }: {
  /** Grand bouton « Créer la branche et la PR » (fiche tâche sur téléphone). */
  card?: boolean
  value: string | null
  onChange: (url: string | null) => void
  onMerged?: () => void
  task: { title: string; kind: string; description: string }
}) {
  const { workspace, backend } = useStore()
  const toast = useToast()
  const repo = projectRepo(workspace)
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  const branches = useAsync(open && repo ? () => listBranches(repo) : null, [open, repo?.owner, repo?.repo])
  const pulls = useAsync(open && repo ? () => listPulls(repo, 'open') : null, [open, repo?.owner, repo?.repo])
  const prByBranch = useMemo(() => new Map((pulls.data ?? []).map((p) => [p.branch, p])), [pulls.data])
  const fresh = branchName(task.kind, task.title)
  const typed = typedBranch(q, task.kind)
  const typedFree = !!typed && !(branches.data ?? []).some((b) => b.name === typed || b.name === q.trim())
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (branches.data ?? []).filter((b) => !s || b.name.toLowerCase().includes(s))
      .sort((a, b) => Number(prByBranch.has(b.name)) - Number(prByBranch.has(a.name)))
  }, [branches.data, q, prByBranch])

  if (!repo) {
    if (card) {
      return (
        <Link to="/projet#github" className="pr-card-btn">
          <span className="pr-card-icon"><Icon name="branch" size={20} /></span>
          <span className="pr-card-text"><b>Relier un dépôt GitHub</b><span>Pour créer la branche et la PR</span></span>
          <Icon name="chevron" size={16} />
        </Link>
      )
    }
    return <p className="hint">Aucun dépôt relié. <Link to="/projet#github">Relier un dépôt</Link></p>
  }

  async function run(key: string, fn: () => Promise<string>) {
    setBusy(key)
    try {
      onChange(await fn())
      setOpen(false)
      toast('PR liée')
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Action GitHub impossible')
    } finally {
      setBusy(null)
    }
  }

  if (value) {
    return (
      <div className="pr-picked">
        <PrStatus url={value} onMerged={onMerged} />
        <button type="button" className="icon-btn" aria-label="Délier la PR" onClick={() => onChange(null)}><Icon name="close" size={16} /></button>
      </div>
    )
  }

  const canWrite = !!ghToken()
  return (
    <div className="branch-picker" ref={ref}>
      {card ? (
        <button type="button" className="pr-card-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(true)}>
          <span className="pr-card-icon"><Icon name="branch" size={20} /></span>
          <span className="pr-card-text"><b>{canWrite ? 'Créer la branche et la PR' : 'Choisir une branche'}</b><span>{fresh}</span></span>
          <Icon name="chevron" size={16} />
        </button>
      ) : (
        <button type="button" className="select-btn" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
          <Icon name="branch" size={16} />
          <span>Choisir une branche</span>
          <Icon name="chevron" size={16} />
        </button>
      )}
      {open && (
        <Modal title={<>Branches de <span className="branch-repo">{repo.owner}/{repo.repo}</span></>} onClose={() => setOpen(false)}>
        <div className="branch-menu in-modal" role="listbox" aria-label={`Branches de ${repo.owner}/${repo.repo}`}>
          <label className="branch-search">
            <Icon name="search" size={16} />
            <input autoFocus={!touchScreen()} placeholder="Chercher ou nommer une branche" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher une branche" />
          </label>
          {canWrite && typedFree && typed && (
            <button type="button" role="option" aria-selected={false} className="branch-row new" disabled={!!busy || !task.title.trim()} onClick={() => void run('typed', () => createTaskPr(repo, task, typed))}>
              <span className="branch-plus"><Icon name="plus" size={14} /></span>
              <span className="branch-name">{busy === 'typed' ? 'Création…' : <>Créer <code>{typed}</code></>}</span>
              <span className="branch-badge">+ PR</span>
            </button>
          )}
          {canWrite ? (
            <button type="button" role="option" aria-selected={false} className="branch-row new" disabled={!!busy || !task.title.trim()} onClick={() => void run('new', () => createTaskPr(repo, task))}>
              <span className="branch-plus"><Icon name="plus" size={14} /></span>
              <span className="branch-name">{busy === 'new' ? 'Création…' : <>Nouvelle branche <code>{fresh}</code></>}</span>
              <span className="branch-badge">+ PR</span>
            </button>
          ) : (
            <button type="button" className="branch-row new" onClick={() => void backend.connectGitHub().catch((e: Error) => toast(e.message))}>
              <span className="branch-plus"><Icon name="plus" size={14} /></span>
              <span className="branch-name">Connecter GitHub pour créer des branches</span>
            </button>
          )}
          <div className="branch-list">
            {branches.loading && <p className="hint">Chargement…</p>}
            {branches.error && <p className="hint">{branches.error}</p>}
            {branches.data && shown.length === 0 && <p className="hint">Aucune branche.</p>}
            {shown.map((b) => {
              const pr = prByBranch.get(b.name)
              return (
                <button key={b.name} type="button" role="option" aria-selected={false} className="branch-row" disabled={!!busy || (!pr && !canWrite)}
                  onClick={() => void run(b.name, async () => pr?.url ?? prFromBranch(repo, b.name, task))}>
                  <Icon name="branch" size={15} />
                  <span className="branch-name">{busy === b.name ? 'Création de la PR…' : b.name}</span>
                  {pr ? <span className={`pr-state ${prState(pr).cls}`}>#{pr.number}</span> : canWrite && <span className="branch-badge">+ PR</span>}
                </button>
              )
            })}
          </div>
        </div>
        </Modal>
      )}
    </div>
  )
}
