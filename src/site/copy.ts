/**
 * Textes du site vitrine en français et en anglais.
 * Les pages anglaises vivent sous /en, avec des adresses en anglais.
 */
export type Lang = 'fr' | 'en'

export type PageKey = 'home' | 'features' | 'audience' | 'compare' | 'pricing' | 'download' | 'news' | 'faq'

/** Adresse de chaque page dans chaque langue. */
export const ROUTES: Record<PageKey, Record<Lang, string>> = {
  home: { fr: '/', en: '/en' },
  features: { fr: '/fonctionnalites', en: '/en/features' },
  audience: { fr: '/pour-qui', en: '/en/who-its-for' },
  compare: { fr: '/comparatif', en: '/en/compare' },
  pricing: { fr: '/tarifs', en: '/en/pricing' },
  download: { fr: '/telecharger', en: '/en/download' },
  news: { fr: '/nouveautes', en: '/en/changelog' },
  faq: { fr: '/faq', en: '/en/faq' },
}

/** Retrouve la page et la langue à partir d'une adresse (sans barre finale). */
export function matchRoute(path: string): { key: PageKey; lang: Lang } | null {
  const p = path === '' ? '/' : path
  for (const key of Object.keys(ROUTES) as PageKey[]) {
    for (const lang of ['fr', 'en'] as Lang[]) {
      if (ROUTES[key][lang] === p) return { key, lang }
    }
  }
  return null
}

export const langOf = (path: string): Lang => (path === '/en' || path.startsWith('/en/') ? 'en' : 'fr')

type Cell = boolean | 'soon' | 'part'

const fr = {
  nav: { features: 'Fonctionnalités', audience: 'Pour qui', compare: 'Comparatif', pricing: 'Tarifs', download: 'Télécharger', faq: 'FAQ' },
  langSwitch: { label: 'EN', title: 'Read this page in English' },
  header: { home: 'Kollab, accueil', login: 'Connexion', try: 'Essayer', trySuffix: ' gratuitement' },
  footer: {
    tag: "Le code, les sprints et l'équipe au même endroit.",
    product: 'Produit',
    openApp: "Ouvrir l'app",
    demo: 'Démo sans compte',
    news: 'Nouveautés',
    faq: 'Questions fréquentes',
    legal: 'Légal',
    legalNote: '',
  },
  soon: 'Bientôt',
  hero: {
    titleA: 'Le code, les sprints ',
    titleHl: "et l'équipe.",
    titleB: ' Au même endroit.',
    lead: "Tableau Scrum, chat d'équipe et bientôt relecture des PR. Gratuit, sur web, téléphone et ordinateur.",
    signup: 'Créer mon compte',
    demo: "Essayer sans s'inscrire",
    video: 'Démonstration : une tâche glissée de colonne en colonne, puis attribuée à Léa',
    you: 'Toi',
  },
  product: {
    kicker: 'Le produit',
    title: 'Fait pour les équipes qui livrent du code ensemble.',
    board: {
      title: "Le sprint, visible d'un coup d'œil.",
      text: 'Glisse les tâches, vois la charge de chacun, estime en points.',
      alt: "Attribution d'une tâche avec la charge de chaque membre",
    },
    chat: {
      title: 'Une discussion qui reste liée au travail.',
      textA: 'Salons, mentions, cartes de PR et commande ',
      code: '/tache',
      textB: '. En direct, et sur Discord si tu veux.',
      video: 'Démonstration : un message avec une mention, puis une tâche créée avec /tache',
    },
    phone: {
      title: 'Dans ta poche aussi.',
      text: 'Une vraie app sur ton téléphone, même hors ligne.',
      video: "Démonstration sur téléphone : l'accueil, une tâche ouverte, puis un message envoyé dans le chat",
    },
    pr: {
      title: 'Relire les PR sans quitter Kollab.',
      text: 'Diff, commentaires, approbation. La tâche se termine quand la PR est fusionnée.',
      prTitle: 'Tableau kanban glisser-déposer',
      approved: 'Approuvée',
      comment: 'Bien vu pour les capteurs, ça règle le souci sur iPhone.',
    },
  },
  more: {
    kicker: 'Et aussi',
    items: [
      { title: 'Poker planning', text: 'Tout le monde vote, les cartes se retournent ensemble.', soon: true },
      { title: 'Édition en direct', text: 'Specs et notes écrites à plusieurs.', soon: true },
      { title: 'PDF partagés', text: 'Le cahier des charges à côté du tableau.', soon: true },
      { title: 'Discord', text: 'Tâches, PR et mentions dans ton serveur.' },
      { title: 'Liens importants', text: 'Dépôt, maquettes, doc : au même endroit.' },
      { title: 'Thèmes', text: 'Cinq thèmes, ta couleur, mode sombre.' },
    ] as { title: string; text: string; soon?: boolean }[],
  },
  integrations: {
    kicker: 'Intégrations',
    title: 'Branché sur les outils que tu utilises déjà.',
    items: [
      { name: 'GitHub', text: 'Connexion et cartes de PR. Relecture bientôt.', color: '#0F0F14' },
      { name: 'Discord', text: 'Connexion et notifications dans ton serveur.', color: '#5865F2' },
      { name: 'Google', text: 'Connexion en un clic.', color: '#1F5FC4' },
    ],
  },
  download: {
    kicker: 'App de bureau',
    title: 'Kollab dans sa propre fenêtre.',
    ready: 'Raccourcis, notifications, mises à jour auto.',
    notReady: 'Bientôt. En attendant, Kollab marche dans le navigateur.',
    mine: 'Ton système',
    go: 'Télécharger ↓',
    os: {
      windows: 'Windows 10 et 11 · .exe',
      mac: 'Puces Apple et Intel · .dmg',
      linux: 'AppImage et .deb',
    },
  },
  steps: {
    kicker: 'Démarrer',
    items: [
      { b: 'Connecte-toi', t: ' avec GitHub, Google, Discord ou un email.' },
      { b: 'Invite ton équipe', t: ' avec le lien du groupe.' },
      { b: 'Lance le sprint', t: '.' },
    ],
  },
  pricing: {
    kicker: 'Tarifs',
    title: 'Gratuit pendant la bêta.',
    sub: 'Toutes les fonctions, sans carte bancaire.',
    price: '0 €',
    per: 'par personne, par mois',
    cta: 'Créer mon groupe',
    list: [
      'Groupes et membres sans limite fixe',
      'Tableau, chat, liens et notifications Discord',
      'Web, téléphone et ordinateur',
      'Les nouvelles fonctions dès leur sortie',
      "Données hébergées dans l'Union européenne",
    ],
  },
  roadmap: {
    kicker: 'Feuille de route',
    title: 'Ce qui arrive dans Kollab.',
    cols: [
      { when: 'Disponible', color: 'k-bg-mint', items: ['Tableau kanban et attribution', 'Chat avec salons et mentions', 'Invitations et rôles', 'Notifications Discord', 'App téléphone et ordinateur'] },
      { when: 'Ensuite', color: 'k-bg-yellow', items: ['Relecture des PR GitHub', 'Sprints, burndown et vélocité', 'Poker planning en direct', 'Salons vocaux'] },
      { when: 'Plus tard', color: 'k-bg-lilac', items: ['Documents à plusieurs en direct', 'PDF annotés ensemble', 'Recherche globale Ctrl+K', 'Tableaux blancs'] },
    ],
    history: "Voir l'historique des versions →",
  },
  faq: {
    kicker: 'Questions fréquentes',
    title: 'Tu te demandes peut-être…',
    items: [
      { q: 'Kollab est-il gratuit ?', a: "Oui, pendant toute la bêta. Une éventuelle offre payante serait annoncée à l'avance, et la version gratuite resterait." },
      { q: 'Faut-il installer quelque chose ?', a: "Non, Kollab marche dans le navigateur. Il existe aussi en app pour téléphone et ordinateur." },
      { q: 'Puis-je essayer sans créer de compte ?', a: 'Oui. La démo ouvre une équipe d’exemple avec une visite guidée. Rien n’est enregistré.' },
      { q: 'Combien de personnes dans un groupe ?', a: 'Pas de limite pendant la bêta. Kollab est pensé pour 2 à 15 personnes.' },
      { q: 'Où sont stockées mes données ?', a: 'À Paris, chez Supabase. Chaque groupe ne voit que ses données.' },
      { q: 'Faut-il un compte GitHub ?', a: "Non. Google, Discord ou un email suffisent. GitHub sert seulement pour les PR." },
      { q: 'Comment inviter mon équipe ?', a: "Page Groupe : crée un lien d'invitation, choisis le rôle, partage-le." },
    ],
  },
  final: { title: 'Lance ton prochain sprint sur Kollab.', try: 'Essayer gratuitement', demo: 'Voir la démo', discord: 'Rejoindre le Discord' },
  teasers: {
    go: 'Voir →',
    items: [
      { key: 'features', title: 'Toutes les fonctionnalités', text: 'Tableau, chat, intégrations, feuille de route.', bg: 'k-bg-yellow' },
      { key: 'pricing', title: 'Tarifs', text: 'Gratuit pendant la bêta.', bg: 'k-bg-mint' },
      { key: 'download', title: 'Télécharger', text: 'Windows, macOS, Linux et téléphone.', bg: 'k-bg-lilac' },
    ] as { key: PageKey; title: string; text: string; bg: string }[],
  },
  pages: {
    features: { kicker: 'Fonctionnalités', title: "Tout ce qu'il faut pour livrer à plusieurs.", lead: 'Ce qui marche déjà, et ce qui arrive.' },
    pricing: { kicker: 'Tarifs', title: "Simple : c'est gratuit.", lead: 'Toutes les fonctions, pendant toute la bêta.' },
    download: { kicker: 'Télécharger', title: 'Kollab, partout où tu travailles.', lead: 'Navigateur, téléphone, Windows, macOS et Linux.' },
    faq: { kicker: 'Questions fréquentes', title: "Les réponses aux questions qu'on nous pose." },
    audience: { kicker: 'Pour qui', title: 'Pensé pour les équipes qui codent ensemble.', lead: 'De 2 à 15 personnes. Trois exemples.' },
    compare: { kicker: 'Comparatif', title: 'Un seul outil à la place de quatre.', lead: "Trello, Notion et Discord en un seul outil." },
  },
  audiences: [
    {
      bg: 'k-bg-yellow',
      who: 'Projets étudiants',
      title: "Le projet de fin d'année, sans le chaos.",
      story: 'Quatre étudiants, six semaines, un rendu. Chacun sait qui fait quoi.',
      points: ['Invitations par lien en 10 secondes', 'Charge visible pour éviter qu’un seul fasse tout', 'Gratuit, sans carte bancaire'],
    },
    {
      bg: 'k-bg-coral',
      who: 'Petites équipes de dev',
      title: 'Le sprint et les PR au même endroit.',
      story: 'Cinq devs qui jonglaient entre Trello, GitHub et Discord. Tout est maintenant au même endroit.',
      points: ['Cartes de PR dans les conversations', 'Notifications dans Discord', 'App sur ordinateur et téléphone'],
    },
    {
      bg: 'k-bg-mint',
      who: 'Associations tech',
      title: 'Des bénévoles qui avancent ensemble.',
      story: "Des bénévoles qui changent chaque année. Les nouveaux retrouvent tout dans l'historique.",
      points: ['Rôles et invités en lecture seule', 'Salons par sujet', 'Liens importants épinglés'],
    },
  ],
  compare: {
    head: 'Fonction',
    yes: 'Oui',
    no: 'Non',
    part: 'En partie',
    rows: [
      'Tableau kanban',
      'Attribution avec la charge de chacun',
      'Chat d’équipe en direct',
      'Cartes de PR GitHub dans le chat',
      'Relecture des PR',
      'Sprints et poker planning',
      'Documents à plusieurs',
      'Appels vocaux',
      'Gratuit pour toute l’équipe',
    ],
    note: '« En partie » : via une extension, une offre payante ou de façon limitée. Offres gratuites, novembre 2026. Les marques citées appartiennent à leurs propriétaires.',
  },
  news: { kicker: 'Nouveautés', title: 'Ce qui a changé dans Kollab.', next: 'Voir ce qui arrive ensuite →', locale: 'fr-FR' },
  waitlist: {
    title: 'Reçois les nouveautés.',
    text: 'Un email par grosse nouveauté. Un par mois au plus.',
    label: 'Adresse email',
    placeholder: 'toi@exemple.fr',
    submit: "M'inscrire",
    sending: 'Envoi…',
    done: "C'est noté.",
    error: 'Échec. Réessaie dans un instant.',
    legal: 'Uniquement pour ces emails. Désinscription à tout moment.',
    privacy: 'Confidentialité',
  },
}

export type Copy = typeof fr

const en: Copy = {
  nav: { features: 'Features', audience: "Who it's for", compare: 'Compare', pricing: 'Pricing', download: 'Download', faq: 'FAQ' },
  langSwitch: { label: 'FR', title: 'Lire cette page en français' },
  header: { home: 'Kollab, home', login: 'Log in', try: 'Try it', trySuffix: ' free' },
  footer: {
    tag: 'Code, sprints and your team in one place.',
    product: 'Product',
    openApp: 'Open the app',
    demo: 'Demo, no account',
    news: 'Changelog',
    faq: 'FAQ',
    legal: 'Legal',
    legalNote: 'in French',
  },
  soon: 'Soon',
  hero: {
    titleA: 'Code, sprints ',
    titleHl: 'and your team.',
    titleB: ' In one place.',
    lead: 'Scrum board, team chat and soon PR reviews. Free, on web, phone and desktop.',
    signup: 'Create my account',
    demo: 'Try it without signing up',
    video: 'Demo: a task dragged from column to column, then assigned to Léa',
    you: 'You',
  },
  product: {
    kicker: 'The product',
    title: 'Built for teams that ship code together.',
    board: {
      title: 'Your sprint at a glance.',
      text: "Drag tasks, see everyone's workload, estimate in points.",
      alt: "Assigning a task while seeing each member's workload",
    },
    chat: {
      title: 'Conversations that stay tied to the work.',
      textA: 'Channels, mentions, PR cards and the ',
      code: '/tache',
      textB: ' command. Live, and on Discord if you want.',
      video: 'Demo: a message with a mention, then a task created with /tache',
    },
    phone: {
      title: 'In your pocket too.',
      text: 'A real app on your phone, even offline.',
      video: 'Phone demo: the home screen, an open task, then a message sent in the chat',
    },
    pr: {
      title: 'Review PRs without leaving Kollab.',
      text: 'Diffs, comments, approval. The task closes when the PR merges.',
      prTitle: 'Drag-and-drop kanban board',
      approved: 'Approved',
      comment: 'Nice catch on the sensors, that fixes the iPhone issue.',
    },
  },
  more: {
    kicker: 'And also',
    items: [
      { title: 'Planning poker', text: 'Everyone votes, the cards flip together.', soon: true },
      { title: 'Live editing', text: 'Specs and notes written together.', soon: true },
      { title: 'Shared PDFs', text: 'The spec next to the board.', soon: true },
      { title: 'Discord', text: 'Tasks, PRs and mentions in your server.' },
      { title: 'Key links', text: 'Repo, mockups, docs: in one place.' },
      { title: 'Themes', text: 'Five themes, your color, dark mode.' },
    ],
  },
  integrations: {
    kicker: 'Integrations',
    title: 'Plugged into the tools you already use.',
    items: [
      { name: 'GitHub', text: 'Sign-in and PR cards. Reviews soon.', color: '#0F0F14' },
      { name: 'Discord', text: 'Sign-in and notifications in your server.', color: '#5865F2' },
      { name: 'Google', text: 'One-click sign-in.', color: '#1F5FC4' },
    ],
  },
  download: {
    kicker: 'Desktop app',
    title: 'Kollab in its own window.',
    ready: 'Shortcuts, notifications, auto updates.',
    notReady: 'Soon. Meanwhile, Kollab works in your browser.',
    mine: 'Your system',
    go: 'Download ↓',
    os: {
      windows: 'Windows 10 and 11 · .exe',
      mac: 'Apple silicon and Intel · .dmg',
      linux: 'AppImage and .deb',
    },
  },
  steps: {
    kicker: 'Get started',
    items: [
      { b: 'Sign in', t: ' with GitHub, Google, Discord or an email.' },
      { b: 'Invite your team', t: ' with the group link.' },
      { b: 'Start the sprint', t: '.' },
    ],
  },
  pricing: {
    kicker: 'Pricing',
    title: 'Free during the beta.',
    sub: 'Every feature, no credit card.',
    price: '€0',
    per: 'per person, per month',
    cta: 'Create my group',
    list: [
      'No fixed limit on groups or members',
      'Board, chat, links and Discord notifications',
      'Web, phone and desktop',
      'New features as soon as they ship',
      'Data hosted in the European Union',
    ],
  },
  roadmap: {
    kicker: 'Roadmap',
    title: "What's coming to Kollab.",
    cols: [
      { when: 'Available', color: 'k-bg-mint', items: ['Kanban board and assignment', 'Chat with channels and mentions', 'Invitations and roles', 'Discord notifications', 'Phone and desktop apps'] },
      { when: 'Next', color: 'k-bg-yellow', items: ['GitHub PR reviews', 'Sprints, burndown and velocity', 'Live planning poker', 'Voice channels'] },
      { when: 'Later', color: 'k-bg-lilac', items: ['Live collaborative documents', 'PDFs annotated together', 'Global search with Ctrl+K', 'Whiteboards'] },
    ],
    history: 'See the release history →',
  },
  faq: {
    kicker: 'FAQ',
    title: 'You might be wondering…',
    items: [
      { q: 'Is Kollab free?', a: 'Yes, for the whole beta. Any paid plan would be announced in advance, and the free version would stay.' },
      { q: 'Do I need to install anything?', a: 'No, Kollab works in the browser. There are also phone and desktop apps.' },
      { q: 'Can I try it without an account?', a: 'Yes. The demo opens a sample team with a guided tour. Nothing is saved.' },
      { q: 'How many people per group?', a: 'No limit during the beta. Kollab is built for 2 to 15 people.' },
      { q: 'Where is my data stored?', a: 'In Paris, with Supabase. Each group only sees its own data.' },
      { q: 'Do I need a GitHub account?', a: 'No. Google, Discord or an email works. GitHub is only for PRs.' },
      { q: 'How do I invite my team?', a: 'Group page: create an invite link, pick a role, share it.' },
    ],
  },
  final: { title: 'Run your next sprint on Kollab.', try: 'Try it free', demo: 'See the demo', discord: 'Join the Discord' },
  teasers: {
    go: 'See →',
    items: [
      { key: 'features', title: 'All features', text: 'Board, chat, integrations, roadmap.', bg: 'k-bg-yellow' },
      { key: 'pricing', title: 'Pricing', text: 'Free during the beta.', bg: 'k-bg-mint' },
      { key: 'download', title: 'Download', text: 'Windows, macOS, Linux and phone.', bg: 'k-bg-lilac' },
    ],
  },
  pages: {
    features: { kicker: 'Features', title: 'Everything you need to ship together.', lead: "What works today, and what's next." },
    pricing: { kicker: 'Pricing', title: "Simple: it's free.", lead: 'Every feature, for the whole beta.' },
    download: { kicker: 'Download', title: 'Kollab, wherever you work.', lead: 'Browser, phone, Windows, macOS and Linux.' },
    faq: { kicker: 'FAQ', title: 'Answers to the questions we get.' },
    audience: { kicker: "Who it's for", title: 'Made for teams that code together.', lead: 'From 2 to 15 people. Three examples.' },
    compare: { kicker: 'Compare', title: 'One tool instead of four.', lead: 'Trello, Notion and Discord in one tool.' },
  },
  audiences: [
    {
      bg: 'k-bg-yellow',
      who: 'Student projects',
      title: 'The final-year project, without the chaos.',
      story: 'Four students, six weeks, one deliverable. Everyone knows who does what.',
      points: ['Invite links in 10 seconds', 'Visible workload so one person doesn’t do it all', 'Free, no credit card'],
    },
    {
      bg: 'k-bg-coral',
      who: 'Small dev teams',
      title: 'Sprints and PRs in one place.',
      story: 'Five devs who juggled Trello, GitHub and Discord. Now it’s all in one place.',
      points: ['PR cards in conversations', 'Notifications in Discord', 'Desktop and phone apps'],
    },
    {
      bg: 'k-bg-mint',
      who: 'Tech nonprofits',
      title: 'Volunteers moving forward together.',
      story: 'Volunteers who change every year. Newcomers find everything in the history.',
      points: ['Roles and read-only guests', 'Channels by topic', 'Pinned key links'],
    },
  ],
  compare: {
    head: 'Feature',
    yes: 'Yes',
    no: 'No',
    part: 'Partly',
    rows: [
      'Kanban board',
      "Assignment with everyone's workload",
      'Live team chat',
      'GitHub PR cards in the chat',
      'PR reviews',
      'Sprints and planning poker',
      'Collaborative documents',
      'Voice calls',
      'Free for the whole team',
    ],
    note: '“Partly”: via an add-on, a paid plan or limited. Free plans, November 2026. Trademarks belong to their owners.',
  },
  news: { kicker: 'Changelog', title: "What's new in Kollab.", next: "See what's coming next →", locale: 'en-GB' },
  waitlist: {
    title: 'Get the news.',
    text: 'One email per big feature. One a month at most.',
    label: 'Email address',
    placeholder: 'you@example.com',
    submit: 'Sign me up',
    sending: 'Sending…',
    done: "You're on the list.",
    error: 'Failed. Try again in a moment.',
    legal: 'Only for these emails. Unsubscribe anytime.',
    privacy: 'Privacy (in French)',
  },
}

export const COPY: Record<Lang, Copy> = { fr, en }

/** Valeurs du comparatif, dans l'ordre des lignes de copy.compare.rows. */
export const COMPARE_CELLS: { kollab: Cell; trello: Cell; jira: Cell; notion: Cell; discord: Cell }[] = [
  { kollab: true, trello: true, jira: true, notion: true, discord: false },
  { kollab: true, trello: false, jira: 'part', notion: false, discord: false },
  { kollab: true, trello: false, jira: false, notion: 'part', discord: true },
  { kollab: true, trello: false, jira: false, notion: false, discord: 'part' },
  { kollab: 'soon', trello: false, jira: false, notion: false, discord: false },
  { kollab: 'soon', trello: false, jira: 'part', notion: false, discord: false },
  { kollab: 'soon', trello: false, jira: false, notion: true, discord: false },
  { kollab: 'soon', trello: false, jira: false, notion: false, discord: true },
  { kollab: true, trello: 'part', jira: 'part', notion: 'part', discord: true },
]
export type { Cell }

/** Traductions anglaises de l'historique des versions (src/changelog.json reste en français). */
export const CHANGELOG_EN: Record<string, { title: string; items: string[] }> = {
  '0.1.0': {
    title: 'First release',
    items: [
      'Kanban board with drag and drop and task assignment',
      'Group chat with channels, mentions, PR links and /tache',
      'Invitations with permissions (Admin, Member, Guest)',
      'Editable profile: photo, name, role, status and color',
      'Sign in with GitHub, Google, Discord or a Kollab account',
      'Themes, Discord notifications and desktop app for Windows, Mac and Linux',
    ],
  },
}
