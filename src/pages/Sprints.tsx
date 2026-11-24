import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { AvatarGroup } from '../components/Avatar'
import { Icon } from '../components/Icon'
import { Modal } from '../components/Modal'
import { useToast } from '../components/Toast'
import { activeSprint, addDays, burndown, daysLeft, isoDay, shortDate, sprintLength, sprintPoints } from '../lib/sprints'
import { useStore, useWorkspace } from '../lib/store'
import { KINDS, STATUSES, type Sprint, type Task } from '../lib/types'
import { Poker } from './Poker'
import { TaskDrawer } from './TaskDrawer'

/** Scrum : sprint en cours avec son burndown, backlog à planifier, sprints à venir et vélocité. */
export function Sprints() {
  const ws = useWorkspace()
  const { backend, user, saveTask, reload } = useStore()
  const toast = useToast()
  const me = ws.members.find((m) => m.id === user?.id) ?? (backend.mode === 'demo' ? ws.members[0] : undefined)
  const canWrite = me?.role !== 'guest'
  const [params, setParams] = useSearchParams()
  const [creating, setCreating] = useState(false)
  const [closing, setClosing] = useState<Sprint | null>(null)
  const [editing, setEditing] = useState<Sprint | null>(null)
  const [report, setReport] = useState<Sprint | null>(null)
  const [fresh, setFresh] = useState<Task | null>(null)

  const active = activeSprint(ws)
  const planned = ws.sprints.filter((s) => s.status === 'planned').sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const done = ws.sprints.filter((s) => s.status === 'done').sort((a, b) => a.startsOn.localeCompare(b.startsOn))
  const backlog = ws.tasks.filter((t) => !t.sprintId && t.status !== 'done').sort((a, b) => a.position - b.position)
  const target = active ?? planned[0]
  const poker = params.get('poker') === '1'
  const setPoker = (on: boolean) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (on) next.set('poker', '1')
      else next.delete('poker')
      return next
    }, { replace: true })
  const openId = params.get('tache')
  const open = ws.tasks.find((t) => t.id === openId)
  const setOpenId = (id: string | null) =>
    setParams((p) => {
      const next = new URLSearchParams(p)
      if (id) next.set('tache', id)
      else next.delete('tache')
      return next
    }, { replace: true })

  async function attempt(fn: () => Promise<unknown>, ok: string) {
    try {
      await fn()
      await reload()
      toast(ok)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Action impossible')
    }
  }

  function moveTo(t: Task, sprintId: string | null) {
    void saveTask({ ...t, sprintId })
    const s = ws.sprints.find((x) => x.id === sprintId)
    const cap = s ? capacity(s) : null
    if (!s || cap == null) return
    const before = sprintPoints(ws.tasks.filter((x) => x.sprintId === s.id))
    const after = before + (t.points ?? 0)
    if (after > cap) toast(`${s.name} : ${after} pts prévus, l'équipe en fait ${cap} d'habitude`)
  }

  async function start(s: Sprint) {
    const len = sprintLength(s)
    const today = isoDay(new Date())
    await attempt(() => backend.updateSprint(s.id, { status: 'active', startsOn: today, endsOn: addDays(today, len - 1) }), `${s.name} commence`)
  }

  const velocity = done.map((s) => ({ s, pts: sprintPoints(ws.tasks.filter((t) => t.sprintId === s.id && t.status === 'done')) }))
  const avg = velocity.length ? Math.round(velocity.reduce((n, v) => n + v.pts, 0) / velocity.length) : null
  // Rythme habituel ramené à la durée du sprint (un sprint de 3 semaines peut porter plus qu'un de 1).
  const perDay = velocity.length ? velocity.reduce((n, v) => n + v.pts, 0) / velocity.reduce((n, v) => n + sprintLength(v.s), 0) : null
  const capacity = (s: Sprint) => (perDay ? Math.round(perDay * sprintLength(s)) : null)

  return (
    <div className="page sprints-page">
      <div className="page-head">
        <div>
          <h1>Sprints</h1>
          <p className="muted" style={{ margin: '2px 0 0' }}>
            {active ? `${active.name} en cours` : 'Aucun sprint en cours'} · {backlog.length} tâche{backlog.length > 1 ? 's' : ''} dans le backlog{avg != null ? ` · vélocité ${avg} pts` : ''}
          </p>
        </div>
        <div className="actions">
          <button className="btn soft" onClick={() => setPoker(true)}><Icon name="cards" size={18} /> Poker planning</button>
          {canWrite && <button className="btn" onClick={() => setCreating(true)}><Icon name="plus" size={18} /> Nouveau sprint</button>}
        </div>
      </div>

      {active ? (
        <ActiveSprint sprint={active} cap={capacity(active)} canWrite={canWrite} onClose={() => setClosing(active)} onEdit={() => setEditing(active)} onOpen={setOpenId} />
      ) : (
        <section className="sprint-hero idle">
          <div>
            <h2>Pas de sprint en cours</h2>
            <p>{planned[0] ? `${planned[0].name} est prêt : lance-le quand l'équipe est prête.` : 'Crée un sprint de une à trois semaines, puis ajoute-y des tâches du backlog.'}</p>
          </div>
          {canWrite && (planned[0] ? (
            <button className="btn light" onClick={() => void start(planned[0])}><Icon name="play" size={16} /> Démarrer {planned[0].name}</button>
          ) : (
            <button className="btn light" onClick={() => setCreating(true)}>Créer un sprint</button>
          ))}
        </section>
      )}

      <div className="sprints-grid">
        <section className="card backlog">
          <div className="row-between">
            <h2>Backlog <span className="count-pill">{backlog.length}</span></h2>
            {canWrite && (
              <button className="btn soft small" onClick={() => setFresh({ id: 'nouvelle', title: '', description: '', status: 'todo', kind: 'feature', points: null, assigneeIds: [], prUrl: null, position: 0, createdAt: '', sprintId: null })}>
                <Icon name="plus" size={16} /> Tâche
              </button>
            )}
          </div>
          {backlog.length === 0 ? (
            <p className="hint">Le backlog est vide : toutes les tâches sont planifiées.</p>
          ) : (
            <ul className="backlog-list">
              {backlog.map((t) => (
                <li key={t.id} className="backlog-row appear">
                  <button className="backlog-title" onClick={() => setOpenId(t.id)}>
                    <span className={`kind-bar ${t.kind}`} />
                    <span>{t.title}</span>
                    {t.kind !== 'feature' && <span className={`tag ${t.kind}`}>{KINDS[t.kind]}</span>}
                  </button>
                  <span className={`pts-pill${t.points == null ? ' empty' : ''}`} title="Estimation">{t.points ?? '?'}</span>
                  {canWrite && target && (
                    <button className="btn soft small" onClick={() => moveTo(t, target.id)} title={`Ajouter à ${target.name}`}>
                      → {target.name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <div className="sprints-side">
          <section className="card">
            <h2>À venir</h2>
            {planned.length === 0 && <p className="hint">Aucun sprint prévu.</p>}
            {planned.map((s) => {
              const list = ws.tasks.filter((t) => t.sprintId === s.id)
              return (
                <div key={s.id} className="sprint-row">
                  <div>
                    <strong>{s.name}</strong>
                    <span className="muted">{shortDate(s.startsOn)} → {shortDate(s.endsOn)} · {list.length} tâche{list.length > 1 ? 's' : ''} · {sprintPoints(list)} pts</span>
                    {s.goal && <span className="sprint-goal">{s.goal}</span>}
                    <LoadBar pts={sprintPoints(list)} cap={capacity(s)} />
                  </div>
                  <div className="sprint-row-actions">
                    {canWrite && <button className="btn soft small" onClick={() => setEditing(s)}>Modifier</button>}
                    {canWrite && !active && <button className="btn small" onClick={() => void start(s)}>Démarrer</button>}
                  </div>
                </div>
              )
            })}
          </section>

          {done.length > 0 && (
            <section className="card">
              <h2>Terminés</h2>
              {[...done].reverse().map((s) => {
                const v = velocity.find((x) => x.s.id === s.id)
                return (
                  <button key={s.id} className="sprint-row sprint-done-row" onClick={() => setReport(s)}>
                    <div>
                      <strong>{s.name}</strong>
                      <span className="muted">{shortDate(s.startsOn)} → {shortDate(s.endsOn)} · {v?.pts ?? 0} pts livrés</span>
                    </div>
                    <span className="mini-more">Bilan</span>
                  </button>
                )
              })}
            </section>
          )}

          <section className="card">
            <h2>Vélocité</h2>
            {velocity.length === 0 ? (
              <p className="hint">Elle s'affiche après le premier sprint terminé.</p>
            ) : (
              <Velocity data={velocity.map((v) => ({ label: v.s.name.replace(/^Sprint\s*/i, 'S'), pts: v.pts }))} avg={avg ?? 0} />
            )}
          </section>
        </div>
      </div>

      {creating && <SprintDialog sprints={ws.sprints} hasActive={!!active} onClose={() => setCreating(false)} onSave={(sp) => attempt(() => backend.createSprint(sp), `${sp.name} créé`).then(() => setCreating(false))} />}
      {editing && <SprintDialog sprint={editing} sprints={ws.sprints} hasActive={!!active} onClose={() => setEditing(null)} onSave={(sp) => attempt(() => backend.updateSprint(editing.id, { name: sp.name, goal: sp.goal, startsOn: sp.startsOn, endsOn: sp.endsOn }), `${sp.name} modifié`).then(() => setEditing(null))} />}
      {report && <SprintReport sprint={report} onClose={() => setReport(null)} onOpen={setOpenId} />}
      {closing && (
        <CloseSprintDialog
          sprint={closing}
          next={planned[0]}
          onClose={() => setClosing(null)}
          onConfirm={async (dest) => {
            const left = ws.tasks.filter((t) => t.sprintId === closing.id && t.status !== 'done')
            for (const t of left) await saveTask({ ...t, sprintId: dest })
            await attempt(() => backend.updateSprint(closing.id, { status: 'done', closedAt: new Date().toISOString() }), `${closing.name} terminé`)
            setClosing(null)
          }}
        />
      )}
      {poker && <Poker onClose={() => setPoker(false)} />}
      {open && <TaskDrawer task={open} onClose={() => setOpenId(null)} />}
      {fresh && <TaskDrawer task={fresh} isNew onClose={() => setFresh(null)} />}
    </div>
  )
}

function ActiveSprint({ sprint, cap, canWrite, onClose, onEdit, onOpen }: { sprint: Sprint; cap: number | null; canWrite: boolean; onClose: () => void; onEdit: () => void; onOpen: (id: string) => void }) {
  const ws = useWorkspace()
  const tasks = ws.tasks.filter((t) => t.sprintId === sprint.id)
  const { total, len, actual } = burndown(sprint, tasks)
  const donePts = sprintPoints(tasks.filter((t) => t.status === 'done'))
  const pct = total ? Math.round((donePts / total) * 100) : 0
  const left = daysLeft(sprint)
  const elapsed = Math.min(1, actual.length / len)
  // Météo : en avance, dans les temps ou en retard par rapport à la ligne idéale.
  const ideal = total * (1 - elapsed)
  const remaining = actual.at(-1) ?? total
  const mood = !total ? null : remaining <= ideal ? { label: 'Dans les temps', cls: 'ok' } : remaining - ideal <= total * 0.15 ? { label: 'Un peu juste', cls: 'warn' } : { label: 'Derrière le rythme', cls: 'late' }
  const people = ws.members.filter((m) => tasks.some((t) => t.assigneeIds.includes(m.id)))

  return (
    <section className="sprint-hero">
      <div className="sprint-hero-main">
        <div className="sprint-hero-top">
          <span className="sprint-badge">En cours</span>
          {mood && <span className={`sprint-mood ${mood.cls}`} title="Comparé à la ligne idéale du burndown">{mood.label}</span>}
          {mood && <span className="sprint-mood-why">{Math.round(remaining)} pts restants, {Math.round(ideal)} attendus à ce jour</span>}
        </div>
        <h2>{sprint.name}</h2>
        {sprint.goal && <p className="sprint-goal-big">{sprint.goal}</p>}
        <div className="sprint-facts">
          <div><b>{left}</b><span>jour{left > 1 ? 's' : ''} restant{left > 1 ? 's' : ''}</span></div>
          <div><b>{donePts}/{total}</b><span>points faits</span></div>
          <div><b>{tasks.filter((t) => t.status === 'done').length}/{tasks.length}</b><span>tâches</span></div>
        </div>
        <div className="sprint-progress" aria-label={`${pct} % terminé`}><i style={{ width: `${pct}%` }} /></div>
        {cap != null && total > cap && <p className="sprint-over">{total} pts prévus, l'équipe en livre {cap} d'habitude. Retire des tâches ou garde-les en bonus.</p>}
        <div className="sprint-hero-foot">
          <span>{shortDate(sprint.startsOn)} → {shortDate(sprint.endsOn)}</span>
          <AvatarGroup members={people} size={26} />
          {canWrite && <button className="btn light small" onClick={onEdit}>Modifier</button>}
          {canWrite && <button className="btn light small" onClick={onClose}>Terminer le sprint</button>}
        </div>
      </div>
      <div className="sprint-chart">
        <Burndown total={total} len={len} actual={actual} />
        <div className="sprint-cols">
          {STATUSES.map((s) => {
            const list = tasks.filter((t) => t.status === s.id)
            return (
              <button key={s.id} className={`sprint-col status-${s.id}`} onClick={() => list[0] && onOpen(list[0].id)} disabled={!list.length}>
                <b>{list.length}</b>
                <span>{s.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/** Burndown : points restants chaque jour (trait plein) face à la ligne idéale (pointillés). */
function Burndown({ total, len, actual }: { total: number; len: number; actual: number[] }) {
  const W = 320
  const H = 150
  const P = 8
  const x = (i: number) => P + (i / Math.max(1, len - 1)) * (W - 2 * P)
  const y = (v: number) => P + (1 - v / Math.max(1, total)) * (H - 2 * P)
  const line = actual.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const area = actual.length ? `${line} L${x(actual.length - 1).toFixed(1)},${H - P} L${x(0).toFixed(1)},${H - P} Z` : ''
  return (
    <figure className="burndown">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Burndown : ${actual.at(-1) ?? total} points restants sur ${total}`}>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={P} x2={W - P} y1={P + f * (H - 2 * P)} y2={P + f * (H - 2 * P)} className="bd-grid" />)}
        <line x1={x(0)} y1={y(total)} x2={x(len - 1)} y2={y(0)} className="bd-ideal" />
        {area && <path d={area} className="bd-area" />}
        {line && <path d={line} className="bd-line" />}
        {actual.length > 0 && <circle cx={x(actual.length - 1)} cy={y(actual.at(-1)!)} r="4.5" className="bd-dot" />}
      </svg>
      <figcaption><span><i className="bd-key line" /> Restant</span><span><i className="bd-key ideal" /> Idéal</span></figcaption>
    </figure>
  )
}

/** Charge d'un sprint comparée au rythme habituel de l'équipe. */
function LoadBar({ pts, cap }: { pts: number; cap: number | null }) {
  if (cap == null || cap <= 0) return null
  const ratio = pts / cap
  const cls = ratio > 1.1 ? 'over' : ratio >= 0.8 ? 'full' : 'ok'
  const label = ratio > 1.1 ? 'Trop chargé' : ratio >= 0.8 ? 'Bien rempli' : 'Encore de la place'
  return (
    <span className={`load-bar ${cls}`} title={`${pts} pts prévus, rythme habituel ${cap} pts`}>
      <span className="load-track"><i style={{ width: `${Math.min(100, ratio * 100)}%` }} /></span>
      <span className="load-label">{label} · {pts}/{cap} pts</span>
    </span>
  )
}

function Velocity({ data, avg }: { data: { label: string; pts: number }[]; avg: number }) {
  const max = Math.max(1, ...data.map((d) => d.pts))
  return (
    <div className="velocity">
      <div className="velocity-bars">
        {data.slice(-6).map((d, i) => (
          <div key={i} className="velocity-bar">
            <span className="v-val">{d.pts}</span>
            <i style={{ height: `${(d.pts / max) * 100}%` }} />
            <span className="v-label">{d.label}</span>
          </div>
        ))}
      </div>
      <p className="muted" style={{ margin: 0, fontSize: 13 }}>Moyenne : <b>{avg} points</b> par sprint. Prévois à peu près autant pour le prochain.</p>
    </div>
  )
}

/** Créer ou modifier un sprint : nom unique, date de début au choix, durée. */
function SprintDialog({ sprint, sprints, hasActive, onClose, onSave }: {
  sprint?: Sprint
  sprints: Sprint[]
  hasActive: boolean
  onClose: () => void
  onSave: (s: Omit<Sprint, 'id' | 'closedAt'>) => Promise<void>
}) {
  const today = isoDay(new Date())
  const others = sprints.filter((x) => x.id !== sprint?.id)
  const nextNumber = Math.max(0, ...sprints.map((x) => Number(/(\d+)\s*$/.exec(x.name)?.[1] ?? 0))) + 1
  const last = others.filter((x) => x.status !== 'done').sort((a, b) => a.endsOn.localeCompare(b.endsOn)).at(-1)
  const after = last && last.endsOn >= today ? addDays(last.endsOn, 1) : null
  const [name, setName] = useState(sprint?.name ?? `Sprint ${nextNumber}`)
  const [goal, setGoal] = useState(sprint?.goal ?? '')
  const [startsOn, setStartsOn] = useState(sprint?.startsOn ?? after ?? today)
  const [weeks, setWeeks] = useState(() => (sprint ? Math.max(1, Math.round(sprintLength(sprint) / 7)) : 2))
  const [startNow, setStartNow] = useState(!sprint && !hasActive && !after)
  const [busy, setBusy] = useState(false)
  const endsOn = addDays(startsOn, weeks * 7 - 1)
  const taken = others.some((x) => x.name.trim().toLowerCase() === name.trim().toLowerCase())
  const editingActive = sprint?.status === 'active'
  async function save() {
    if (!name.trim() || taken) return
    setBusy(true)
    try {
      await onSave({ name: name.trim(), goal: goal.trim(), startsOn, endsOn, status: sprint?.status ?? (startNow && !hasActive ? 'active' : 'planned') })
    } finally {
      setBusy(false)
    }
  }
  const starts: [string, string][] = [["Aujourd'hui", today]]
  if (after && last) starts.push([`Après ${last.name} (${shortDate(after)})`, after])
  return (
    <Modal
      title={sprint ? `Modifier ${sprint.name}` : 'Nouveau sprint'}
      onClose={onClose}
      footer={<><button className="btn soft" onClick={onClose}>Annuler</button><button className="btn" disabled={busy || !name.trim() || taken} onClick={() => void save()}>{sprint ? 'Enregistrer' : startNow && !hasActive ? 'Créer et démarrer' : 'Créer'}</button></>}
    >
      <div className="sprint-form">
        <label className="task-field">
          <span className="task-label">Nom</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} aria-invalid={taken} />
          {taken && <span className="field-error">Un sprint porte déjà ce nom.</span>}
        </label>
        <label className="task-field">
          <span className="task-label">Objectif</span>
          <input className="input" value={goal} onChange={(e) => setGoal(e.target.value)} maxLength={300} placeholder="Ce que l'équipe veut avoir livré à la fin" />
        </label>
        {!editingActive && (
          <div className="task-field">
            <span className="task-label">Début</span>
            <div className="chips" role="radiogroup" aria-label="Début">
              {starts.map(([l, d]) => (
                <button key={d} type="button" role="radio" aria-checked={startsOn === d} className="chip" onClick={() => { setStartsOn(d); if (d !== today) setStartNow(false) }}>{l}</button>
              ))}
              <label className={`chip chip-date${starts.some(([, d]) => d === startsOn) ? '' : ' on'}`}>
                <input type="date" value={startsOn} min={sprint ? undefined : today} onChange={(e) => { if (e.target.value) { setStartsOn(e.target.value); if (e.target.value !== today) setStartNow(false) } }} aria-label="Autre date de début" />
              </label>
            </div>
          </div>
        )}
        <div className="task-field">
          <span className="task-label">Durée</span>
          <div className="chips" role="radiogroup" aria-label="Durée">
            {[1, 2, 3, 4].map((w) => (
              <button key={w} type="button" role="radio" aria-checked={weeks === w} className="chip" onClick={() => setWeeks(w)}>{w} semaine{w > 1 ? 's' : ''}</button>
            ))}
          </div>
          <span className="muted" style={{ fontSize: 13 }}>{shortDate(startsOn)} → {shortDate(endsOn)}</span>
        </div>
        {!sprint && !hasActive && startsOn === today && (
          <label className="switch-row">
            <input type="checkbox" checked={startNow} onChange={(e) => setStartNow(e.target.checked)} />
            <span>Le démarrer tout de suite</span>
          </label>
        )}
      </div>
    </Modal>
  )
}

/** Bilan d'un sprint terminé : objectif, points, tâches livrées. */
function SprintReport({ sprint, onClose, onOpen }: { sprint: Sprint; onClose: () => void; onOpen: (id: string) => void }) {
  const ws = useWorkspace()
  const doneTasks = ws.tasks.filter((t) => t.sprintId === sprint.id && t.status === 'done')
  const pts = sprintPoints(doneTasks)
  const people = ws.members.filter((m) => doneTasks.some((t) => t.assigneeIds.includes(m.id)))
  return (
    <Modal title={`Bilan de ${sprint.name}`} onClose={onClose}>
      <div className="sprint-report">
        <p className="muted" style={{ margin: 0 }}>{shortDate(sprint.startsOn)} → {shortDate(sprint.endsOn)}{sprint.closedAt ? ` · clôturé le ${shortDate(sprint.closedAt.slice(0, 10))}` : ''}</p>
        {sprint.goal && <p className="sprint-goal-big" style={{ margin: 0 }}>{sprint.goal}</p>}
        <div className="report-tiles">
          <div><b>{pts}</b><span>points livrés</span></div>
          <div><b>{doneTasks.length}</b><span>tâche{doneTasks.length > 1 ? 's' : ''} terminée{doneTasks.length > 1 ? 's' : ''}</span></div>
          <div><b>{people.length}</b><span>personne{people.length > 1 ? 's' : ''}</span></div>
        </div>
        {doneTasks.length === 0 ? <p className="hint">Aucune tâche terminée dans ce sprint.</p> : (
          <ul className="report-list">
            {doneTasks.map((t) => (
              <li key={t.id}>
                <button onClick={() => { onClose(); onOpen(t.id) }}>
                  <span>{t.title}</span>
                  <span className="muted">{t.points != null ? `${t.points} pts` : ''}</span>
                  <AvatarGroup members={ws.members.filter((m) => t.assigneeIds.includes(m.id))} size={22} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function CloseSprintDialog({ sprint, next, onClose, onConfirm }: { sprint: Sprint; next?: Sprint; onClose: () => void; onConfirm: (dest: string | null) => Promise<void> }) {
  const ws = useWorkspace()
  const left = ws.tasks.filter((t) => t.sprintId === sprint.id && t.status !== 'done')
  const doneTasks = ws.tasks.filter((t) => t.sprintId === sprint.id && t.status === 'done')
  const [dest, setDest] = useState<string | null>(next?.id ?? null)
  const [busy, setBusy] = useState(false)
  return (
    <Modal
      title={`Terminer ${sprint.name}`}
      onClose={onClose}
      footer={<><button className="btn soft" onClick={onClose}>Annuler</button><button className="btn" disabled={busy} onClick={() => { setBusy(true); void onConfirm(dest).finally(() => setBusy(false)) }}>Terminer le sprint</button></>}
    >
      <div className="close-sprint">
        <div className="close-stats">
          <div className="ok"><b>{doneTasks.length}</b><span>terminée{doneTasks.length > 1 ? 's' : ''} · {sprintPoints(doneTasks)} pts</span></div>
          <div className="left"><b>{left.length}</b><span>pas finie{left.length > 1 ? 's' : ''} · {sprintPoints(left)} pts</span></div>
        </div>
        {left.length > 0 && (
          <div className="task-field">
            <span className="task-label">Les tâches pas finies vont dans</span>
            <div className="chips" role="radiogroup">
              {next && <button type="button" role="radio" aria-checked={dest === next.id} className="chip" onClick={() => setDest(next.id)}>{next.name}</button>}
              <button type="button" role="radio" aria-checked={dest === null} className="chip" onClick={() => setDest(null)}>Backlog</button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
