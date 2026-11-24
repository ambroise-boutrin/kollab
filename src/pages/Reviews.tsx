import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useGhLinked } from '../lib/useGhLinked'
import { Link, useSearchParams } from 'react-router-dom'
import { FileDiff } from '../components/Diff'
import { Icon } from '../components/Icon'
import { Markdown } from '../components/Markdown'
import { prState } from '../components/PrLink'
import { useToast } from '../components/Toast'
import {
  annotations, checkRuns, getPull, ghToken, issueComments, listPulls, postComment, projectRepo, pullFiles, rerunWorkflow, reviewComments,
  summarize, workflowRuns, type CheckRun, type Pull, type Repo,
} from '../lib/github'
import { openExternal } from '../lib/links'
import { useStore, useWorkspace } from '../lib/store'
import { useAsync } from '../lib/useAsync'

/** Avec GitHub connecté, la page se tient à jour toute seule (30 s). Sans, on garde le quota public. */
const LIVE = ghToken() ? 30000 : 0

type Tab = 'fichiers' | 'discussion' | 'tests'

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000)
  if (min < 60) return `il y a ${Math.max(min, 1)} min`
  const h = Math.round(min / 60)
  if (h < 48) return `il y a ${h} h`
  return `il y a ${Math.round(h / 24)} j`
}

function checkLabel(c: CheckRun): { label: string; cls: string } {
  if (c.status !== 'completed') return { label: 'En cours', cls: 'wait' }
  if (c.conclusion === 'success') return { label: 'Réussi', cls: 'good' }
  if (c.conclusion === 'skipped' || c.conclusion === 'neutral') return { label: 'Ignoré', cls: 'wait' }
  return { label: 'Échec', cls: 'bad' }
}

/** Revues de code : PR du dépôt du projet, diff coloré, discussion, tests et relance de la CI. */
export function Reviews() {
  const linked = useGhLinked()
  const ws = useWorkspace()
  const { backend } = useStore()
  const toast = useToast()
  const repo = projectRepo(ws)
  const [params, setParams] = useSearchParams()
  const [state, setState] = useState<'open' | 'closed'>('open')
  const pulls = useAsync(repo ? () => listPulls(repo, state) : null, [repo?.owner, repo?.repo, state, linked], LIVE)
  const wanted = Number(params.get('pr')) || null
  const selected = wanted || pulls.data?.[0]?.number || null
  const inList = pulls.data?.find((p) => p.number === selected) ?? null
  // Lien vers une PR fusionnée ou fermée (depuis une tâche) : on la charge à part, et on montre l'onglet Fermées.
  const single = useAsync(repo && wanted && pulls.data && !inList ? () => getPull(repo, wanted) : null, [repo?.owner, repo?.repo, wanted, !!pulls.data, !!inList])
  const pr = inList ?? single.data ?? null
  useEffect(() => {
    if (single.data && single.data.state === 'closed' && state === 'open') setState('closed')
  }, [single.data, state])

  async function connect() {
    try {
      await backend.connectGitHub()
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Connexion impossible')
    }
  }

  if (!repo) {
    return (
      <div className="page settings">
        <h1>Revues de code</h1>
        <div className="card"><p className="hint">Aucun dépôt relié. <Link to="/projet#github">Relier un dépôt GitHub</Link></p></div>
      </div>
    )
  }

  return (
    <div className="page reviews">
      <header className="row-between">
        <div>
          <h1>Revues de code</h1>
          <p className="muted" style={{ margin: '2px 0 0', fontSize: 14 }}>{repo.owner}/{repo.repo}</p>
        </div>
        {!linked && <button className="btn dark small" onClick={() => void connect()}>Connecter GitHub</button>}
      </header>

      <div className="reviews-grid">
        <aside className="card pr-side">
          <div className="tabs-seg" role="tablist">
            <button role="tab" aria-selected={state === 'open'} onClick={() => setState('open')}>Ouvertes</button>
            <button role="tab" aria-selected={state === 'closed'} onClick={() => setState('closed')}>Fermées</button>
          </div>
          {pulls.loading && !pulls.data && (
            <ul className="pr-nav skeleton-list" aria-label="Chargement des PR">
              {[0, 1, 2].map((i) => <li key={i} className="skeleton-row" style={{ animationDelay: `${i * 0.12}s` }}><i /><i /></li>)}
            </ul>
          )}
          {pulls.error && <p className="hint">{pulls.error}</p>}
          {pulls.data?.length === 0 && <p className="hint">Aucune PR.</p>}
          <ul className="pr-nav">
            {pulls.data?.map((p) => {
              const st = prState(p)
              const linked = ws.tasks.find((t) => t.prUrl === p.url)
              return (
                <li key={p.number}>
                  <button className={p.number === selected ? 'active' : undefined} onClick={() => setParams({ pr: String(p.number) })}>
                    <span className="pr-nav-top"><span className={`pr-state ${st.cls}`}>{st.label}</span><small>#{p.number} · {ago(p.updatedAt)}</small></span>
                    <span className="pr-nav-title">{p.title}</span>
                    <small>{p.author}{linked ? ` · tâche « ${linked.title} »` : ''}</small>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>
        {pr ? <PrDetail key={pr.number} repo={repo} pr={pr} onReload={pulls.reload} /> : (pulls.loading || single.loading) && !pulls.error ? (
          <div className="card pr-wait" aria-hidden="true"><i /><i /><i /><i /></div>
        ) : (
          <div className="card reviews-empty">
            <span className="chat-empty-ico"><Icon name="pr" size={26} /></span>
            <strong>{pulls.error ? 'PR indisponibles pour le moment' : state === 'open' ? 'Aucune PR à relire' : 'Aucune PR fermée'}</strong>
            <span className="muted">{pulls.error ? 'Réessaie dans un instant.' : pulls.data?.length ? 'Choisis une PR à gauche.' : 'Les PR du dépôt arriveront ici dès leur ouverture sur GitHub.'}</span>
          </div>
        )}
      </div>
    </div>
  )
}

function PrDetail({ repo, pr, onReload }: { repo: Repo; pr: Pull; onReload: () => void }) {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('fichiers')
  const files = useAsync(() => pullFiles(repo, pr.number), [pr.number])
  const rc = useAsync(() => reviewComments(repo, pr.number), [pr.number], LIVE)
  const ic = useAsync(() => issueComments(repo, pr.number), [pr.number], LIVE)
  const checks = useAsync(() => checkRuns(repo, pr.sha), [pr.sha], LIVE)
  const runs = useAsync(() => workflowRuns(repo, pr.sha), [pr.sha], LIVE)
  const sum = checks.data ? summarize(checks.data) : null
  const st = prState(pr)
  const adds = files.data?.reduce((n, f) => n + f.additions, 0) ?? 0
  const dels = files.data?.reduce((n, f) => n + f.deletions, 0) ?? 0

  async function rerun(failedOnly: boolean) {
    try {
      const list = runs.data ?? []
      const targets = failedOnly ? list.filter((r) => r.conclusion === 'failure') : list
      if (!targets.length) return toast(failedOnly ? 'Aucun pipeline en échec' : 'Aucun pipeline pour ce commit')
      await Promise.all(targets.map((r) => rerunWorkflow(repo, r.id, failedOnly)))
      toast('Pipeline relancé')
      setTimeout(() => { checks.reload(); runs.reload() }, 3000)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Relance impossible')
    }
  }

  return (
    <section className="card pr-detail">
      <div className="pr-head">
        <div style={{ minWidth: 0 }}>
          <h2>{pr.title} <span className="muted">#{pr.number}</span></h2>
          <p className="hint">
            <span className={`pr-state ${st.cls}`}>{st.label}</span> {pr.author} · {pr.branch}
            {files.data && <> · <span className="add-n">+{adds}</span> <span className="del-n">−{dels}</span></>}
          </p>
        </div>
        <button className="btn soft small" onClick={() => void openExternal(pr.url)}>Ouvrir sur GitHub</button>
      </div>

      <div className="tabs-seg" role="tablist">
        <button role="tab" aria-selected={tab === 'fichiers'} onClick={() => setTab('fichiers')}>Fichiers {files.data ? files.data.length : ''}</button>
        <button role="tab" aria-selected={tab === 'discussion'} onClick={() => setTab('discussion')}>Discussion {ic.data && rc.data ? ic.data.length + rc.data.length : ''}</button>
        <button role="tab" aria-selected={tab === 'tests'} onClick={() => setTab('tests')}>
          Tests {sum && sum.total > 0 ? (sum.failed ? `· ${sum.failed} échec${sum.failed > 1 ? 's' : ''}` : sum.running ? '· en cours' : '· OK') : ''}
        </button>
      </div>

      {tab === 'fichiers' && (
        <div className="stack">
          {files.loading && <p className="hint">Chargement…</p>}
          {files.error && <p className="hint">{files.error}</p>}
          {files.data?.map((f) => (
            <details key={f.filename} className="file" open={files.data!.length <= 8}>
              <summary>
                <span className="file-name">{f.filename}</span>
                <span className="add-n">+{f.additions}</span> <span className="del-n">−{f.deletions}</span>
              </summary>
              <FileDiff patch={f.patch} comments={(rc.data ?? []).filter((c) => c.path === f.filename)} />
            </details>
          ))}
        </div>
      )}

      {tab === 'discussion' && <Discussion repo={repo} pr={pr} body={pr.body} comments={ic} reviewCount={rc.data?.length ?? 0} onPosted={onReload} />}

      {tab === 'tests' && (
        <div className="stack">
          <div className="row-between">
            <span className="hint">
              {sum ? (sum.total ? `${sum.passed} réussi${sum.passed > 1 ? 's' : ''} · ${sum.failed} en échec · ${sum.running} en cours` : 'Aucun test pour ce commit.') : 'Chargement…'}
            </span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn soft small" onClick={() => { checks.reload(); runs.reload() }}>Actualiser</button>
              <button className="btn soft small" onClick={() => void rerun(true)}>Relancer les échecs</button>
              <button className="btn small" onClick={() => void rerun(false)}>Relancer le pipeline</button>
            </div>
          </div>
          {checks.error && <p className="hint">{checks.error}</p>}
          {checks.data?.map((c) => <CheckRow key={c.id} repo={repo} check={c} />)}
        </div>
      )}
    </section>
  )
}

function CheckRow({ repo, check }: { repo: Repo; check: CheckRun }) {
  const [open, setOpen] = useState(false)
  const st = checkLabel(check)
  const notes = useAsync(open && check.output.annotations_count ? () => annotations(repo, check.id) : null, [open])
  const secs = check.started_at && check.completed_at ? Math.round((new Date(check.completed_at).getTime() - new Date(check.started_at).getTime()) / 1000) : null
  return (
    <div className={`check ${st.cls}`}>
      <button className="check-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className={`check-mark ${st.cls}`} aria-hidden="true">{st.cls === 'good' ? <Icon name="check" size={14} /> : st.cls === 'bad' ? <Icon name="close" size={14} /> : null}</span>
        <span className="check-name">{check.name}</span>
        <small>{st.label}{secs != null ? ` · ${secs} s` : ''}</small>
      </button>
      {open && (
        <div className="check-body">
          {check.output.title && <strong>{check.output.title}</strong>}
          {check.output.summary && <Markdown text={check.output.summary} />}
          {notes.data?.map((a, i) => (
            <div key={i} className={`annot ${a.annotation_level}`}>
              <code>{a.path}:{a.start_line}</code>
              <span>{a.title ? `${a.title} : ` : ''}{a.message}</span>
            </div>
          ))}
          {!check.output.summary && !check.output.annotations_count && <p className="hint">Pas de détail.</p>}
          <a href={check.html_url} target="_blank" rel="noreferrer" className="hint">Journal complet</a>
        </div>
      )}
    </div>
  )
}

function Discussion({ repo, pr, body, comments, reviewCount, onPosted }: {
  repo: Repo; pr: Pull; body: string; comments: ReturnType<typeof useAsync<Awaited<ReturnType<typeof issueComments>>>>; reviewCount: number; onPosted: () => void
}) {
  const toast = useToast()
  const [text, setText] = useState('')
  const list = useMemo(() => comments.data ?? [], [comments.data])

  async function send(e: FormEvent) {
    e.preventDefault()
    if (!text.trim()) return
    try {
      const c = await postComment(repo, pr.number, text.trim())
      comments.setData([...list, c])
      setText('')
      onPosted()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Envoi impossible')
    }
  }

  return (
    <div className="stack">
      {body.trim() && (
        <div className="comment first">
          <img src={pr.avatar} alt="" width={28} height={28} />
          <div><strong>{pr.author}</strong><Markdown text={body} /></div>
        </div>
      )}
      {reviewCount > 0 && <p className="hint">{reviewCount} commentaire{reviewCount > 1 ? 's' : ''} sur le code, dans l'onglet Fichiers.</p>}
      {list.map((c) => (
        <div key={c.id} className="comment">
          <img src={c.user.avatar_url} alt="" width={28} height={28} />
          <div><strong>{c.user.login}</strong> <small className="muted">{ago(c.created_at)}</small><Markdown text={c.body} /></div>
        </div>
      ))}
      <form onSubmit={send} className="stack" style={{ gap: 8 }}>
        <textarea className="input" rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Commenter la PR (Markdown)" aria-label="Commentaire" />
        <button className="btn small" style={{ alignSelf: 'flex-start' }} disabled={!text.trim()}>Commenter</button>
      </form>
    </div>
  )
}
