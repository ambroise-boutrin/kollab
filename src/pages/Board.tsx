import {
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { AvatarGroup } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { activeSprint, boardTasks, daysLeft, shortDate } from '../lib/sprints'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES, type Task, type TaskStatus } from '../lib/types'
import { TaskDrawer } from './TaskDrawer'

function TaskCard({ task, onOpen, overlay = false }: { task: Task; onOpen?: () => void; overlay?: boolean }) {
  const { workspace, online } = useStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: overlay })
  const people = workspace?.members.filter((m) => task.assigneeIds.includes(m.id)) ?? []
  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      className={`task${isDragging ? ' dragging' : ''}${overlay ? ' overlay' : ''}`}
      data-tour="task"
      onClick={onOpen}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
    >
      {task.kind !== 'feature' && <span className={`tag ${task.kind}`}>{KINDS[task.kind]}</span>}
      <span className="task-title">{task.title}</span>
      <span className="task-meta">
        {task.points != null && <span>{task.points} pts</span>}
        {task.prUrl && <span>PR #{task.prUrl.split('/').pop()}</span>}
        <AvatarGroup members={people} size={24} online={online} />
      </span>
    </button>
  )
}

function Column({ status, label, tasks, onOpen, onAdd }: { status: TaskStatus; label: string; tasks: Task[]; onOpen: (t: Task) => void; onAdd: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status })
  return (
    <section ref={setNodeRef} className={`column${isOver ? ' over' : ''}`} aria-label={label} data-tour="column">
      <div className="column-head">
        {label} <span className="count">{tasks.length}</span>
      </div>
      {tasks.map((t) => (
        <TaskCard key={t.id} task={t} onOpen={() => onOpen(t)} />
      ))}
      {status !== 'done' && (
        <button className="add-task" onClick={onAdd}>+ Ajouter une tâche</button>
      )}
    </section>
  )
}

export function Board() {
  const ws = useWorkspace()
  const all = boardTasks(ws)
  const sprint = activeSprint(ws)
  const { saveTask, backend, user } = useStore()
  const toast = useToast()
  const [params, setParams] = useSearchParams()
  const mine = params.get('moi') === '1'
  const me = user?.id ?? 'me'
  const tasks = mine ? all.filter((t) => t.assigneeIds.includes(me)) : all
  const openId = params.get('tache')
  const setOpenId = (id: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('tache', id)
      else next.delete('tache')
      return next
    }, { replace: true })
  const setMine = (on: boolean) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (on) next.set('moi', '1')
      else next.delete('moi')
      return next
    }, { replace: true })
  const [dragId, setDragId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Au doigt : appui long pour déplacer, sinon on fait défiler le tableau.
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor),
  )

  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position)
  const dragged = tasks.find((t) => t.id === dragId)
  const open = ws.tasks.find((t) => t.id === openId)
  const [fresh, setFresh] = useState<Task | null>(null)

  function onDragStart(e: DragStartEvent) {
    setDragId(String(e.active.id))
  }

  function onDragEnd(e: DragEndEvent) {
    setDragId(null)
    const task = tasks.find((t) => t.id === e.active.id)
    const status = e.over?.id as TaskStatus | undefined
    if (!task || !status || status === task.status) return
    const last = byStatus(status).at(-1)
    void saveTask({ ...task, status, position: last ? last.position + 1 : 0 })
    if (status === 'done') {
      void backend.notifyDiscord({ type: 'task_done', taskTitle: task.title })
      toast(`« ${task.title} » est terminée`)
    }
  }

  function add(status: TaskStatus) {
    // Rien n'est créé avant « Créer la tâche » : pas de tâche vide si on ferme.
    setFresh({ id: 'nouvelle', title: '', description: '', status, kind: 'feature', points: null, assigneeIds: mine ? [me] : [], prUrl: null, position: 0, createdAt: '', sprintId: sprint?.id ?? null })
  }

  useEffect(() => {
    const onNew = () => void add('todo')
    window.addEventListener('kollab:new-task', onNew)
    return () => window.removeEventListener('kollab:new-task', onNew)
  })

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-head">
        <div>
          <h1>Tableau</h1>
          {sprint ? (
            <Link to="/sprints" className="board-sprint">
              <b>{sprint.name}</b> · {shortDate(sprint.startsOn)} → {shortDate(sprint.endsOn)} · {daysLeft(sprint)} j restants
            </Link>
          ) : ws.sprints.length > 0 ? (
            <Link to="/sprints" className="board-sprint idle">Pas de sprint en cours · planifier</Link>
          ) : null}
        </div>
        <div className="actions">
          <div className="tabs-seg compact" role="tablist" aria-label="Filtrer">
            <button role="tab" aria-selected={!mine} onClick={() => setMine(false)}>Toutes</button>
            <button role="tab" aria-selected={mine} onClick={() => setMine(true)}>Mes tâches · {all.filter((t) => t.assigneeIds.includes(me) && t.status !== 'done').length}</button>
          </div>
          <button className="btn" data-tour="new-task" onClick={() => void add('todo')}>Nouvelle tâche</button>
        </div>
      </div>

      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setDragId(null)}>
        <div className="board">
          {STATUSES.map((s) => (
            <Column key={s.id} status={s.id} label={s.label} tasks={byStatus(s.id)} onOpen={(t) => setOpenId(t.id)} onAdd={() => void add(s.id)} />
          ))}
        </div>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease' }}>{dragged && <TaskCard task={dragged} overlay />}</DragOverlay>
      </DndContext>

      {open && <TaskDrawer task={open} onClose={() => setOpenId(null)} />}
      {fresh && <TaskDrawer task={fresh} isNew onClose={() => setFresh(null)} />}
    </div>
  )
}
