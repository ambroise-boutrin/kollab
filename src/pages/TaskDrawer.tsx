import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PrPicker } from '../components/PrLink'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES, type Task, type TaskKind } from '../lib/types'

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
    await createTask({ title, status: draft.status, kind: draft.kind, points: draft.points, description: draft.description, assigneeIds: draft.assigneeIds, prUrl: draft.prUrl, ...(draft.sprintId !== undefined ? { sprintId: draft.sprintId } : {}) })
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

  return createPortal(
    <div className="modal-back task-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal task-modal" role="dialog" aria-modal="true" aria-label={isNew ? 'Nouvelle tâche' : `Tâche : ${draft.title}`}>
        <div className="task-modal-top">
          <span className="muted" style={{ fontSize: 13, fontWeight: 600 }}>{isNew ? 'Nouvelle tâche' : STATUSES.find((s) => s.id === draft.status)?.label}</span>
          {!isNew && (
            <button className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Supprimer la tâche" title="Supprimer" onClick={() => void remove()}>
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
              <div className="chips" role="radiogroup" aria-label="Statut">
                {STATUSES.map((s) => (
                  <button key={s.id} type="button" role="radio" aria-checked={draft.status === s.id} className={`chip status-${s.id}`} onClick={() => commit({ ...draft, status: s.id })}>
                    {s.label}
                  </button>
                ))}
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
              <span className="task-label">Points</span>
              <div className="chips" role="radiogroup" aria-label="Estimation en points">
                {POINTS.map((p) => (
                  <button key={p} type="button" role="radio" aria-checked={draft.points === p} className="chip num" onClick={() => commit({ ...draft, points: draft.points === p ? null : p })}>
                    {p}
                  </button>
                ))}
              </div>
            </div>

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

            <label className="task-field">
              <span className="task-label">Description</span>
              <textarea
                className="input task-desc"
                value={draft.description}
                placeholder="Ce qu'il faut faire, quand c'est fini…"
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
              />
            </label>

            <div className="task-field">
              <span className="task-label">Branche et PR</span>
              <PrPicker task={draft} value={draft.prUrl} onChange={(url) => linkPr(url ?? '')} onMerged={() => draft.status !== 'done' && commit({ ...draft, status: 'done' })} />
            </div>
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
