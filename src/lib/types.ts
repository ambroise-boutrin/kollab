export type TaskStatus = 'todo' | 'doing' | 'review' | 'done'

export const STATUSES: { id: TaskStatus; label: string }[] = [
  { id: 'todo', label: 'À faire' },
  { id: 'doing', label: 'En cours' },
  { id: 'review', label: 'En revue' },
  { id: 'done', label: 'Terminé' },
]

export type TaskKind = 'feature' | 'bug' | 'research'

export const KINDS: Record<TaskKind, string> = {
  feature: 'Fonctionnalité',
  bug: 'Bug',
  research: 'Recherche',
}

export type Role = 'admin' | 'member' | 'guest'

export interface Member {
  id: string
  name: string
  color: string
  role: Role
  /** Rôle dans l'équipe, ex. « Développeuse front ». */
  title: string
  status: PresenceStatus
  avatarUrl: string | null
  online?: boolean
  /** Statut perso (« En réunion »…), vide s'il n'y en a pas ou s'il a expiré. */
  statusText?: string
  statusColor?: string | null
  /** Heure où le statut perso s'efface (null : jamais). */
  statusUntil?: string | null
  /** Reçoit le résumé du lundi par email (oui par défaut). */
  weeklyEmail?: boolean
}

/** Statut perso encore valable. */
export function liveStatus(m: Pick<Member, 'statusText' | 'statusUntil'> | undefined): string {
  if (!m?.statusText) return ''
  if (m.statusUntil && new Date(m.statusUntil).getTime() <= Date.now()) return ''
  return m.statusText
}

export type PresenceStatus = 'available' | 'busy' | 'away'

export const PRESENCE: Record<PresenceStatus, { label: string; color: string }> = {
  available: { label: 'Disponible', color: '#3FA36B' },
  busy: { label: 'Occupé', color: '#D9822B' },
  away: { label: 'Absent', color: '#8A90A2' },
}

export type ProfilePatch = Partial<Pick<Member, 'name' | 'color' | 'status' | 'statusText' | 'statusColor' | 'statusUntil' | 'weeklyEmail'>>

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  kind: TaskKind
  points: number | null
  /** Personnes attribuées (une ou plusieurs). */
  assigneeIds: string[]
  prUrl: string | null
  position: number
  createdAt: string
  /** Sprint de la tâche ; null = backlog. */
  sprintId?: string | null
  /** Passage en « Terminé » (pour le burndown). */
  doneAt?: string | null
  /** Échéance, AAAA-MM-JJ. */
  dueOn?: string | null
}

export type SprintStatus = 'planned' | 'active' | 'done'

export interface Sprint {
  id: string
  name: string
  goal: string
  /** Dates au format AAAA-MM-JJ. */
  startsOn: string
  endsOn: string
  status: SprintStatus
  closedAt: string | null
}

export interface Channel {
  id: string
  name: string
}

export interface Message {
  id: string
  channelId: string
  authorId: string
  body: string
  createdAt: string
  editedAt?: string | null
  /** Message supprimé : on garde sa place (« Message supprimé »). */
  deletedAt?: string | null
  reactions?: Reaction[]
}

export interface TaskComment {
  id: string
  taskId: string
  authorId: string
  body: string
  createdAt: string
}

export interface Reaction {
  emoji: string
  userIds: string[]
}

/** Changement de réaction diffusé en direct. */
export interface ReactionChange {
  messageId: string
  emoji: string
  userId: string
  on: boolean
}

export interface LinkItem {
  id: string
  title: string
  url: string
}

export type Provider = 'github' | 'google' | 'discord' | 'email'

export const ROLES: Record<Role, { label: string; help: string }> = {
  admin: { label: 'Admin', help: 'Gère le groupe, les invitations, les droits et Discord.' },
  member: { label: 'Membre', help: 'Crée et modifie les tâches, écrit dans le chat.' },
  guest: { label: 'Invité', help: 'Voit tout, mais ne peut rien modifier ni écrire.' },
}

/** Invitation envoyée à une adresse, en attente. */
export interface EmailInvite {
  id: string
  email: string
  role: Role
  createdAt: string
}

export interface Invite {
  id: string
  code: string
  role: Role
  expiresAt: string
  maxUses: number | null
  uses: number
}

export interface Group {
  id: string
  name: string
  inviteCode: string
  discordWebhookSet: boolean
  logoUrl?: string | null
  /** Couleur choisie à la création (sinon celle du visuel généré). */
  color?: string | null
  /** Durée habituelle d'un sprint, en jours. */
  sprintDays?: number | null
  /** Heure du point d'équipe, ex. « 09:30 ». */
  dailyTime?: string | null
}

/** Rôles dans l'équipe proposés aux admins (liste fixe). */
export const TEAM_TITLES = [
  'Chef de projet',
  'Product Owner',
  'Scrum Master',
  'Développeur',
  'Développeur front',
  'Développeur back',
  'Développeur full stack',
  'Développeur mobile',
  'DevOps',
  'Designer UX/UI',
  'Testeur QA',
  'Data',
  'Stagiaire',
] as const

/** Une action de l'équipe, notée par la base. */
export interface ActivityItem {
  id: string
  actorId: string | null
  verb: string
  target: 'tasks' | 'links' | 'documents' | 'sprints' | 'notes' | 'group_members' | 'groups' | string
  targetId: string | null
  label: string | null
  meta: Record<string, string>
  createdAt: string
}

export type NotificationKind = 'assigned' | 'mention' | 'invited' | 'joined'

export interface AppNotification {
  id: string
  kind: NotificationKind
  title: string
  body: string
  /** Page à ouvrir dans le projet (ex. /tableau?tache=…). */
  link: string | null
  groupId: string | null
  actorId: string | null
  data: { code?: string }
  readAt: string | null
  createdAt: string
}

/** Fichier de l'espace documents (PDF, image, autre). */
export interface DocumentItem {
  id: string
  name: string
  mime: string
  size: number
  path: string
  uploadedBy: string | null
  createdAt: string
}

/** Document texte écrit à plusieurs (contenu chargé à l'ouverture). */
export interface Note {
  id: string
  title: string
  preview: string
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}
