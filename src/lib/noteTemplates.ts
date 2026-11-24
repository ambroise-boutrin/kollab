import type { Member, NoteKind, Sprint, Task } from './types'

const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
const p = (t = '') => `<p>${t}</p>`
const h2 = (t: string) => `<h2>${esc(t)}</h2>`
const ul = (items: string[]) => `<ul>${(items.length ? items : ['']).map((i) => `<li><p>${i}</p></li>`).join('')}</ul>`
const todo = (items: string[] = ['']) => `<ul data-type="taskList">${items.map((i) => `<li data-type="taskItem" data-checked="false"><p>${i}</p></li>`).join('')}</ul>`

export interface TemplateContext {
  members: Member[]
  tasks: Task[]
  sprints: Sprint[]
  /** Membres en ligne (moi compris) : proposés comme présents. */
  present: string[]
}

export const today = () => new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })

/** Titre proposé pour un nouveau document de ce type. */
export function templateTitle(kind: NoteKind) {
  if (kind === 'daily') return `Daily du ${today()}`
  if (kind === 'cr') return `Compte rendu du ${today()}`
  if (kind === 'retro') return 'Rétro de sprint'
  if (kind === 'spec') return 'Spec : '
  if (kind === 'cdc') return 'Cahier des charges'
  if (kind === 'idee') return 'Idées'
  return 'Sans titre'
}

/** Contenu de départ, déjà rempli avec la date, les présents, le sprint et les tâches de chacun. */
export function templateHtml(kind: NoteKind, ctx: TemplateContext): string {
  const sprint = ctx.sprints.find((s) => s.status === 'active')
  const lastDone = [...ctx.sprints].filter((s) => s.status === 'done').pop()
  const presents = ctx.members.filter((m) => ctx.present.includes(m.id)).map((m) => esc(m.name)).join(', ')
  const head = `<p><strong>Date :</strong> ${today()}${sprint ? ` · ${esc(sprint.name)}` : ''}</p>`
  switch (kind) {
    case 'cr':
      return `${head}<p><strong>Présents :</strong> ${presents}</p>${h2('Points abordés')}${ul([''])}${h2('Décisions')}${ul([''])}${h2('À faire')}${todo()}`
    case 'daily': {
      const since = Date.now() - 36 * 3600e3
      const scope = sprint ? ctx.tasks.filter((t) => t.sprintId === sprint.id) : ctx.tasks
      const people = ctx.members.map((m) => {
        const mine = scope.filter((t) => t.assigneeIds.includes(m.id))
        const done = mine.filter((t) => t.status === 'done' && t.doneAt && new Date(t.doneAt).getTime() > since).map((t) => esc(t.title))
        const doing = mine.filter((t) => t.status === 'doing' || t.status === 'review').map((t) => esc(t.title))
        if (!done.length && !doing.length) return ''
        return `<p><strong>${esc(m.name)}</strong></p>${ul([...(done.length ? [`Fini : ${done.join(', ')}`] : []), ...(doing.length ? [`En cours : ${doing.join(', ')}`] : [])])}`
      }).join('')
      return `${head}${people || p('Personne n\'a de tâche en cours dans le sprint.')}${h2('Blocages')}${ul(['Aucun'])}${h2('À faire')}${todo()}`
    }
    case 'spec':
      return `${h2('Problème')}${p()}${h2('Solution proposée')}${p()}${h2('Critères d\'acceptation')}${todo()}${h2('Questions ouvertes')}${ul([''])}`
    case 'retro': {
      const s = sprint ?? lastDone
      return `<p><strong>Sprint :</strong> ${s ? esc(s.name) : ''}</p>${h2('Ce qui a bien marché')}${ul([''])}${h2('Ce qui a coincé')}${ul([''])}${h2('Actions pour le prochain sprint')}${todo()}`
    }
    case 'cdc':
      return `${h2('Contexte')}${p()}${h2('Objectifs')}${ul([''])}${h2('Utilisateurs')}${p()}${h2('Fonctionnalités')}${todo()}${h2('Contraintes')}${p()}${h2('Planning')}${p()}`
    case 'idee':
      return `${ul([''])}`
    default:
      return ''
  }
}
