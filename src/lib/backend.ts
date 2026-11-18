import type { Channel, Group, Invite, LinkItem, Member, Message, ProfilePatch, Provider, Role, Task } from './types'

export interface User {
  id: string
  name: string
  email: string | null
}

export interface Workspace {
  group: Group
  members: Member[]
  tasks: Task[]
  channels: Channel[]
  links: LinkItem[]
}

export type DiscordEvent =
  | { type: 'task_assigned'; taskTitle: string; assignee: string }
  | { type: 'task_done'; taskTitle: string }
  | { type: 'pr_linked'; taskTitle: string; prUrl: string }

/** Changements reçus en temps réel des autres membres. */
export interface LiveHandlers {
  onTask(task: Task): void
  onTaskDeleted(id: string): void
  onMessage(message: Message): void
  onPresence(onlineIds: string[]): void
}

/**
 * Tout ce dont l'interface a besoin. Deux implémentations :
 * - demo : données locales, synchronisées entre onglets (aucun serveur) ;
 * - supabase : base partagée, authentification et temps réel.
 */
export interface Backend {
  mode: 'demo' | 'supabase'
  currentUser(): Promise<User | null>
  onAuthChange(cb: (user: User | null) => void): () => void
  signIn(provider: Provider, email?: string): Promise<{ emailSent?: boolean }>
  signOut(): Promise<void>

  /** Compte Kollab classique, sans GitHub, Google ni Discord. */
  signInWithPassword(email: string, password: string): Promise<void>
  /** Renvoie confirmEmail quand un lien de confirmation part par email avant la première connexion. */
  signUp(email: string, password: string, name: string): Promise<{ confirmEmail: boolean }>
  sendPasswordReset(email: string): Promise<void>
  /** Change le mot de passe de l'utilisateur connecté (ou en crée un). */
  setPassword(password: string): Promise<void>

  updateProfile(patch: ProfilePatch): Promise<void>
  /** Envoie une photo de profil (déjà redimensionnée) et renvoie son adresse. */
  uploadAvatar(file: Blob): Promise<string>
  removeAvatar(): Promise<void>

  linkedProviders(): Promise<Provider[]>
  link(provider: Provider): Promise<void>
  unlink(provider: Provider): Promise<void>

  /** Charge le groupe de l'utilisateur, ou null s'il n'en a pas encore. */
  loadWorkspace(): Promise<Workspace | null>
  createGroup(name: string): Promise<void>
  joinGroup(inviteCode: string): Promise<void>
  live(groupId: string, handlers: LiveHandlers): () => void

  listInvites(): Promise<Invite[]>
  createInvite(role: Role, opts: { days: number; maxUses: number | null }): Promise<Invite>
  revokeInvite(id: string): Promise<void>
  setMemberRole(memberId: string, role: Role): Promise<void>

  saveTask(task: Task): Promise<Task>
  deleteTask(id: string): Promise<void>

  listMessages(channelId: string): Promise<Message[]>
  sendMessage(channelId: string, body: string): Promise<Message>

  addLink(title: string, url: string): Promise<LinkItem>
  removeLink(id: string): Promise<void>

  setDiscordWebhook(url: string | null): Promise<void>
  notifyDiscord(event: DiscordEvent): Promise<void>
}

export function newId(): string {
  return crypto.randomUUID()
}
