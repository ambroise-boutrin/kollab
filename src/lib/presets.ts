import type { GroupSetup } from './backend'

/** Modèles proposés à la création d'un projet : salons et premières tâches. */
export interface Preset {
  id: string
  name: string
  help: string
  /** Couleur franche de la vignette. */
  color: string
  setup: GroupSetup
}

type T = NonNullable<GroupSetup['tasks']>[number]
const t = (title: string, kind: T['kind'] = 'feature', points: number | null = null, status: T['status'] = 'todo'): T => ({ title, kind, points, status })

export const PRESETS: Preset[] = [
  {
    id: 'scrum', name: 'Scrum', help: 'Sprints, daily, revues et rétro.', color: '#5546E0',
    setup: {
      channels: ['général', 'daily', 'sprint', 'revues-de-code'],
      tasks: [t('Préparer le sprint planning', 'research', 1), t('Écrire les user stories du sprint', 'feature', 3), t('Mettre en place le dépôt et la CI', 'feature', 3), t('Organiser la rétrospective', 'research', 1)],
    },
  },
  {
    id: 'kanban', name: 'Kanban simple', help: 'Un tableau, un salon, et on avance.', color: '#2E7D4F',
    setup: { channels: ['général', 'idées'], tasks: [t('Lister les premières tâches', 'research'), t("Inviter l'équipe")] },
  },
  {
    id: 'etudiant', name: 'Projet étudiant', help: 'Sujet, répartition, rendus, soutenance.', color: '#D98A1C',
    setup: {
      channels: ['général', 'rendus', 'documents', 'entraide'],
      tasks: [t('Lire le sujet ensemble', 'research', 1), t('Répartir les parties', 'research', 1), t('Rendu intermédiaire', 'feature', 5), t('Préparer la soutenance', 'feature', 3)],
    },
  },
  {
    id: 'mobile', name: 'Appli mobile', help: 'Maquettes, écrans, tests et publication.', color: '#2F6FD0',
    setup: {
      channels: ['général', 'design', 'dev', 'tests'],
      tasks: [t('Maquettes des écrans principaux', 'research', 3), t('Écran de connexion', 'feature', 3), t("Navigation de l'app", 'feature', 5), t('Tests sur iPhone et Android', 'bug', 2), t('Fiche App Store et Play Store', 'feature', 2)],
    },
  },
  {
    id: 'web', name: 'Site web', help: 'Pages, contenu, SEO et mise en ligne.', color: '#C2413A',
    setup: {
      channels: ['général', 'contenu', 'dev'],
      tasks: [t('Arborescence du site', 'research', 2), t("Page d'accueil", 'feature', 5), t('Textes et images', 'feature', 3), t('Version mobile', 'feature', 3), t('Mise en ligne et nom de domaine', 'feature', 1)],
    },
  },
  {
    id: 'hackathon', name: 'Hackathon', help: '48 h : idée, prototype, démo.', color: '#B0359A',
    setup: {
      channels: ['général', 'idées', 'démo'],
      tasks: [t("Choisir l'idée", 'research', 1), t('Prototype qui marche', 'feature', 8), t('Préparer la démo', 'feature', 2), t('Slides du pitch', 'feature', 2)],
    },
  },
  {
    id: 'opensource', name: 'Open source', help: 'Issues, contributions et versions.', color: '#14142B',
    setup: {
      channels: ['général', 'contributions', 'versions'],
      tasks: [t('README et guide de contribution', 'feature', 2), t('Trier les issues ouvertes', 'research', 2), t('Préparer la prochaine version', 'feature', 3)],
    },
  },
  {
    id: 'bugs', name: 'Chasse aux bugs', help: 'Remonter, trier, corriger, vérifier.', color: '#9C2F22',
    setup: {
      channels: ['général', 'bugs', 'support'],
      tasks: [t('Lister les bugs connus', 'research', 1), t('Corriger les bugs bloquants', 'bug', 5), t('Vérifier les corrections', 'bug', 2)],
    },
  },
  {
    id: 'lancement', name: 'Lancement produit', help: 'Planning, communication, jour J.', color: '#0F7A63',
    setup: {
      channels: ['général', 'communication', 'jour-j'],
      tasks: [t('Rétroplanning du lancement', 'research', 2), t('Page de présentation', 'feature', 3), t('Annonce sur les réseaux', 'feature', 2), t('Checklist du jour J', 'research', 1)],
    },
  },
  {
    id: 'vide', name: 'Vide', help: 'Un salon général, rien d’autre.', color: '#8B90A3',
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
