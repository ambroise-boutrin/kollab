import { useEffect, useState } from 'react'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { PrPicker } from '../components/PrLink'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES, type Task, type TaskKind, type TaskStatus } from '../lib/types'

/** Charge d'un membre = points des tâches non terminées qui lui sont attribuées. */
function load(tasks: Task[], memberId: string) {
  return tasks.filter((t) => t.assigneeIds.includes(memberId) && t.status !== 'done').reduce((n, t) => n + (t.points ?? 0), 0)
}

export function TaskDrawer({ task, onClose }: { task: Task; onClose: () => void }) {
  const { members, tasks } = useWorkspace()
  const { saveTask, deleteTask, backend, online } = useStore()
  const toast = useToast()
  const [draft, setDraft] = useState(task)

  // Si quelqu'un d'autre modifie la tâche pendant qu'elle est ouverte.
  useEffect(() => setDraft(task), [task])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function commit(next: Task) {
    setDraft(next)
    void saveTask(next)
  }

  /** Ajoute ou retire une personne ; une tâche peut en avoir plusieurs. */
  function toggleAssignee(memberId: string) {
    const on = draft.assigneeIds.includes(memberId)
    const next = { ...draft, assigneeIds: on ? draft.assigneeIds.filter((id) => id !== memberId) : [...draft.assigneeIds, memberId] }
    commit(next)
    if (!on) {
      const name = members.find((m) => m.id === memberId)?.name ?? ''
      void backend.notifyDiscord({ type: 'task_assigned', taskTitle: next.title, assignee: name })
      toast(`${name} ajouté à la tâche`)
    }
  }

  function linkPr(url: string) {
    const next = { ...draft, prUrl: url || null }
    commit(next)
    if (url) void backend.notifyDiscord({ type: 'pr_linked', taskTitle: next.title, prUrl: url })
  }

  const maxLoad = Math.max(13, ...members.map((m) => load(tasks, m.id)))

  return (
    <>
      <div className="drawer-bg" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-label={`Tâche : ${draft.title}`}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`tag ${draft.kind}`}>{KINDS[draft.kind]}</span>
          <button className="icon-btn" style={{ marginLeft: 'auto' }} aria-label="Supprimer la tâche" onClick={() => { void deleteTask(task.id); onClose() }}>
            <Icon name="trash" size={18} />
          </button>
          <button className="icon-btn" aria-label="Fermer" onClick={onClose}>
            <Icon name="close" size={18} />
          </button>
        </div>

        <label className="field">
          <span className="sr-only">Titre</span>
          <input
            className="input"
            style={{ fontFamily: 'var(--display)', fontSize: 20, fontWeight: 700 }}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
            onBlur={() => draft.title.trim() && draft.title !== task.title && commit(draft)}
            autoFocus={task.title === 'Nouvelle tâche'}
            onFocus={(e) => task.title === 'Nouvelle tâche' && e.target.select()}
          />
        </label>

        <div className="grid-2">
          <label className="field">
            Statut
            <select className="input" value={draft.status} onChange={(e) => commit({ ...draft, status: e.target.value as TaskStatus })}>
              {STATUSES.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label className="field">
            Type
            <select className="input" value={draft.kind} onChange={(e) => commit({ ...draft, kind: e.target.value as TaskKind })}>
              {Object.entries(KINDS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </label>
          <label className="field">
            Estimation (points)
            <select className="input" value={draft.points ?? ''} onChange={(e) => commit({ ...draft, points: e.target.value === '' ? null : Number(e.target.value) })}>
              <option value="">Non estimée</option>
              {[1, 2, 3, 5, 8, 13, 21].map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </label>
          <div className="field" style={{ gridColumn: '1 / -1' }}>
            PR liée
            <PrPicker value={draft.prUrl} onChange={(url) => linkPr(url ?? '')} onMerged={() => draft.status !== 'done' && commit({ ...draft, status: 'done' })} />
          </div>
        </div>

        <label className="field">
          Description
          <textarea
            className="input"
            value={draft.description}
            placeholder="Ce qu'il faut faire, les critères pour dire que c'est fini…"
            onChange={(e) => setDraft({ ...draft, description: e.target.value })}
            onBlur={() => draft.description !== task.description && commit(draft)}
          />
        </label>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <h2>Attribuer à</h2>
          <p className="muted" style={{ margin: '0 0 4px', fontSize: 13 }}>Une ou plusieurs personnes. Elles sont prévenues.</p>
          {members.map((m) => {
            const l = load(tasks, m.id)
            const selected = draft.assigneeIds.includes(m.id)
            return (
              <button key={m.id} className={`member-pick${selected ? ' selected' : ''}`} aria-pressed={selected} onClick={() => toggleAssignee(m.id)}>
                <Avatar member={m} size={34} online={online.includes(m.id)} />
                <span style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  <span style={{ fontWeight: 500 }}>{m.name}{m.role === 'guest' && <span className="muted"> · invité</span>}</span>
                  <span className="load"><span style={{ width: `${Math.min(100, (l / maxLoad) * 100)}%`, background: l >= 13 ? 'var(--danger)' : 'var(--ok)' }} /></span>
                </span>
                <span className="muted" style={{ fontSize: 12 }}>{l} pts</span>
                <span className={`check-box${selected ? ' on' : ''}`} aria-hidden="true">{selected && <Icon name="check" size={14} />}</span>
              </button>
            )
          })}
        </div>
      </aside>
    </>
  )
}
