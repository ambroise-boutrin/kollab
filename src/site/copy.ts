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
  header: { home: 'Kollab, accueil', login: 'Connexion', try: 'Essayer', trySuffix: 'gratuitement', menu: 'Menu', close: 'Fermer' },
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
    lead: "Tableau Scrum, chat d'équipe et relecture des PR. Gratuit, sur web, téléphone et ordinateur.",
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
      text: 'Une vraie app sur ton téléphone. Hors ligne, tout part au retour du réseau.',
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
      { title: 'Poker planning', text: 'Tout le monde vote, les cartes se retournent ensemble.' },
      { title: 'Documents à plusieurs', text: 'Specs, notes, PDF et images, écrits ensemble.' },
      { title: 'Vocal et visio', text: "Appel, caméra et partage d'écran." },
      { title: 'Feuille de route', text: 'Sprints et grosses tâches sur une frise.' },
      { title: 'Échéances', text: 'Retards en rouge, commentaires avec @mentions.' },
      { title: 'Statut perso', text: 'En réunion, Focus, ou ton message.' },
      { title: 'Résumé du lundi', text: 'Ta semaine par email.' },
      { title: 'Recherche Ctrl+K', text: 'Tâches, messages et docs.' },
      { title: 'Thèmes', text: 'Ta couleur, clair, sombre ou auto.' },
    ] as { title: string; text: string; soon?: boolean }[],
  },
  integrations: {
    kicker: 'Intégrations',
    title: 'Branché sur les outils que tu utilises déjà.',
    items: [
      { name: 'GitHub', text: 'Relecture des PR. La tâche se ferme à la fusion.', color: '#0F0F14' },
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
      'Tableau, sprints, chat, vocal et documents',
      'Web, téléphone et ordinateur',
      'Les nouvelles fonctions dès leur sortie',
      "Données hébergées dans l'Union européenne",
    ],
  },
  roadmap: {
    kicker: 'Feuille de route',
    title: 'Ce qui arrive dans Kollab.',
    cols: [
      { when: 'Disponible', color: 'k-bg-mint', items: ['Tableau, sprints et poker planning', 'Chat, vocal et visio', 'Relecture des PR GitHub', 'Documents à plusieurs', 'Feuille de route et échéances', 'Hors ligne et résumé du lundi'] },
      { when: 'Ensuite', color: 'k-bg-yellow', items: ['Salons Discord reliés au chat'] },
      { when: 'Plus tard', color: 'k-bg-lilac', items: ['PDF annotés ensemble', 'Tableaux blancs'] },
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
      { q: 'Et sans réseau ?', a: 'Tu continues. Tout part au retour du réseau.' },
      { q: 'Comment inviter mon équipe ?', a: "Page Groupe : crée un lien d'invitation, choisis le rôle, partage-le." },
    ],
  },
  final: { sub: 'Gratuit pendant la bêta.', title: 'Lance ton prochain sprint sur Kollab.', try: 'Essayer gratuitement', demo: 'Voir la démo', discord: 'Rejoindre le Discord' },
  home: {
    tabsKicker: 'Le produit',
    tabsTitle: 'Tout le projet. Un seul endroit.',
    tabsSub: 'Tableau, chat, téléphone et revue de PR.',
    tabs: ['Tableau', 'Chat', 'Téléphone', 'Revue de PR'],
    marquee: ['Kanban', 'Chat', 'Revues de PR', 'Sprints', 'Poker planning', 'Vocal', 'Feuille de route', 'Ctrl+K', 'Discord', 'GitHub', 'Hors ligne'],
    marqueeLabel: 'Ce que fait Kollab',
    statementA: 'Moins d’onglets.',
    statementB: 'Plus de code livré.',
    pause: 'Mettre en pause',
    play: 'Relancer',
    stats: [
      { n: '0 €', l: 'pendant la bêta' },
      { n: '2 à 15', l: 'personnes par équipe' },
      { n: '3', l: 'web, téléphone, ordinateur' },
    ],
    casesKicker: 'Pour qui',
    casesTitle: 'Pour les équipes qui codent.',
    casesSub: 'Projets étudiants, startups, associations.',
    casesMore: 'Voir les exemples →',
    prev: 'Précédent',
    next: 'Suivant',
    explore: 'Voir les fonctionnalités →',
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
      points: ['Invitations par lien en 10 secondes', 'Échéances visibles, retards en rouge', 'Charge visible pour éviter qu’un seul fasse tout'],
    },
    {
      bg: 'k-bg-coral',
      who: 'Petites équipes de dev',
      title: 'Le sprint et les PR au même endroit.',
      story: 'Cinq devs qui jonglaient entre Trello, GitHub et Discord. Tout est maintenant au même endroit.',
      points: ['Tâche fermée à la fusion de la PR', 'Notifications dans Discord', 'App sur ordinateur et téléphone'],
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
  header: { home: 'Kollab, home', login: 'Log in', try: 'Try it', trySuffix: 'free', menu: 'Menu', close: 'Close' },
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
    lead: 'Scrum board, team chat and PR reviews. Free, on web, phone and desktop.',
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
      text: 'A real app on your phone. Offline, everything syncs when you are back.',
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
      { title: 'Planning poker', text: 'Everyone votes, the cards flip together.' },
      { title: 'Shared documents', text: 'Specs, notes, PDFs and images, written together.' },
      { title: 'Voice and video', text: 'Calls, camera and screen sharing.' },
      { title: 'Roadmap', text: 'Sprints and big tasks on a timeline.' },
      { title: 'Due dates', text: 'Late tasks in red, comments with @mentions.' },
      { title: 'Personal status', text: 'In a meeting, Focus, or your own message.' },
      { title: 'Monday summary', text: 'Your week by email.' },
      { title: 'Ctrl+K search', text: 'Tasks, messages and docs.' },
      { title: 'Themes', text: 'Your color, light, dark or auto.' },
    ],
  },
  integrations: {
    kicker: 'Integrations',
    title: 'Plugged into the tools you already use.',
    items: [
      { name: 'GitHub', text: 'PR reviews. The task closes when it merges.', color: '#0F0F14' },
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
      'Board, sprints, chat, voice and documents',
      'Web, phone and desktop',
      'New features as soon as they ship',
      'Data hosted in the European Union',
    ],
  },
  roadmap: {
    kicker: 'Roadmap',
    title: "What's coming to Kollab.",
    cols: [
      { when: 'Available', color: 'k-bg-mint', items: ['Board, sprints and planning poker', 'Chat, voice and video', 'GitHub PR reviews', 'Shared documents', 'Roadmap and due dates', 'Offline mode and Monday summary'] },
      { when: 'Next', color: 'k-bg-yellow', items: ['Discord channels linked to the chat'] },
      { when: 'Later', color: 'k-bg-lilac', items: ['PDFs annotated together', 'Whiteboards'] },
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
      { q: 'What if I lose my connection?', a: 'Keep working. Everything syncs when you are back online.' },
      { q: 'How do I invite my team?', a: 'Group page: create an invite link, pick a role, share it.' },
    ],
  },
  final: { sub: 'Free during the beta.', title: 'Run your next sprint on Kollab.', try: 'Try it free', demo: 'See the demo', discord: 'Join the Discord' },
  home: {
    tabsKicker: 'The product',
    tabsTitle: 'The whole project. One place.',
    tabsSub: 'Board, chat, phone and PR review.',
    tabs: ['Board', 'Chat', 'Phone', 'PR review'],
    marquee: ['Kanban', 'Chat', 'PR reviews', 'Sprints', 'Planning poker', 'Voice', 'Roadmap', 'Ctrl+K', 'Discord', 'GitHub', 'Offline'],
    marqueeLabel: 'What Kollab does',
    statementA: 'Fewer tabs.',
    statementB: 'More shipped code.',
    pause: 'Pause',
    play: 'Play',
    stats: [
      { n: '€0', l: 'during the beta' },
      { n: '2 to 15', l: 'people per team' },
      { n: '3', l: 'web, phone, desktop' },
    ],
    casesKicker: "Who it's for",
    casesTitle: 'For teams that code.',
    casesSub: 'Student projects, startups, nonprofits.',
    casesMore: 'See examples →',
    prev: 'Previous',
    next: 'Next',
    explore: 'See all features →',
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
      points: ['Invite links in 10 seconds', 'Due dates, late tasks in red', 'Visible workload so one person doesn’t do it all'],
    },
    {
      bg: 'k-bg-coral',
      who: 'Small dev teams',
      title: 'Sprints and PRs in one place.',
      story: 'Five devs who juggled Trello, GitHub and Discord. Now it’s all in one place.',
      points: ['Task closed when the PR merges', 'Notifications in Discord', 'Desktop and phone apps'],
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
  { kollab: true, trello: false, jira: false, notion: false, discord: false },
  { kollab: true, trello: false, jira: 'part', notion: false, discord: false },
  { kollab: true, trello: false, jira: false, notion: true, discord: false },
  { kollab: true, trello: false, jira: false, notion: false, discord: true },
  { kollab: true, trello: 'part', jira: 'part', notion: 'part', discord: true },
]
export type { Cell }

/** Traductions anglaises de l'historique des versions (src/changelog.json reste en français). */
export const CHANGELOG_EN: Record<string, { title: string; items: string[] }> = {
  '0.6.2': {
    title: 'Tester feedback',
    items: [
      'Due dates on tasks, with a calendar and late tasks in red',
      'Due dates block on the home page: late and this week',
      'Comments on tasks, with @mentions',
      'PR state on cards: checks, merged, draft',
      'Same numbers everywhere, with what they count',
      'Student project template: tasks land in sprint 1',
    ],
  },
  '0.6.1': {
    title: 'GitHub linked once and for all',
    items: [
      'GitHub, Google or Discord sign-in in a small window, without leaving Kollab',
      'On desktop, sign-in opens in the browser and the app picks up on its own',
      'Your GitHub account on every device, no need to link it again',
    ],
  },
  '0.6.0': {
    title: 'Your week at a glance',
    items: [
      'Roadmap: sprints and big tasks on a timeline',
      'Personal status with a duration: In a meeting, Focus, or your own message',
      'Pick your main color, light, dark or auto',
      'Edit mode for the home page: drag, resize, hide',
      'A task closes on its own when its PR merges',
      'Offline: keep working, everything syncs when you are back',
      'Monday summary by email',
    ],
  },
  '0.5.3': {
    title: 'A project off to a good start',
    items: [
      'Six-step project setup: name, template, GitHub repo, team, rhythm, Discord',
      'Project color and role set right in the invitation',
      'First sprint created with the length you chose',
      'Full-screen task view on phone',
      'Your projects as big cards, cleaner phone home',
    ],
  },
  '0.5.2': {
    title: 'Every project has its own face',
    items: [
      'Project logo, or a visual of its own for each project',
      'Team activity history',
      'Team roles assigned by admins',
      'Inputs in a centered window, above the keyboard',
      'More colorful task view, documents with templates and checkboxes',
      'Redesigned phone home, mobile-style profile',
    ],
  },
  '0.5.1': {
    title: 'Nicer under your thumb',
    items: [
      'Polished phone layout everywhere: header, windows, bottom bar',
      'Board: swipe to scroll, long press to move',
      'Chat: the message box always stays visible',
      '“Undo” right after a deletion',
      'Dark theme fixed in sprints',
    ],
  },
  '0.5.0': {
    title: 'The whole team in one place',
    items: [
      'Sprints: backlog, burndown and velocity',
      'Live planning poker',
      'Documents: PDFs and images, with preview',
      'Write together in the same document',
      'Voice, video and screen sharing',
      'Search everything with Ctrl+K',
      'Chat next to any page, home you can arrange',
      'Notifications on phone',
    ],
  },
  '0.4.0': {
    title: 'More alive',
    items: [
      'Centered task window, more visual',
      'Branch and PR created for you (feature/, fix/) with a branch picker',
      'Chat: reactions, task and PR references, edit and delete your messages',
      'Invitations redone: role, link ready to copy, emails',
      'Detailed project settings: GitHub, integrations, data',
      'Ten project templates',
      'Home: my day and activity',
      'Trash: nothing is lost for 30 days',
    ],
  },
  '0.3.0': {
    title: 'Team and reviews',
    items: [
      'A task can be assigned to several people',
      '“My tasks” filter on the board',
      'Notifications with a badge: assignment, mention, invitation, new member',
      'Email invitation for existing accounts',
      'Everything updates live: tasks, chat, members, links, PRs',
      'Reviews page: colored diff, comments, checks and CI re-runs',
      'Task linked to a real PR, closed when it merges',
      'Custom themes',
    ],
  },
  '0.2.0': {
    title: 'Several projects',
    items: [
      'Several projects per account, with a switcher at the top left',
      'Templates at creation: Scrum, Simple kanban, Student project',
      'Intro on first launch and guided tour',
      'Profile menu, account settings and project settings',
      'Online members at the top right',
      'Kollab menu on Mac',
      'Cleaner design',
    ],
  },
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
