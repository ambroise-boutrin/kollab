import type { AppNotification, DiscordChannel, DiscordGuild, DiscordLink, EmailInvite, Channel, DocumentItem, Note, Sprint, ReactionChange, ActivityItem, Group, Invite, LinkItem, Member, Message, ProfilePatch, Provider, Role, Task } from './types'

export interface User {
  id: string
  name: string
  email: string | null
}

export interface TrashItem {
  kind: 'task' | 'link' | 'document' | 'note'
  id: string
  title: string
  deletedAt: string
  deletedBy: string | null
}

export interface RoomHandlers {
  onEvent(e: RoomEvent): void
  onPeers(ids: string[]): void
}
/** listen : on reçoit tout sans apparaître dans la liste des présents. */
export type RoomEvent = { type: string; from: string; [k: string]: unknown }
export interface Room {
  send(e: Omit<RoomEvent, 'from'>): void
  /** Apparaître (ou non) dans la liste des présents. */
  setPresent(on: boolean): void
  leave(): void
}

export interface Workspace {
  group: Group
  members: Member[]
  tasks: Task[]
  channels: Channel[]
  links: LinkItem[]
  /** Espace documents (vide si la base ne le connaît pas encore). */
  documents: DocumentItem[]
  /** Sprints du projet (vide si la base ne les connaît pas encore). */
  sprints: Sprint[]
  /** Documents texte (sans leur contenu). */
  notes: Note[]
}

/** Un projet (groupe) dont l'utilisateur est membre, pour le sélecteur. */
export interface GroupSummary {
  id: string
  name: string
  role: Role
  logoUrl?: string | null
  color?: string | null
  memberCount?: number
}

/** Réglages choisis pendant la création d'un projet. */
export interface GroupPrefs {
  color?: string | null
  sprintDays?: number | null
  dailyTime?: string | null
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
  /** Message modifié ou supprimé. */
  onMessageUpdated(message: Message): void
  onReaction(change: ReactionChange): void
  onPresence(onlineIds: string[]): void
  /** Membres, liens, salons ou projet modifiés : on recharge. */
  onRefresh(): void
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
  /** Range le jeton GitHub de cet appareil sur le compte, ou le récupère du compte. Vrai si GitHub est utilisable. */
  syncGitHub(): Promise<boolean>

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

  /** Invite quelqu'un qui a déjà un compte ; false s'il n'y a pas de compte avec cet email. */
  /** Invite une adresse : email envoyé, et notification « Rejoindre / Refuser » si elle a déjà un compte. */
  inviteByEmail(email: string, role: Role): Promise<{ account: boolean; emailed: boolean }>
  /** Invitations par email en attente dans le projet. */
  listEmailInvites(): Promise<EmailInvite[]>
  cancelEmailInvite(id: string): Promise<void>
  /** À la connexion : les invitations reçues avant d'avoir un compte deviennent des notifications. */
  claimEmailInvites(): Promise<number>
  listInvites(): Promise<Invite[]>
  createInvite(role: Role, opts: { days: number; maxUses: number | null }): Promise<Invite>
  revokeInvite(id: string): Promise<void>
  setMemberRole(memberId: string, role: Role): Promise<void>
  /** Rôle dans l'équipe (Product Owner…), attribué par un admin du projet. */
  setMemberTitle(memberId: string, title: string): Promise<void>
  /** Logo du projet ouvert (ou de `groupId`) ; null le retire. */
  setGroupLogo(file: Blob | null, groupId?: string): Promise<void>
  /** Couleur et rythme du projet ouvert (ou de `groupId`). */
  setGroupPrefs(prefs: GroupPrefs, groupId?: string): Promise<void>
  /** Rôle dans l'équipe donné à une invitation par email en attente. */
  setInviteTitle(email: string, title: string): Promise<void>
  /** Historique des actions de l'équipe, du plus récent au plus ancien. */
  listActivity(limit?: number, before?: string): Promise<ActivityItem[]>

  saveTask(task: Task): Promise<Task>
  deleteTask(id: string): Promise<void>

  listMessages(channelId: string): Promise<Message[]>
  sendMessage(channelId: string, body: string): Promise<Message>
  /** Réactions, modification et suppression disponibles (base à jour). */
  chatActions(): boolean
  editMessage(id: string, body: string): Promise<void>
  /** Supprime son message (récupérable par la base). */
  deleteMessage(id: string): Promise<void>
  /** Ajoute ou retire sa réaction. */
  react(messageId: string, emoji: string, on: boolean): Promise<void>

  addLink(title: string, url: string): Promise<LinkItem>
  createChannel(name: string): Promise<Channel>

  /** Corbeille du projet ouvert (null si la base ne la connaît pas encore). */
  listTrash(): Promise<TrashItem[] | null>
  restoreItem(kind: TrashItem['kind'], id: string): Promise<void>
  /** Projets supprimés dont on était admin. */
  listDeletedGroups(): Promise<{ id: string; name: string; deletedAt: string }[]>
  restoreGroup(id: string): Promise<void>
  removeLink(id: string): Promise<void>
  updateLink(id: string, patch: { title: string; url: string }): Promise<void>

  createSprint(sprint: Omit<Sprint, 'id' | 'closedAt'>): Promise<Sprint>

  createNote(title: string): Promise<Note>
  /** Contenu Yjs du document, encodé en base64 ('' si vide). */
  loadNote(id: string): Promise<string>
  saveNote(id: string, patch: { ystate?: string; preview?: string; title?: string }): Promise<void>
  /** Met le document à la corbeille. */
  removeNote(id: string): Promise<void>
  /**
   * Salle en direct du projet (poker planning…) : messages diffusés à tous et liste des présents.
   * Rien n'est enregistré en base.
   */
  joinRoom(room: string, handlers: RoomHandlers, opts?: { listen?: boolean }): Room
  updateSprint(id: string, patch: Partial<Omit<Sprint, 'id'>>): Promise<void>

  /** Envoie un fichier dans l'espace documents du projet. */
  uploadDocument(file: File): Promise<DocumentItem>
  /** Adresse temporaire pour afficher ou télécharger le fichier. */
  documentUrl(doc: DocumentItem): Promise<string>
  renameDocument(id: string, name: string): Promise<void>
  /** Met le document à la corbeille. */
  removeDocument(id: string): Promise<void>

  /** Notifications de l'utilisateur, tous projets confondus (récentes d'abord). */
  listNotifications(): Promise<AppNotification[]>
  markNotificationsRead(ids: string[]): Promise<void>
  deleteNotification(id: string): Promise<void>
  /** Nouvelles notifications en direct. */
  watchNotifications(onNew: (n: AppNotification) => void): () => void
  /** Notifications sur cet appareil (Web Push) : null en démo. */
  push: PushApi | null

  setDiscordWebhook(url: string | null): Promise<void>
  notifyDiscord(event: DiscordEvent): Promise<void>

  /** Serveur Discord relié au projet ouvert et salons reliés. */
  discordState(): Promise<{ guild: DiscordGuild | null; links: DiscordLink[] }>
  /** Ajoute le bot Kollab à un serveur Discord, dans une petite fenêtre (admin, une seule fois). */
  connectDiscord(): Promise<void>
  /** Délie le serveur et tous les salons. */
  disconnectDiscord(): Promise<void>
  /** Salons texte du serveur relié. */
  listDiscordChannels(): Promise<DiscordChannel[]>
  /** Relie un salon Kollab à un salon Discord existant, ou à un nouveau salon du même nom (`null`). */
  linkDiscordChannel(channelId: string, discordChannelId: string | null): Promise<DiscordLink>
  unlinkDiscordChannel(channelId: string): Promise<void>
}

export interface PushApi {
  publicKey(): Promise<string>
  subscribe(sub: PushSubscriptionJSON): Promise<void>
  unsubscribe(endpoint: string): Promise<void>
  /** Envoie une notification d'essai ; renvoie le nombre d'appareils atteints. */
  test(): Promise<number>
}

export function newId(): string {
  return crypto.randomUUID()
}
