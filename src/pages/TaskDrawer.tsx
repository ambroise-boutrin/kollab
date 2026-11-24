import { useEffect, useRef, useState, type RefObject } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PrPicker } from '../components/PrLink'
import { DueField, TaskComments } from '../components/TaskExtras'
import { Modal, usePhone } from '../components/Modal'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES, type Task, type TaskKind, type TaskStatus } from '../lib/types'

/** Charge d'un membre = points des tâches non terminées qui lui sont attribuées. */
function load(tasks: Task[], memberId: string) {
  return tasks.filter((t) => t.assigneeIds.includes(memberId) && t.status !== 'done').reduce((n, t) => n + (t.points ?? 0), 0)
}

const POINTS = [1, 2, 3, 5, 8, 13, 21]

/**
 * Fenêtre de tâche, au centre de l'écran.
 * `isNew` : rien n'est enregistré avant « Créer la tâche » (fermer = abandonner).
 */
export function TaskDrawer({ task, onClose, isNew = false }: { task: Task; onClose: () => void; isNew?: boolean }) {
  const { members, tasks, sprints } = useWorkspace()
  const { saveTask, createTask, deleteTask, backend, online, reload } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState(task)
  const openSprints = sprints.filter((sp) => sp.status !== 'done' || sp.id === draft.sprintId)
  const titleRef = useRef<HTMLTextAreaElement>(null)
  const phone = usePhone()

  // Si quelqu'un d'autre modifie la tâche pendant qu'elle est ouverte.
  useEffect(() => {
    if (!isNew) setDraft(task)
  }, [task, isNew])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  // Le texte s'enregistre tout seul pendant la frappe : rien n'est perdu si l'app se ferme.
  useEffect(() => {
    if (isNew) return
    if (draft.title === task.title && draft.description === task.description) return
    if (!draft.title.trim()) return
    const id = setTimeout(() => void saveTask(draft), 700)
    return () => clearTimeout(id)
  }, [draft.title, draft.description]) // eslint-disable-line react-hooks/exhaustive-deps

  function commit(next: Task) {
    setDraft(next)
    if (!isNew) void saveTask(next)
  }

  function toggleAssignee(memberId: string) {
    const on = draft.assigneeIds.includes(memberId)
    const next = { ...draft, assigneeIds: on ? draft.assigneeIds.filter((id) => id !== memberId) : [...draft.assigneeIds, memberId] }
    commit(next)
    if (!on && !isNew) {
      const name = members.find((m) => m.id === memberId)?.name ?? ''
      void backend.notifyDiscord({ type: 'task_assigned', taskTitle: next.title, assignee: name })
    }
  }

  function linkPr(url: string) {
    const next = { ...draft, prUrl: url || null }
    commit(next)
    if (url && !isNew) void backend.notifyDiscord({ type: 'pr_linked', taskTitle: next.title, prUrl: url })
  }

  async function create() {
    const title = draft.title.trim()
    if (!title) {
      titleRef.current?.focus()
      return
    }
    await createTask({ title, status: draft.status, kind: draft.kind, points: draft.points, description: draft.description, assigneeIds: draft.assigneeIds, prUrl: draft.prUrl, dueOn: draft.dueOn ?? null, ...(draft.sprintId !== undefined ? { sprintId: draft.sprintId } : {}) })
    for (const id of draft.assigneeIds) {
      const name = members.find((m) => m.id === id)?.name ?? ''
      void backend.notifyDiscord({ type: 'task_assigned', taskTitle: title, assignee: name })
    }
    toast('Tâche créée')
    onClose()
  }

  async function remove() {
    onClose()
    await deleteTask(task.id)
    toast('Tâche supprimée', { label: 'Annuler', run: async () => { await backend.restoreItem('task', task.id); await reload() } })
  }

  const maxLoad = Math.max(13, ...members.map((m) => load(tasks, m.id)))

  if (phone) {
    return createPortal(
      <PhoneTask draft={draft} setDraft={setDraft} commit={commit} isNew={isNew} onClose={onClose} onCreate={() => void create()} onRemove={() => void remove()} toggleAssignee={toggleAssignee} linkPr={linkPr} titleRef={titleRef} />,
      document.body,
    )
  }

  return createPortal(
    <div className="modal-back task-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal task-modal" role="dialog" aria-modal="true" aria-label={isNew ? 'Nouvelle tâche' : `Tâche : ${draft.title}`}>
        <div className="task-modal-top">
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{isNew ? 'Nouvelle tâche' : 'Tâche'}</span>
          {!isNew && (
            <button className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Mettre à la corbeille" title="Mettre à la corbeille" onClick={() => void remove()}>
              <Icon name="trash" size={18} />
            </button>
          )}
          <button className="icon-btn" style={isNew ? { marginLeft: 'auto' } : undefined} aria-label="Fermer" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <textarea
          ref={titleRef}
          className="task-title-input"
          rows={1}
          placeholder="Titre de la tâche"
          aria-label="Titre"
          value={draft.title}
          autoFocus={isNew}
          onChange={(e) => setDraft({ ...draft, title: e.target.value.replace(/\n/g, ' ') })}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (isNew) void create()
              else (e.target as HTMLTextAreaElement).blur()
            }
          }}
        />

        <div className="task-modal-grid">
          <div className="task-main">
            <div className="task-field">
              <span className="task-label">Statut</span>
              <div className="status-steps" role="radiogroup" aria-label="Statut">
                {STATUSES.map((s, i) => {
                  const cur = STATUSES.findIndex((x) => x.id === draft.status)
                  return (
                    <button key={s.id} type="button" role="radio" aria-checked={draft.status === s.id} className={`step status-${s.id}${i <= cur ? ' reached' : ''}`} onClick={() => commit({ ...draft, status: s.id })}>
                      <i aria-hidden="true" />
                      <span>{s.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="task-field">
              <span className="task-label">Type</span>
              <div className="chips" role="radiogroup" aria-label="Type">
                {(Object.entries(KINDS) as [TaskKind, string][]).map(([k, v]) => (
                  <button key={k} type="button" role="radio" aria-checked={draft.kind === k} className={`chip kind-${k}`} onClick={() => commit({ ...draft, kind: k })}>
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="task-field">
              <span className="task-label">Estimation{draft.points != null ? <b className="pts-now"> · {draft.points} point{draft.points > 1 ? 's' : ''}</b> : null}</span>
              <div className="points-scale" role="radiogroup" aria-label="Estimation en points">
                {POINTS.map((p, i) => (
                  <button key={p} type="button" role="radio" aria-checked={draft.points === p} className={`pt${draft.points != null && p <= draft.points ? ' on' : ''}`} style={{ ['--h' as string]: `${12 + i * 7}px`, ['--c' as string]: i < 3 ? 'var(--ok)' : i < 5 ? '#D98A1C' : 'var(--danger)' }} onClick={() => commit({ ...draft, points: draft.points === p ? null : p })}>
                    <i aria-hidden="true" />
                    <span>{p}</span>
                  </button>
                ))}
              </div>
            </div>

            <DueField value={draft.dueOn} sprintEnd={sprints.find((sp) => sp.id === draft.sprintId)?.endsOn} onChange={(d) => commit({ ...draft, dueOn: d })} />

            {openSprints.length > 0 && (
              <div className="task-field">
                <span className="task-label">Sprint</span>
                <div className="chips" role="radiogroup" aria-label="Sprint">
                  <button type="button" role="radio" aria-checked={!draft.sprintId} className="chip" onClick={() => commit({ ...draft, sprintId: null })}>Backlog</button>
                  {openSprints.map((sp) => (
                    <button key={sp.id} type="button" role="radio" aria-checked={draft.sprintId === sp.id} className="chip" onClick={() => commit({ ...draft, sprintId: sp.id })}>
                      {sp.name}{sp.status === 'active' ? ' · en cours' : ''}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="task-field">
              <span className="task-label">Branche et PR</span>
              <PrPicker task={draft} value={draft.prUrl} onChange={(url) => linkPr(url ?? '')} onMerged={() => draft.status !== 'done' && commit({ ...draft, status: 'done' })} />
            </div>

            <label className="task-field">
              <span className="task-label">Description</span>
              <textarea
                className="input task-desc"
                value={draft.description}
                placeholder="Ce qu'il faut faire, quand c'est fini…"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>

            {!isNew && <TaskComments task={draft} />}
          </div>

          <div className="task-side">
            <span className="task-label">Pour qui</span>
            <div className="people">
              {members.map((m) => {
                const l = load(tasks, m.id)
                const selected = draft.assigneeIds.includes(m.id)
                return (
                  <button key={m.id} type="button" className={`person${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={() => toggleAssignee(m.id)}>
                    <Avatar member={m} size={34} online={online.includes(m.id)} />
                    <span className="person-text">
                      <span className="person-name">{m.name}</span>
                      <span className="load" title={`${l} points en cours`}><span style={{ width: `${Math.min(100, (l / maxLoad) * 100)}%`, background: l >= 13 ? 'var(--danger)' : 'var(--ok)' }} /></span>
                    </span>
                    <span className={`check-box${selected ? ' on' : ''}`} aria-hidden="true">{selected && <Icon name="check" size={14} />}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {isNew && (
          <div className="task-modal-foot">
            <button className="btn soft" onClick={onClose}>Annuler</button>
            <button className="btn" onClick={() => void create()}>Créer la tâche</button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}

const KIND_COLOR: Record<TaskKind, string> = { feature: 'var(--accent)', bug: '#C2413A', research: 'var(--ok)' }
const STATUS_COLOR: Record<TaskStatus, string> = { todo: '#5B6275', doing: '#2F6FD0', review: '#D98A1C', done: 'var(--ok)' }
const NEXT: Record<TaskStatus, { to: TaskStatus; label: string }> = {
  todo: { to: 'doing', label: 'Commencer' },
  doing: { to: 'review', label: 'Envoyer en revue' },
  review: { to: 'done', label: 'Terminer' },
  done: { to: 'todo', label: 'Rouvrir' },
}

/** Fiche tâche sur téléphone, plein écran : statut en bandeau, points en barres, personnes en grand, action principale en bas. */
function PhoneTask({ draft, setDraft, commit, isNew, onClose, onCreate, onRemove, toggleAssignee, linkPr, titleRef }: {
  draft: Task
  setDraft: (t: Task) => void
  commit: (t: Task) => void
  isNew: boolean
  onClose: () => void
  onCreate: () => void
  onRemove: () => void
  toggleAssignee: (id: string) => void
  linkPr: (url: string) => void
  titleRef: RefObject<HTMLTextAreaElement | null>
}) {
  const { members, sprints } = useWorkspace()
  const { user, online } = useStore()
  const [sheet, setSheet] = useState<null | 'kind' | 'desc' | 'sprint'>(null)
  const [desc, setDesc] = useState(draft.description)
  const openSprints = sprints.filter((sp) => sp.status !== 'done' || sp.id === draft.sprintId)
  const sprint = sprints.find((sp) => sp.id === draft.sprintId)
  const people = [...members].sort((a, b) => Number(b.id === user?.id) - Number(a.id === user?.id))
  const next = NEXT[draft.status]

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [draft.title, titleRef])

  return (
    <div className="pt-screen" role="dialog" aria-modal="true" aria-label={isNew ? 'Nouvelle tâche' : `Tâche : ${draft.title}`}>
      <header className="pt-head">
        <button className="wz-text-btn accent" onClick={onClose}>{isNew ? 'Annuler' : 'Fermer'}</button>
        <span>{isNew ? 'Nouvelle tâche' : 'Tâche'}</span>
        {isNew ? <span className="pt-head-spacer" /> : (
          <button className="pt-trash" aria-label="Mettre à la corbeille" onClick={onRemove}><Icon name="trash" size={20} /></button>
        )}
      </header>

      <div className="pt-body">
        <div className="pt-titles">
          <button className="pt-kind" style={{ color: KIND_COLOR[draft.kind] }} onClick={() => setSheet('kind')}>{KINDS[draft.kind]}</button>
          <textarea
            ref={titleRef}
            className="pt-title"
            rows={1}
            placeholder="Titre de la tâche"
            aria-label="Titre"
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLTextAreaElement).blur() } }}
          />
        </div>

        <div className="pt-status" role="radiogroup" aria-label="Statut">
          {STATUSES.map((s) => (
            <button key={s.id} role="radio" aria-checked={draft.status === s.id} style={{ ['--c' as string]: STATUS_COLOR[s.id] }} onClick={() => commit({ ...draft, status: s.id })}>{s.label}</button>
          ))}
        </div>

        <div className="pt-group">
          <span className="pt-label">Estimation{draft.points != null ? <> · <b>{draft.points} point{draft.points > 1 ? 's' : ''}</b></> : null}</span>
          <div className="pt-points" role="radiogroup" aria-label="Estimation en points">
            {POINTS.map((p, i) => {
              const on = draft.points != null && p <= draft.points
              return (
                <button key={p} role="radio" aria-checked={draft.points === p} className={on ? 'on' : ''} onClick={() => commit({ ...draft, points: draft.points === p ? null : p })}>
                  <i style={{ height: 14 + i * 7, background: on ? (i < 3 ? 'var(--ok)' : i < 5 ? '#D98A1C' : '#C2413A') : undefined }} />
                  {p}
                </button>
              )
            })}
          </div>
        </div>

        <div className="pt-group">
          <span className="pt-label">Pour qui</span>
          <div className="pt-people">
            {people.map((m) => {
              const on = draft.assigneeIds.includes(m.id)
              return (
                <button key={m.id} aria-pressed={on} className={on ? 'on' : ''} onClick={() => toggleAssignee(m.id)}>
                  <Avatar member={m} size={50} online={online.includes(m.id)} />
                  {m.id === user?.id ? 'Moi' : m.name.split(/\s+/)[0]}
                </button>
              )
            })}
          </div>
        </div>

        <DueField className="pt-group" labelClass="pt-label" value={draft.dueOn} sprintEnd={sprint?.endsOn} onChange={(d) => commit({ ...draft, dueOn: d })} />

        <PrPicker card task={draft} value={draft.prUrl} onChange={(url) => linkPr(url ?? '')} onMerged={() => draft.status !== 'done' && commit({ ...draft, status: 'done' })} />

        <div className="pt-rows">
          <button onClick={() => { setDesc(draft.description); setSheet('desc') }}>
            <span>Description</span>
            <em className={draft.description.trim() ? 'filled' : ''}>{draft.description.trim() || 'Ajouter'}</em>
          </button>
          {openSprints.length > 0 && (
            <button onClick={() => setSheet('sprint')}>
              <span>Sprint</span>
              <em className="filled">{sprint ? sprint.name : 'Backlog'}</em>
            </button>
          )}
        </div>

        {!isNew && <TaskComments task={draft} compact />}
      </div>

      <footer className="pt-foot">
        {isNew ? (
          <button className="wz-main" onClick={onCreate}>Créer la tâche</button>
        ) : (
          <button className="wz-main" style={{ background: STATUS_COLOR[next.to] }} onClick={() => commit({ ...draft, status: next.to })}>{next.label}</button>
        )}
      </footer>

      {sheet === 'kind' && (
        <Modal title="Type de tâche" onClose={() => setSheet(null)}>
          <div className="wz-list">
            {(Object.entries(KINDS) as [TaskKind, string][]).map(([k, v]) => (
              <button key={k} className={`wz-row slim${draft.kind === k ? ' on' : ''}`} onClick={() => { commit({ ...draft, kind: k }); setSheet(null) }}>
                <span className="wz-row-text"><b style={{ color: KIND_COLOR[k] }}>{v}</b></span>
                {draft.kind === k && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {sheet === 'sprint' && (
        <Modal title="Sprint" onClose={() => setSheet(null)}>
          <div className="wz-list">
            <button className={`wz-row slim${!draft.sprintId ? ' on' : ''}`} onClick={() => { commit({ ...draft, sprintId: null }); setSheet(null) }}>
              <span className="wz-row-text"><b>Backlog</b></span>
              {!draft.sprintId && <Icon name="check" size={18} />}
            </button>
            {openSprints.map((sp) => (
              <button key={sp.id} className={`wz-row slim${draft.sprintId === sp.id ? ' on' : ''}`} onClick={() => { commit({ ...draft, sprintId: sp.id }); setSheet(null) }}>
                <span className="wz-row-text"><b>{sp.name}</b>{sp.status === 'active' && <span>En cours</span>}</span>
                {draft.sprintId === sp.id && <Icon name="check" size={18} />}
              </button>
            ))}
          </div>
        </Modal>
      )}
      {sheet === 'desc' && (
        <Modal title="Description" onClose={() => setSheet(null)} footer={
          <button className="btn" style={{ width: '100%' }} onClick={() => { commit({ ...draft, description: desc }); setSheet(null) }}>Enregistrer</button>
        }>
          <textarea className="input task-desc" style={{ minHeight: 180 }} value={desc} placeholder="Ce qu'il faut faire, quand c'est fini…" onChange={(e) => setDesc(e.target.value)} aria-label="Description" />
        </Modal>
      )}
    </div>
  )
}
