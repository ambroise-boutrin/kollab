import { useState, type FormEvent } from 'react'
import { normalizeRepo, PRESETS, type Preset } from '../lib/presets'
import { useStore } from '../lib/store'

const KIND_COLOR = { feature: 'var(--accent)', bug: 'var(--danger)', research: 'var(--ok)' } as const

/** Vignette : un mini tableau aux couleurs du modèle. */
function PresetThumb({ preset }: { preset: Preset }) {
  const tasks = preset.setup.tasks ?? []
  return (
    <span className="preset-thumb" aria-hidden="true">
      <span className="thumb-win">
        <span className="thumb-cols">
          <span className="thumb-col">
            {tasks.slice(0, 3).map((t, i) => <i key={i} style={{ borderLeftColor: KIND_COLOR[t.kind] }} />)}
            {!tasks.length && <i className="ghost" />}
          </span>
          <span className="thumb-col">{tasks.length > 3 && <i style={{ borderLeftColor: KIND_COLOR[tasks[3].kind] }} />}</span>
          <span className="thumb-col" />
        </span>
        <span className="thumb-chans">{(preset.setup.channels ?? []).slice(0, 3).map((c) => <b key={c}>#{c}</b>)}</span>
      </span>
    </span>
  )
}

/** Ce que le modèle crée : salons et premières tâches. */
function PresetPreview({ preset }: { preset: Preset }) {
  const tasks = preset.setup.tasks ?? []
  return (
    <aside className="preset-preview" style={{ ['--preset' as string]: preset.color }} aria-live="polite">
      <span className="preview-title">{preset.name}</span>
      <span className="preview-label">Salons</span>
      <span className="preview-chans">{(preset.setup.channels ?? []).map((c) => <b key={c}>#{c}</b>)}</span>
      <span className="preview-label">{tasks.length ? `${tasks.length} premières tâches` : 'Aucune tâche'}</span>
      <ul className="preview-tasks">
        {tasks.map((t) => (
          <li key={t.title}><i style={{ background: KIND_COLOR[t.kind] }} />{t.title}{t.points ? <small>{t.points} pts</small> : null}</li>
        ))}
      </ul>
    </aside>
  )
}

export type ProjectOutcome = { id: string; how: 'created' | 'joined' }

/** Créer un projet à partir d'un modèle, ou en rejoindre un avec un code. */
export function ProjectForm({ onDone, initialCode = '' }: { onDone: (r: ProjectOutcome) => void | Promise<void>; initialCode?: string }) {
  const { backend } = useStore()
  const [tab, setTab] = useState<'create' | 'join'>(initialCode ? 'join' : 'create')
  const [name, setName] = useState('')
  const [preset, setPreset] = useState<Preset['id']>('scrum')
  const chosen = PRESETS.find((p) => p.id === preset) ?? PRESETS[0]
  const [repo, setRepo] = useState('')
  const [code, setCode] = useState(initialCode)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<ProjectOutcome>) {
    setError(null)
    setBusy(true)
    try {
      await onDone(await fn())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Action impossible')
    } finally {
      setBusy(false)
    }
  }

  function create(e: FormEvent) {
    e.preventDefault()
    const repoUrl = normalizeRepo(repo)
    if (repo.trim() && !repoUrl) return setError('Dépôt GitHub : écris « compte/projet » ou colle son adresse')
    void run(async () => ({ id: await backend.createGroup(name.trim() || 'Mon projet', { ...chosen.setup, repoUrl }), how: 'created' }))
  }

  function join(e: FormEvent) {
    e.preventDefault()
    void run(async () => ({ id: await backend.joinGroup(code.trim()), how: 'joined' }))
  }

  return (
    <div className="project-form">
      <div className="tabs-seg" role="tablist" aria-label="Créer ou rejoindre">
        <button role="tab" aria-selected={tab === 'create'} onClick={() => setTab('create')}>Créer un projet</button>
        <button role="tab" aria-selected={tab === 'join'} onClick={() => setTab('join')}>Rejoindre avec un code</button>
      </div>

      {tab === 'create' ? (
        <form onSubmit={create} className="stack appear">
          <label className="field">
            Nom du projet
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Projet L3, Appli mobile" maxLength={80} autoFocus />
          </label>
          <div className="field">
            Modèle
            <div className="presets-wrap">
              <div className="presets" role="radiogroup" aria-label="Modèle de projet">
                {PRESETS.map((p) => (
                  <button type="button" key={p.id} role="radio" aria-checked={preset === p.id} className="preset" style={{ ['--preset' as string]: p.color }} onClick={() => setPreset(p.id)}>
                    <PresetThumb preset={p} />
                    <strong>{p.name}</strong>
                    <span className="muted">{p.help}</span>
                  </button>
                ))}
              </div>
              <PresetPreview preset={chosen} />
            </div>
          </div>
          <label className="field">
            Dépôt GitHub <span className="field-help">facultatif, ex. compte/projet</span>
            <input className="input" value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="mon-equipe/mon-projet" autoComplete="off" />
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Création…' : 'Créer le projet'}</button>
        </form>
      ) : (
        <form onSubmit={join} className="stack appear">
          <label className="field">
            Code ou lien d'invitation
            <input
              className="input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/^.*[?&]invitation=/, ''))}
              placeholder="ex. 4F9A2C7B1D"
              autoFocus
            />
            <span className="field-help">Demande-le à un admin du projet : il le trouve dans Équipe › Inviter.</span>
          </label>
          {error && <p role="alert" className="form-error">{error}</p>}
          <button className="btn" disabled={busy || !code.trim()}>{busy ? 'Connexion…' : 'Rejoindre le projet'}</button>
        </form>
      )}
    </div>
  )
}
