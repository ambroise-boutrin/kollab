import type { Node as PMNode } from '@tiptap/pm/model'
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

/** Contenu de départ, déjà rempli avec la date, les présents, le sprint et les tâches de chacun.
 *  Le premier paragraphe sert de chapô (résumé en une ou deux phrases). Les rubriques vides affichent une consigne en gris. */
export function templateHtml(kind: NoteKind, ctx: TemplateContext): string {
  const sprint = ctx.sprints.find((s) => s.status === 'active')
  const lastDone = [...ctx.sprints].filter((s) => s.status === 'done').pop()
  const presents = ctx.members.filter((m) => ctx.present.includes(m.id)).map((m) => esc(m.name)).join(', ')
  const pts = (list: Task[]) => list.reduce((n, t) => n + (t.points ?? 0), 0)
  const table = (head: string[], rows: string[][]) =>
    `<table><tbody><tr>${head.map((h) => `<th><p>${esc(h)}</p></th>`).join('')}</tr>${rows.map((r) => `<tr>${r.map((c) => `<td><p>${c}</p></td>`).join('')}</tr>`).join('')}</tbody></table>`
  switch (kind) {
    case 'cr':
      return `${p()}${p(`<strong>Présents</strong> : ${presents}`)}${h2('Points abordés')}${ul([''])}${h2('Décisions')}<ol><li><p></p></li></ol>${h2('Actions')}${todo()}`
    case 'daily': {
      const since = Date.now() - 36 * 3600e3
      const scope = sprint ? ctx.tasks.filter((t) => t.sprintId === sprint.id) : ctx.tasks
      const done = pts(scope.filter((t) => t.status === 'done'))
      const rows = ctx.members.map((m) => {
        const mine = scope.filter((t) => t.assigneeIds.includes(m.id))
        const y = mine.filter((t) => t.status === 'done' && t.doneAt && new Date(t.doneAt).getTime() > since).map((t) => esc(t.title)).join(', ')
        const d = mine.filter((t) => t.status === 'doing' || t.status === 'review').map((t) => esc(t.title)).join(', ')
        return [`<strong>${esc(m.name.split(/\s+/)[0])}</strong>`, y, d]
      })
      const lead = sprint ? `${done} points sur ${pts(scope)} dans le ${esc(sprint.name)}.` : ''
      return `${p(lead)}${h2('Tour de table')}${table(['Qui', 'Hier', "Aujourd'hui"], rows)}${h2('Blocages')}${p()}${h2('Actions')}${todo()}`
    }
    case 'spec':
      return `${p()}${h2('Problème')}${p()}${h2('Solution proposée')}${p()}${h2("Critères d'acceptation")}${todo()}${h2('Questions ouvertes')}${ul([''])}`
    case 'retro': {
      const s = sprint ?? lastDone
      const scope = s ? ctx.tasks.filter((t) => t.sprintId === s.id) : []
      const left = scope.filter((t) => t.status !== 'done').length
      const lead = s ? `${pts(scope.filter((t) => t.status === 'done'))} points sur ${pts(scope)} livrés${left ? `, ${left} tâche${left > 1 ? 's' : ''} pas finie${left > 1 ? 's' : ''}` : ''}.` : ''
      return `${p(lead)}${h2('À garder')}${ul([''])}${h2('À améliorer')}${ul([''])}${h2('Engagements')}${todo()}`
    }
    case 'cdc':
      return `${p()}${h2('Contexte')}${p()}${h2('Objectifs')}${ul([''])}${h2('Périmètre')}${table(['Fonction', 'Priorité', 'Lot'], [['', '', '']])}${h2('Contraintes')}${p()}${h2('Planning')}${table(['Étape', 'Date'], [['', '']])}`
    case 'idee':
      return `${ul([''])}`
    default:
      return ''
  }
}

const HINTS: Record<string, string> = {
  'points abordés': 'Ce qui a été dit, une idée par ligne',
  'décisions': 'Ce qui est décidé et ne se rediscute pas',
  'actions': 'Une action, @Prénom et une date',
  'engagements': 'Une action, @Prénom et une date',
  "critères d'acceptation": 'Ce qui doit marcher pour dire que c\'est fini',
  'blocages': 'Qui est bloqué, par quoi, qui peut aider',
  'problème': 'Ce qui ne va pas aujourd\'hui, pour qui',
  'solution proposée': 'Ce qu\'on va faire, et ce qu\'on ne fera pas',
  'questions ouvertes': 'Ce qu\'il reste à trancher',
  'à garder': 'Ce qui a marché et qu\'on refait',
  'à améliorer': 'Ce qui a coincé',
  'contexte': 'Pourquoi ce projet, pour qui',
  'objectifs': 'Un objectif mesurable par ligne',
  'contraintes': 'Budget, délais, technique',
}

/** Consigne grise d'un bloc vide : le chapô en tête, puis selon la rubrique où l'on se trouve. */
export function placeholderFor(doc: PMNode, node: PMNode, pos: number): string {
  if (node.type.name === 'heading') return 'Titre de la partie'
  if (pos === 0 && node.type.name === 'paragraph') return 'L\'essentiel en une phrase.'
  let section = ''
  doc.forEach((child, offset) => {
    if (offset <= pos && child.type.name === 'heading') section = child.textContent.trim().toLowerCase()
  })
  return HINTS[section] ?? (doc.childCount <= 1 ? 'Écris ici, ou tape / pour insérer un tableau, une image…' : '')
}
