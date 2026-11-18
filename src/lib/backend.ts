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

/** Un projet (groupe) dont l'utilisateur est membre, pour le sélecteur. */
export interface GroupSummary {
  id: string
  name: string
  role: Role
}

/** Préconfiguration d'un nouveau projet (modèle choisi à la création). */
export interface GroupSetup {
  channels?: string[]
  tasks?: Pick<Task, 'title' | 'status' | 'kind' | 'points'>[]
  repoUrl?: string | null
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
  /** Supprime définitivement le compte et ses données personnelles. */
  deleteAccount(): Promise<void>

  updateProfile(patch: ProfilePatch): Promise<void>
  /** Envoie une photo de profil (déjà redimensionnée) et renvoie son adresse. */
  uploadAvatar(file: Blob): Promise<string>
  removeAvatar(): Promise<void>

  linkedProviders(): Promise<Provider[]>
  link(provider: Provider): Promise<void>
  unlink(provider: Provider): Promise<void>
  /** Connexion GitHub avec accès aux dépôts (pour les PR et la CI). */
  connectGitHub(): Promise<void>

  /** Projets dont l'utilisateur est membre, du plus ancien au plus récent. */
  listGroups(): Promise<GroupSummary[]>
  /** Charge le projet demandé (ou le premier), ou null s'il n'en a aucun. */
  loadWorkspace(groupId?: string | null): Promise<Workspace | null>
  /** Crée un projet, éventuellement préconfiguré, et renvoie son id. */
  createGroup(name: string, setup?: GroupSetup): Promise<string>
  /** Rejoint un projet avec un code et renvoie son id. */
  joinGroup(inviteCode: string): Promise<string>
  renameGroup(name: string): Promise<void>
  /** Quitte le projet ouvert. */
  leaveGroup(): Promise<void>
  /** Supprime le projet ouvert et tout son contenu (admin). */
  deleteGroup(): Promise<void>
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
