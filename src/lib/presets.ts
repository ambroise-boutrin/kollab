import type { GroupSetup } from './backend'

/** Modèles proposés à la création d'un projet : salons et premières tâches. */
export interface Preset {
  id: 'scrum' | 'kanban' | 'etudiant' | 'vide'
  name: string
  help: string
  color: string
  setup: GroupSetup
}

export const PRESETS: Preset[] = [
  {
    id: 'scrum',
    name: 'Scrum',
    help: 'Sprints, daily, revues de code et rétro.',
    color: '#E7E3FF',
    setup: {
      channels: ['général', 'daily', 'sprint', 'revues-de-code'],
      tasks: [
        { title: 'Préparer le sprint planning', status: 'todo', kind: 'research', points: 1 },
        { title: 'Écrire les user stories du sprint', status: 'todo', kind: 'feature', points: 3 },
        { title: 'Mettre en place le dépôt et la CI', status: 'todo', kind: 'feature', points: 3 },
        { title: 'Organiser la rétrospective', status: 'todo', kind: 'research', points: 1 },
      ],
    },
  },
  {
    id: 'kanban',
    name: 'Kanban simple',
    help: 'Un tableau, un salon, et on avance.',
    color: '#D9F5E8',
    setup: {
      channels: ['général', 'idées'],
      tasks: [
        { title: 'Lister les premières tâches', status: 'todo', kind: 'research', points: null },
        { title: "Inviter l'équipe", status: 'todo', kind: 'feature', points: null },
      ],
    },
  },
  {
    id: 'etudiant',
    name: 'Projet étudiant',
    help: 'Sujet, répartition, rendus et soutenance.',
    color: '#FFF3C4',
    setup: {
      channels: ['général', 'rendus', 'documents', 'entraide'],
      tasks: [
        { title: 'Lire le sujet ensemble', status: 'todo', kind: 'research', points: 1 },
        { title: 'Répartir les parties', status: 'todo', kind: 'research', points: 1 },
        { title: 'Rendu intermédiaire', status: 'todo', kind: 'feature', points: 5 },
        { title: 'Préparer la soutenance', status: 'todo', kind: 'feature', points: 3 },
      ],
    },
  },
  {
    id: 'vide',
    name: 'Vide',
    help: 'Un salon général, rien d’autre.',
    color: 'var(--subtle)',
    setup: { channels: ['général'], tasks: [] },
  },
]

/** Accepte « owner/repo » ou une URL GitHub, renvoie l'URL complète ou null. */
export function normalizeRepo(input: string): string | null {
  const v = input.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  if (!v) return null
  const m = v.match(/^(?:https?:\/\/)?(?:www\.)?github\.com\/([\w.-]+)\/([\w.-]+)/i) ?? v.match(/^([\w.-]+)\/([\w.-]+)$/)
  return m ? `https://github.com/${m[1]}/${m[2]}` : null
}
