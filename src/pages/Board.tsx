import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { useState } from 'react'
import { Avatar } from '../components/Avatar'
import { useToast } from '../components/Toast'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES, type Task, type TaskStatus } from '../lib/types'
import { TaskDrawer } from './TaskDrawer'

function TaskCard({ task, onOpen, overlay = false }: { task: Task; onOpen?: () => void; overlay?: boolean }) {
  const { workspace, online } = useStore()
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: task.id, disabled: overlay })
  const assignee = workspace?.members.find((m) => m.id === task.assigneeId)
  return (
    <button
      ref={overlay ? undefined : setNodeRef}
      className={`task${isDragging ? ' dragging' : ''}${overlay ? ' overlay' : ''}`}
      data-tour="task"
      onClick={onOpen}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
    >
      <span className={`tag ${task.kind}`}>{KINDS[task.kind]}</span>
      <span className="task-title">{task.title}</span>
      <span className="task-meta">
        {task.points != null && <span>{task.points} pts</span>}
        {task.prUrl && <span>PR liée</span>}
        <Avatar member={assignee} size={24} online={!!assignee && online.includes(assignee.id)} />
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
  const { tasks } = useWorkspace()
  const { saveTask, createTask, backend } = useStore()
  const toast = useToast()
  const [openId, setOpenId] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  )

  const byStatus = (s: TaskStatus) => tasks.filter((t) => t.status === s).sort((a, b) => a.position - b.position)
  const dragged = tasks.find((t) => t.id === dragId)
  const open = tasks.find((t) => t.id === openId)

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

  async function add(status: TaskStatus) {
    const t = await createTask({ title: 'Nouvelle tâche', status })
    setOpenId(t.id)
  }

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className="page-head">
        <h1>Tableau</h1>
        <div className="actions">
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
    </div>
  )
}
