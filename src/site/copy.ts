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
    titleA: 'De la tâche ',
    titleHl: 'à la PR fusionnée.',
    titleB: ' Sans rien recopier.',
    lead: 'Chaque tâche a sa branche et sa PR. Kollab suit les tests et la passe en Terminé à la fusion. Le sprint et le chat sont autour. Gratuit, sur web, téléphone et ordinateur.',
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
      text: 'Glisse les tâches, estime en points, vois la charge de chacun. Kollab prévient si le sprint déborde.',
      alt: "Attribution d'une tâche avec la charge de chaque membre",
    },
    chat: {
      title: 'Une discussion qui reste liée au travail.',
      textA: 'Salons, fichiers, mentions et commande ',
      code: '/tache',
      textB: '. Tes salons Discord arrivent dans le chat, dans les deux sens.',
      video: 'Démonstration : un message avec une mention, puis une tâche créée avec /tache',
    },
    phone: {
      title: 'Dans ta poche aussi.',
      text: 'Une vraie app sur ton téléphone. Hors ligne, tout part au retour du réseau.',
      video: "Démonstration sur téléphone : l'accueil, une tâche ouverte, puis un message envoyé dans le chat",
    },
    docs: {
      title: 'Des documents qui font pro.',
      text: 'Comptes rendus, specs et rétros mis en page. Tape / pour un tableau, une image, une liste. Export PDF en un clic.',
      video: 'Démonstration : un compte rendu, le menu /, puis un tableau rempli',
    },
    calls: {
      title: 'Ça sonne, on décroche.',
      text: "Appels et visio depuis le chat, partage d'écran. Ta présence : Disponible, Occupé, Ne pas déranger.",
      video: "Démonstration : un appel au salon, Léa et Sami décrochent, puis on raccroche",
    },
    home: {
      title: 'Ton accueil, rangé comme tu veux.',
      text: 'Tes tâches, les échéances et l’activité. Déplace et agrandis les blocs.',
      video: "Démonstration : le bloc Échéances déplacé puis agrandi sur l'accueil",
    },
    pr: {
      title: 'Une tâche, sa branche, sa PR.',
      text: 'Branche créée en un clic, tests suivis, diff commenté. Approuve et fusionne sans quitter Kollab : la tâche passe en Terminé.',
      video: 'Démonstration : une PR, ses tests, puis Approuver et Fusionner. La tâche passe en Terminé',
    },
  },
  more: {
    kicker: 'Et aussi',
    items: [
      { title: 'Poker planning', text: 'Tout le monde vote, les cartes se retournent ensemble.' },
      { title: 'Feuille de route', text: 'Sprints et grosses tâches sur une frise.' },
      { title: 'Échéances', text: 'Retards en rouge, commentaires avec @mentions.' },
      { title: 'Export PDF', text: 'Sprints et documents, prêts à envoyer.' },
      { title: 'Écrire à plusieurs', text: 'Chacun voit le curseur des autres.' },
      { title: 'Résumé du lundi', text: 'Ta semaine par email.' },
      { title: 'Recherche Ctrl+K', text: 'Tâches, messages et docs.' },
      { title: 'Corbeille', text: 'Rien n’est perdu pendant 30 jours.' },
      { title: 'Thèmes', text: 'Ta couleur, clair, sombre ou auto.' },
    ] as { title: string; text: string; soon?: boolean }[],
  },
  integrations: {
    kicker: 'Intégrations',
    title: 'Branché sur les outils que tu utilises déjà.',
    items: [
      { name: 'GitHub', text: 'Relire, approuver, fusionner. La tâche se ferme seule.', color: '#0F0F14' },
      { name: 'Discord', text: 'Tes salons reliés au chat, fichiers compris.', color: '#5865F2' },
      { name: 'Google', text: 'Connexion en un clic.', color: '#1F5FC4' },
    ],
  },
  download: {
    kicker: 'Installer',
    title: 'Kollab en un clic.',
    lead: 'Rien à télécharger. Mises à jour automatiques.',
    open: 'Ouvrir dans le navigateur',
    install: 'Installer l’app',
    installed: 'Installé. Kollab est dans tes apps.',
    desktop: 'Ou l’app de bureau',
    ready: 'Raccourcis, notifications, mises à jour auto.',
    notReady: 'Bientôt. En attendant, Kollab marche dans le navigateur.',
    mine: 'Ton système',
    go: 'Télécharger ↓',
    os: {
      windows: 'Windows 10 et 11 · .exe',
      mac: 'Puces Apple et Intel · .dmg',
      linux: 'AppImage',
    },
    alerts: [
      { os: 'Windows', t: 'alerte au lancement ? « Informations complémentaires », puis « Exécuter quand même ».' },
      { os: 'macOS', t: 'bloqué ? Réglages, Confidentialité et sécurité, « Ouvrir quand même ».' },
    ],
    help: {
      title: 'Installer Kollab',
      ios: ['Touche Partager', 'Puis « Sur l’écran d’accueil »'],
      safari: ['Menu Fichier', 'Puis « Ajouter au Dock »'],
      android: ['Menu ⋮ du navigateur', 'Puis « Installer l’application »'],
      chrome: ['Icône d’installation dans la barre d’adresse', 'Ou menu ⋮, puis « Installer Kollab »'],
      other: ['Ton navigateur n’installe pas les apps web', 'Ouvre ce site dans Chrome, Edge ou Safari'],
      close: 'Compris',
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
      'Tableau, sprints, chat, appels et documents',
      'Web, téléphone et ordinateur',
      'Les nouvelles fonctions dès leur sortie',
      "Données hébergées dans l'Union européenne",
    ],
  },
  roadmap: {
    kicker: 'Feuille de route',
    title: 'Ce qui arrive dans Kollab.',
    cols: [
      { when: 'Disponible', color: 'k-bg-mint', items: ['Tableau, sprints et poker planning', 'Revues de PR : approuver, fusionner', 'Chat relié aux salons Discord', 'Appels, visio et présence', 'Documents mis en page, export PDF', 'Accueil à ranger, hors ligne'] },
      { when: 'Ensuite', color: 'k-bg-yellow', items: ['Documents en arbre, avec versions', 'Commentaires sur un passage'] },
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
    tabsTitle: 'De la tâche à la fusion.',
    tabsSub: 'Un seul outil au lieu de cinq : tableau, PR, chat, docs et appels.',
    tabs: ['Tâche et PR', 'Tableau', 'Chat', 'Documents', 'Appels', 'Téléphone'],
    marquee: ['Tâche ↔ PR', 'Kanban', 'Revues de PR', 'Sprints', 'Poker planning', 'Chat', 'Discord', 'Appels', 'Documents', 'Export PDF', 'Feuille de route', 'Ctrl+K', 'Hors ligne'],
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
    compare: { kicker: 'Comparatif', title: 'Un seul outil au lieu de cinq.', lead: 'Tableau, revues de PR, chat, documents et appels au même endroit.' },
  },
  audiences: [
    {
      bg: 'k-bg-yellow',
      who: 'Projets étudiants',
      title: "Le projet de fin d'année, sans le chaos.",
      story: 'Quatre étudiants, six semaines, un rendu. Chacun sait qui fait quoi.',
      points: ['Invitations par lien en 10 secondes', 'Charge visible pour éviter qu’un seul fasse tout', 'Comptes rendus exportés en PDF'],
    },
    {
      bg: 'k-bg-coral',
      who: 'Petites équipes de dev',
      title: 'Le sprint et les PR au même endroit.',
      story: 'Cinq devs qui jonglaient entre Trello, GitHub et Discord. Tout est maintenant au même endroit.',
      points: ['PR approuvée et fusionnée dans Kollab', 'Salons Discord reliés au chat', 'Appels et partage d’écran'],
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
      'Appels audio et vidéo',
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
    legalNote: '',
  },
  soon: 'Soon',
  hero: {
    titleA: 'From task ',
    titleHl: 'to merged PR.',
    titleB: ' Nothing to copy.',
    lead: 'Every task gets its branch and its PR. Kollab tracks the checks and moves it to Done when it merges. Sprint and chat built in. Free, on web, phone and desktop.',
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
      text: "Drag tasks, estimate in points, see everyone's workload. Kollab warns you when the sprint is overloaded.",
      alt: "Assigning a task while seeing each member's workload",
    },
    chat: {
      title: 'Conversations that stay tied to the work.',
      textA: 'Channels, files, mentions and the ',
      code: '/tache',
      textB: ' command. Your Discord channels show up in the chat, both ways.',
      video: 'Demo: a message with a mention, then a task created with /tache',
    },
    phone: {
      title: 'In your pocket too.',
      text: 'A real app on your phone. Offline, everything syncs when you are back.',
      video: 'Phone demo: the home screen, an open task, then a message sent in the chat',
    },
    docs: {
      title: 'Documents that look professional.',
      text: 'Meeting notes, specs and retros, nicely laid out. Type / for a table, an image, a list. PDF export in one click.',
      video: 'Demo: meeting notes, the / menu, then a table filled in',
    },
    calls: {
      title: 'It rings, you pick up.',
      text: 'Voice and video calls from the chat, screen sharing. Your presence: Available, Busy, Do not disturb.',
      video: 'Demo: a channel call, Léa and Sami pick up, then we hang up',
    },
    home: {
      title: 'Your home page, arranged your way.',
      text: 'Your tasks, due dates and activity. Move and resize the blocks.',
      video: 'Demo: the Due dates block moved, then resized on the home page',
    },
    pr: {
      title: 'One task, its branch, its PR.',
      text: 'Branch created in one click, checks tracked, diff with comments. Approve and merge without leaving Kollab: the task moves to Done.',
      video: 'Demo: a PR, its checks, then Approve and Merge. The task moves to Done',
    },
  },
  more: {
    kicker: 'And also',
    items: [
      { title: 'Planning poker', text: 'Everyone votes, the cards flip together.' },
      { title: 'Roadmap', text: 'Sprints and big tasks on a timeline.' },
      { title: 'Due dates', text: 'Late tasks in red, comments with @mentions.' },
      { title: 'PDF export', text: 'Sprints and documents, ready to send.' },
      { title: 'Write together', text: "Everyone sees each other's cursor." },
      { title: 'Monday summary', text: 'Your week by email.' },
      { title: 'Ctrl+K search', text: 'Tasks, messages and docs.' },
      { title: 'Trash', text: 'Nothing is lost for 30 days.' },
      { title: 'Themes', text: 'Your color, light, dark or auto.' },
    ],
  },
  integrations: {
    kicker: 'Integrations',
    title: 'Plugged into the tools you already use.',
    items: [
      { name: 'GitHub', text: 'Review, approve, merge. The task closes on its own.', color: '#0F0F14' },
      { name: 'Discord', text: 'Your channels linked to the chat, files included.', color: '#5865F2' },
      { name: 'Google', text: 'One-click sign-in.', color: '#1F5FC4' },
    ],
  },
  download: {
    kicker: 'Install',
    title: 'Kollab in one click.',
    lead: 'Nothing to download. Automatic updates.',
    open: 'Open in your browser',
    install: 'Install the app',
    installed: 'Installed. Kollab is in your apps.',
    desktop: 'Or the desktop app',
    ready: 'Shortcuts, notifications, auto updates.',
    notReady: 'Soon. Meanwhile, Kollab works in your browser.',
    mine: 'Your system',
    go: 'Download ↓',
    os: {
      windows: 'Windows 10 and 11 · .exe',
      mac: 'Apple silicon and Intel · .dmg',
      linux: 'AppImage',
    },
    alerts: [
      { os: 'Windows', t: 'warning on launch? “More info”, then “Run anyway”.' },
      { os: 'macOS', t: 'blocked? Settings, Privacy & Security, “Open Anyway”.' },
    ],
    help: {
      title: 'Install Kollab',
      ios: ['Tap Share', 'Then “Add to Home Screen”'],
      safari: ['File menu', 'Then “Add to Dock”'],
      android: ['Browser menu ⋮', 'Then “Install app”'],
      chrome: ['Install icon in the address bar', 'Or menu ⋮, then “Install Kollab”'],
      other: ['Your browser can’t install web apps', 'Open this site in Chrome, Edge or Safari'],
      close: 'Got it',
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
      'Board, sprints, chat, calls and documents',
      'Web, phone and desktop',
      'New features as soon as they ship',
      'Data hosted in the European Union',
    ],
  },
  roadmap: {
    kicker: 'Roadmap',
    title: "What's coming to Kollab.",
    cols: [
      { when: 'Available', color: 'k-bg-mint', items: ['Board, sprints and planning poker', 'PR reviews: approve, merge', 'Chat linked to Discord channels', 'Calls, video and presence', 'Laid-out documents, PDF export', 'Arrangeable home, offline mode'] },
      { when: 'Next', color: 'k-bg-yellow', items: ['Document tree, with versions', 'Comments on a passage'] },
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
    tabsTitle: 'From task to merge.',
    tabsSub: 'One tool instead of five: board, PRs, chat, docs and calls.',
    tabs: ['Task and PR', 'Board', 'Chat', 'Documents', 'Calls', 'Phone'],
    marquee: ['Task ↔ PR', 'Kanban', 'PR reviews', 'Sprints', 'Planning poker', 'Chat', 'Discord', 'Calls', 'Documents', 'PDF export', 'Roadmap', 'Ctrl+K', 'Offline'],
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
    compare: { kicker: 'Compare', title: 'One tool instead of five.', lead: 'Board, PR reviews, chat, documents and calls in one place.' },
  },
  audiences: [
    {
      bg: 'k-bg-yellow',
      who: 'Student projects',
      title: 'The final-year project, without the chaos.',
      story: 'Four students, six weeks, one deliverable. Everyone knows who does what.',
      points: ['Invite links in 10 seconds', 'Visible workload so one person doesn’t do it all', 'Meeting notes exported to PDF'],
    },
    {
      bg: 'k-bg-coral',
      who: 'Small dev teams',
      title: 'Sprints and PRs in one place.',
      story: 'Five devs who juggled Trello, GitHub and Discord. Now it’s all in one place.',
      points: ['PRs approved and merged in Kollab', 'Discord channels linked to the chat', 'Calls and screen sharing'],
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
      'Voice and video calls',
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
  '0.6.15': {
    title: 'Documents that look professional',
    items: [
      'New layout: large title, summary up top, numbered sections in the margin',
      'Redesigned templates, with a grey hint in each empty section',
      'Tables, images (paste or drop), highlighting and text colors',
      'Type / to insert a table, a checklist, an image…',
      'The PDF uses the same layout',
    ],
  },
  '0.6.8': {
    title: 'Channels, files and your Discord account',
    items: [
      'Create, rename and delete channels; a deleted channel can be restored from the bin',
      'Attach files and images in chat: paperclip, drag and drop or paste',
      'Link your Discord account: your Discord messages show on your side',
      'Discord channel history comes into Kollab, files included',
    ],
  },
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
      'Calls that ring, video, screen sharing and Do not disturb',
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
  // Versions plus récentes : l'ordre d'affichage vient de src/changelog.json.
  '0.6.16': {
    title: 'A home page you can arrange',
    items: [
      'Arrange the home page: grab a block and drop it where you want, in the desktop app too',
      'Drag the corner of a block to change its height, or make it wide or narrow',
      'An empty column leaves all the room to the other one',
    ],
  },
  '0.6.12': {
    title: 'Documents you can tell apart',
    items: [
      'Each document has a type and its color: meeting notes, daily, spec, retro, requirements',
      'New document: pick a template, it opens already filled in (date, attendees, sprint, everyone’s tasks)',
      'Pin key documents for the whole team',
      'To-do boxes become board tasks in one click, and tick themselves when the task is done',
      'Outline next to the document, toolbar with words',
    ],
  },
  '0.6.11': {
    title: 'Merge without leaving Kollab',
    items: [
      'Reviews: Approve, Request changes and Merge, without going to GitHub',
      'After the merge, the linked task moves to Done and the branch can be deleted',
      'Sprints: a warning when a sprint goes beyond the team’s usual pace',
      'Documents: PDF export, ready to send',
      'Task view: same words and same order on desktop and phone',
    ],
  },
  '0.6.10': {
    title: 'Made for your thumb',
    items: [
      'Edge-to-edge chat: the message box fits on one line',
      'Keyboard open: the last message and the message box stay visible',
      'Smoother scrolling everywhere, no zoom or bounce',
      'Board: a resting finger no longer blocks scrolling',
      'Short messages show at the top and no longer hide the buttons',
    ],
  },
  '0.6.9': {
    title: 'Your presence, like in Teams',
    items: [
      'Available, Busy, Do not disturb, Away or Invisible, from the menu at the bottom left',
      'Pick a duration, then back to Available',
      'Do not disturb: no ringing or notification, the call shows as missed',
      'Invisible: you look offline to the team',
      'Crossed or hollow dot on profile photos',
    ],
  },
  '0.6.7': {
    title: 'Real calls',
    items: [
      'Call and video icons at the top of the chat',
      'Call someone from the list of online members',
      'It rings for the others: Answer, Decline or With video',
      'Full-screen call, can shrink to a small window',
      'Screen sharing in large, faces on the side',
      'No answer after 30 s: missed call in the chat',
    ],
  },
  '0.6.6': {
    title: 'The phone, like the desktop',
    items: [
      'Phone home with the same blocks as desktop: tiles, My day, Late, Activity',
      'Board: one column at a time, colored tabs, next step in one gesture',
      'Full-screen chat, channels in a window',
      'Header with the logo, the project and online members',
      'Reviews in the bottom bar, Team and My account under More',
    ],
  },
  '0.6.5': {
    title: 'The task and its PR, first',
    items: [
      'My day shows the PR state of each task',
      'Paste a PR link or number to link it',
      'Board filtered by person',
      'Pending invitations visible in Team',
      'Editable sprints, start date of your choice, summary of finished sprints',
      'Invite link: direct sign-up and a tour for guests',
    ],
  },
  '0.6.4': {
    title: 'Discord in the chat',
    items: [
      'Link your Discord server once, in a small window',
      'All Discord channels come into the chat, those with the same name are merged',
      'Messages go both ways, with everyone’s name and photo',
      '“Link to Discord” button at the top of each channel',
    ],
  },
  '0.6.3': {
    title: 'Your projects, every time you sign in',
    items: [
      'No more intro or project to redo when you sign back in',
      'The app tour no longer comes back on every device',
      'Chat bubble at the bottom right',
      'Suggest your role in Team, an admin approves it',
    ],
  },
}
