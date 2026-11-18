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
  online?: boolean
}

export interface Task {
  id: string
  title: string
  description: string
  status: TaskStatus
  kind: TaskKind
  points: number | null
  assigneeId: string | null
  prUrl: string | null
  position: number
  createdAt: string
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
}

export interface LinkItem {
  id: string
  title: string
  url: string
}

export type Provider = 'github' | 'google' | 'discord' | 'email'

export interface Group {
  id: string
  name: string
  inviteCode: string
  discordWebhookSet: boolean
}
