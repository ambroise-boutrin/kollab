import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Avatar } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { useToast } from '../components/Toast'
import type { Room, RoomEvent } from '../lib/backend'
import { activeSprint } from '../lib/sprints'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, type Task } from '../lib/types'

const DECK = ['1', '2', '3', '5', '8', '13', '21', '?', '☕']
const POINTS = [1, 2, 3, 5, 8, 13, 21]

/** Poker planning en direct : chacun choisit une carte en secret, on révèle ensemble, on retient l'estimation. */
export function Poker({ onClose }: { onClose: () => void }) {
  const ws = useWorkspace()
  const { backend, user, saveTask } = useStore()
  const toast = useToast()
  const me = user?.id ?? 'me'
  const canWrite = (ws.members.find((m) => m.id === me) ?? (backend.mode === 'demo' ? ws.members[0] : undefined))?.role !== 'guest'
  const [peers, setPeers] = useState<string[]>([me])
  const [taskId, setTaskId] = useState<string | null>(null)
  const [votes, setVotes] = useState<Record<string, string>>({})
  const [revealed, setRevealed] = useState(false)
  const room = useRef<Room | null>(null)
  const state = useRef({ taskId, votes, revealed })
  state.current = { taskId, votes, revealed }

  const sprint = activeSprint(ws)
  const queue = useMemo(
    () =>
      ws.tasks
        .filter((t) => t.status !== 'done' && (!t.sprintId || t.sprintId === sprint?.id || ws.sprints.some((s) => s.id === t.sprintId && s.status === 'planned')))
        .sort((a, b) => Number(a.points != null) - Number(b.points != null) || a.position - b.position),
    [ws.tasks, ws.sprints, sprint?.id],
  )
  const task = ws.tasks.find((t) => t.id === taskId) ?? null

  useEffect(() => {
    const r = backend.joinRoom('poker', {
      onPeers: (ids) => setPeers(ids.includes(me) ? ids : [me, ...ids]),
      onEvent: (e: RoomEvent) => {
        if (e.type === 'hello') {
          const s = state.current
          if (s.taskId) r.send({ type: 'state', taskId: s.taskId, votes: s.votes, revealed: s.revealed })
        } else if (e.type === 'state') {
          if (!state.current.taskId) {
            setTaskId(e.taskId as string)
            setVotes(e.votes as Record<string, string>)
            setRevealed(Boolean(e.revealed))
          }
        } else if (e.type === 'task') {
          setTaskId(e.taskId as string)
          setVotes({})
          setRevealed(false)
        } else if (e.type === 'vote') {
          setVotes((v) => ({ ...v, [e.from]: String(e.value) }))
        } else if (e.type === 'unvote') {
          setVotes((v) => {
            const next = { ...v }
            delete next[e.from]
            return next
          })
        } else if (e.type === 'reveal') {
          setRevealed(true)
        } else if (e.type === 'reset') {
          setVotes({})
          setRevealed(false)
        }
      },
    })
    room.current = r
    r.send({ type: 'hello' })
    return () => r.leave()
  }, [backend, me])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function pick(t: Task) {
    setTaskId(t.id)
    setVotes({})
    setRevealed(false)
    room.current?.send({ type: 'task', taskId: t.id })
  }

  function vote(card: string) {
    if (revealed) return
    if (votes[me] === card) {
      setVotes((v) => {
        const next = { ...v }
        delete next[me]
        return next
      })
      room.current?.send({ type: 'unvote' })
    } else {
      setVotes((v) => ({ ...v, [me]: card }))
      room.current?.send({ type: 'vote', value: card })
    }
  }

  function reveal() {
    setRevealed(true)
    room.current?.send({ type: 'reveal' })
  }

  function revote() {
    setVotes({})
    setRevealed(false)
    room.current?.send({ type: 'reset' })
  }

  async function keep(points: number) {
    if (!task) return
    await saveTask({ ...task, points })
    toast(`${points} points pour « ${task.title} »`)
    const next = queue.find((t) => t.id !== task.id && t.points == null)
    if (next) pick(next)
    else {
      setTaskId(null)
      setVotes({})
      setRevealed(false)
    }
  }

  // Résultats : moyenne des cartes chiffrées, carte la plus jouée, et proposition arrondie à la carte la plus proche.
  const numeric = Object.values(votes).map(Number).filter((n) => !Number.isNaN(n))
  const avg = numeric.length ? numeric.reduce((a, b) => a + b, 0) / numeric.length : null
  const counts = Object.values(votes).reduce<Record<string, number>>((m, v) => ({ ...m, [v]: (m[v] ?? 0) + 1 }), {})
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  const consensus = revealed && numeric.length > 1 && new Set(numeric).size === 1
  const suggestion = avg == null ? null : POINTS.reduce((best, p) => (Math.abs(p - avg) < Math.abs(best - avg) ? p : best), POINTS[0])
  const people = peers.map((id) => ws.members.find((m) => m.id === id)).filter((m): m is NonNullable<typeof m> => !!m)
  const voted = people.filter((m) => votes[m.id] != null).length

  return createPortal(
    <div className="poker-back" role="dialog" aria-modal="true" aria-label="Poker planning">
      <header className="poker-top">
        <span className="poker-logo"><Icon name="cards" size={20} /></span>
        <div>
          <strong>Poker planning</strong>
          <span>{people.length} présent{people.length > 1 ? 's' : ''}{sprint ? ` · ${sprint.name}` : ''}</span>
        </div>
        <button className="viewer-btn icon" style={{ marginLeft: 'auto' }} aria-label="Fermer" onClick={onClose}><Icon name="close" size={20} /></button>
      </header>

      <div className="poker-body">
        <aside className="poker-queue">
          <span className="task-label">À estimer</span>
          {queue.length === 0 && <p className="hint">Rien à estimer.</p>}
          {queue.map((t) => (
            <button key={t.id} className={`poker-item${t.id === taskId ? ' on' : ''}`} onClick={() => canWrite && pick(t)} disabled={!canWrite}>
              <span className={`kind-bar ${t.kind}`} />
              <span className="poker-item-title">{t.title}</span>
              <span className={`pts-pill${t.points == null ? ' empty' : ''}`}>{t.points ?? '?'}</span>
            </button>
          ))}
        </aside>

        <main className="poker-table">
          {!task ? (
            <div className="poker-empty">
              <div className="poker-fan" aria-hidden="true"><span>3</span><span>5</span><span>8</span></div>
              <strong>Choisis une tâche à estimer</strong>
              <span>Tout le monde la voit en même temps et vote en secret.</span>
              {canWrite && queue[0] && <button className="btn" onClick={() => pick(queue[0])}>Commencer par « {queue[0].title} »</button>}
            </div>
          ) : (
            <>
              <div className="poker-task appear" key={task.id}>
                {task.kind !== 'feature' && <span className={`tag ${task.kind}`}>{KINDS[task.kind]}</span>}
                <h2>{task.title}</h2>
                {task.description && <p>{task.description.slice(0, 220)}</p>}
              </div>

              <div className="poker-seats">
                {people.map((m) => {
                  const v = votes[m.id]
                  return (
                    <div key={m.id} className="poker-seat">
                      <div className={`poker-card${v != null ? ' played' : ''}${revealed && v != null ? ' flipped' : ''}`}>
                        <span className="back" />
                        <span className="front">{v}</span>
                      </div>
                      <Avatar member={m} size={30} />
                      <span className="poker-name">{m.id === me ? 'Toi' : m.name.split(' ')[0]}</span>
                    </div>
                  )
                })}
              </div>

              {revealed ? (
                <div className="poker-result appear">
                  <div className="poker-stats">
                    <div><b>{avg != null ? avg.toFixed(1).replace('.', ',') : '—'}</b><span>moyenne</span></div>
                    <div><b>{top ? top[0] : '—'}</b><span>le plus joué</span></div>
                    <div className={consensus ? 'ok' : ''}><b>{consensus ? 'Oui' : 'Non'}</b><span>accord</span></div>
                  </div>
                  {canWrite && (
                    <div className="poker-keep">
                      <span className="task-label">Retenir</span>
                      <div className="chips">
                        {POINTS.map((p) => (
                          <button key={p} className={`chip num${p === suggestion ? ' is-suggested' : ''}`} onClick={() => void keep(p)}>{p}</button>
                        ))}
                      </div>
                      <button className="btn soft small" onClick={revote}>Revoter</button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="poker-actions">
                  <span className="muted">{voted} / {people.length} ont voté</span>
                  <button className="btn" disabled={!voted} onClick={reveal}>Révéler les cartes</button>
                </div>
              )}

              {canWrite && (
                <div className="poker-hand" role="radiogroup" aria-label="Ta carte">
                  {DECK.map((c) => (
                    <button key={c} role="radio" aria-checked={votes[me] === c} className="hand-card" disabled={revealed} onClick={() => vote(c)}>
                      {c}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>,
    document.body,
  )
}
