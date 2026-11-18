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
}

export type PresenceStatus = 'available' | 'busy' | 'away'

export const PRESENCE: Record<PresenceStatus, { label: string; color: string }> = {
  available: { label: 'Disponible', color: '#3FA36B' },
  busy: { label: 'Occupé', color: '#D9822B' },
  away: { label: 'Absent', color: '#8A90A2' },
}

export type ProfilePatch = Partial<Pick<Member, 'name' | 'color' | 'title' | 'status'>>

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
