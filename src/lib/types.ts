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
  /** Rôle proposé par la personne, en attente d'un admin. */
  titleRequest?: string | null
  status: PresenceStatus
  /** Heure où la présence choisie revient à « Disponible » (null : jamais). */
  presenceUntil?: string | null
  avatarUrl: string | null
  online?: boolean
  /** Statut perso (« En réunion »…), vide s'il n'y en a pas ou s'il a expiré. */
  statusText?: string
  statusColor?: string | null
  /** Heure où le statut perso s'efface (null : jamais). */
  statusUntil?: string | null
  /** Reçoit le résumé du lundi par email (oui par défaut). */
  weeklyEmail?: boolean
  missedEmail?: boolean
}

/** Statut perso encore valable. */
export function liveStatus(m: Pick<Member, 'statusText' | 'statusUntil'> | undefined): string {
  if (!m?.statusText) return ''
  if (m.statusUntil && new Date(m.statusUntil).getTime() <= Date.now()) return ''
  return m.statusText
}

export type PresenceStatus = 'available' | 'busy' | 'dnd' | 'away' | 'invisible'

export const PRESENCE: Record<PresenceStatus, { label: string; color: string; hint: string }> = {
  available: { label: 'Disponible', color: '#3FA36B', hint: 'Tout le monde peut te joindre' },
  busy: { label: 'Occupé', color: '#D9822B', hint: 'Les appels sonnent quand même' },
  dnd: { label: 'Ne pas déranger', color: '#D13B40', hint: 'Pas de sonnerie ni de notification' },
  away: { label: 'Absent', color: '#8A90A2', hint: 'Tu reviens bientôt' },
  invisible: { label: 'Invisible', color: '#8A90A2', hint: 'Tu parais hors ligne' },
}

/** Présence encore valable : à la fin de la durée choisie, on redevient disponible. */
export function presenceOf(m: Pick<Member, 'status' | 'presenceUntil'> | undefined): PresenceStatus {
  if (!m?.status || !(m.status in PRESENCE)) return 'available'
  if (m.presenceUntil && new Date(m.presenceUntil).getTime() <= Date.now()) return 'available'
  return m.status
}

/** Valeur pour l'ancienne colonne status (apps déjà installées). */
export function legacyPresence(s: PresenceStatus): 'available' | 'busy' | 'away' {
  return s === 'dnd' ? 'busy' : s === 'invisible' ? 'away' : s
}

export type ProfilePatch = Partial<Pick<Member, 'name' | 'color' | 'status' | 'presenceUntil' | 'statusText' | 'statusColor' | 'statusUntil' | 'weeklyEmail' | 'missedEmail'>>

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

/** Compte Discord d'une personne, relié à son compte Kollab. */
export interface DiscordAccount {
  name: string
  avatar: string | null
}

/** Serveur Discord relié au projet. */
export interface DiscordGuild {
  id: string
  name: string
  iconUrl: string | null
}

/** Salon Discord du serveur relié. */
export interface DiscordChannel {
  id: string
  name: string
  category: string | null
}

/** Salon Kollab relié à un salon Discord. */
export interface DiscordLink {
  channelId: string
  discordChannelId: string
  discordChannelName: string
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
  /** Message écrit sur Discord : nom et avatar de son auteur là-bas. */
  discord?: { name: string; avatar: string | null } | null
  /** Pièces jointes (fichiers du projet). */
  attachments?: Attachment[]
}

/** Fichier joint à un message. `path` : emplacement dans le stockage du projet. */
export interface Attachment {
  path: string
  name: string
  size: number
  mime: string
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
  admin: { label: 'Admin', help: 'Gère le projet, les invitations, les droits et Discord.' },
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

/** Offres d'abonnement d'un projet. */
export type Plan = 'free' | 'team' | 'founder'
/** Ce qu'on achète dans Stripe. */
export type Offer = 'team_month' | 'team_year' | 'founder'

/** Offre du projet ouvert, telle que la base l'applique. */
export interface Billing {
  /** Offre en vigueur (payante seulement si payée ou dans les 7 jours de grâce). */
  plan: Plan
  status: 'active' | 'past_due' | 'canceled'
  period: 'month' | 'year' | null
  periodEnd: string | null
  graceUntil: string | null
  /** Fin de l'essai gratuit en cours. */
  trialEnd?: string | null
  /** Le groupe a déjà eu un abonnement : plus d'essai. */
  trialUsed?: boolean
  /** Un client Stripe existe : factures et carte disponibles. */
  hasCustomer: boolean
  members: number
  memberLimit: number
  /** Plus de membres que l'offre n'en permet : lecture seule. */
  locked: boolean
  founderLeft: number
}

/** Limites par offre (doivent suivre plan_member_limit en base). */
export const PLAN_LIMITS: Record<Plan, { members: number; storageGb: number; discord: boolean; groupCalls: boolean }> = {
  free: { members: 5, storageGb: 1, discord: false, groupCalls: false },
  team: { members: 25, storageGb: 20, discord: true, groupCalls: true },
  founder: { members: 25, storageGb: 20, discord: true, groupCalls: true },
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
/** Type d'un document écrit à plusieurs : donne sa couleur et son modèle. */
export type NoteKind = 'page' | 'cr' | 'daily' | 'spec' | 'retro' | 'cdc' | 'idee'

export interface Note {
  id: string
  title: string
  kind: NoteKind
  /** Épinglé pour toute l'équipe. */
  pinned: boolean
  preview: string
  createdBy: string | null
  updatedBy: string | null
  createdAt: string
  updatedAt: string
}
