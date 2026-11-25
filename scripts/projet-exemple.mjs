// Génère le SQL du « Projet exemple » : une équipe fictive et des données dans toutes les fonctions.
// Usage : node scripts/projet-exemple.mjs <id utilisateur> <dossier de sortie>
import { getSchema } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { TaskItem, TaskList } from '@tiptap/extension-list'
import { TableKit } from '@tiptap/extension-table'
import Image from '@tiptap/extension-image'
import Highlight from '@tiptap/extension-highlight'
import TextAlign from '@tiptap/extension-text-align'
import { TextStyle, Color } from '@tiptap/extension-text-style'
import { prosemirrorJSONToYDoc } from '@tiptap/y-tiptap'
import * as Y from 'yjs'
import { writeFileSync, mkdirSync } from 'node:fs'

const [, , ME, OUT = '.'] = process.argv
if (!ME) throw new Error('id utilisateur manquant')

const schema = getSchema([StarterKit.configure({ undoRedo: false }), TaskList, TaskItem.configure({ nested: true }), TableKit, Image, Highlight, TextStyle, Color, TextAlign.configure({ types: ['heading', 'paragraph'] })])

// Identifiants fixes, reconnaissables (préfixe e0…) : faciles à retirer.
let n = 0
const id = (p = 'e0') => `${p}000000-0000-4000-8000-${String(++n).padStart(12, '0')}`
const G = 'e0000000-0000-4000-8000-000000000000'
const q = (v) => (v === null || v === undefined ? 'null' : `'${String(v).replace(/'/g, "''")}'`)
const ago = (min) => `now() - interval '${Math.round(min)} minutes'`
const H = 60, D = 1440
const day = (d) => `current_date + ${d}`
const arr = (ids) => `array[${ids.map(q).join(',')}]::uuid[]`

// ---------- Équipe ----------
const team = {
  lea: { id: id('e1'), name: 'Léa Martin', color: '#2E7D4F', title: 'Développeuse front', role: 'member', status: 'available', st: '' },
  sami: { id: id('e1'), name: 'Sami Benali', color: '#2F6FD0', title: 'Développeur back', role: 'admin', status: 'busy', st: 'En revue de code' },
  chloe: { id: id('e1'), name: 'Chloé Durand', color: '#C2410C', title: 'Designer UX', role: 'member', status: 'available', st: 'Maquettes du sprint 4' },
  hugo: { id: id('e1'), name: 'Hugo Lefèvre', color: '#9B3FB8', title: 'Testeur QA', role: 'member', status: 'away', st: 'De retour à 14 h', req: 'Responsable qualité' },
  nadia: { id: id('e1'), name: 'Nadia Rousseau', color: '#B5462E', title: 'Cliente', role: 'guest', status: 'available', st: '' },
}
const L = team.lea.id, S = team.sami.id, C = team.chloe.id, Hu = team.hugo.id, N = team.nadia.id
const emailOf = (k) => `${k}.exemple@kollab.invalid`

// ---------- Sprints ----------
const sp = {
  s1: { id: id(), name: 'Sprint 1', goal: 'Connexion et création de projet', a: -34, b: -21, status: 'done', closed: -21 },
  s2: { id: id(), name: 'Sprint 2', goal: 'Tableau kanban, invitations et chat', a: -20, b: -7, status: 'done', closed: -7 },
  s3: { id: id(), name: 'Sprint 3', goal: 'Documents, revues de PR et notifications', a: -6, b: 7, status: 'active' },
  s4: { id: id(), name: 'Sprint 4', goal: 'Poker planning, appels et version téléphone', a: 8, b: 21, status: 'planned' },
}

// ---------- Tâches ----------
const PR = (k) => `https://github.com/ambroise-boutrin/kollab/pull/${k}`
const tasks = []
let pos = 0
const t = (title, status, kind, points, who, sprint, o = {}) => {
  const x = { id: id(), title, status, kind, points, who, sprint, pos: pos++, desc: o.desc ?? '', pr: o.pr ?? null, due: o.due ?? null, created: o.created ?? (sprint && sp[sprint].a < 0 ? sp[sprint].a * -D + 3 * H : 2 * D), done: o.done ?? null }
  tasks.push(x)
  return x
}
// Sprint 1 (terminé)
t('Connexion par email et GitHub', 'done', 'feature', 5, [ME], 's1', { done: 31 * D, pr: PR(38) })
t('Création de projet en 3 étapes', 'done', 'feature', 8, [S, L], 's1', { done: 27 * D })
t('Schéma de la base', 'done', 'feature', 5, [S], 's1', { done: 30 * D })
t('Choisir le stack', 'done', 'research', 2, [ME], 's1', { done: 33 * D })
t('Thèmes de couleur', 'done', 'feature', 3, [C, L], 's1', { done: 23 * D })
// Sprint 2 (terminé)
t('Tableau kanban glisser-déposer', 'done', 'feature', 8, [L], 's2', { done: 15 * D })
t('Invitations par lien et par email', 'done', 'feature', 5, [S], 's2', { done: 12 * D, pr: PR(49) })
t('Chat avec salons et réactions', 'done', 'feature', 8, [L, S], 's2', { done: 10 * D, pr: PR(52) })
t('Rôles admin, membre, invité', 'done', 'feature', 3, [ME], 's2', { done: 9 * D })
t('Le menu se ferme mal sur iPhone', 'done', 'bug', 2, [Hu, L], 's2', { done: 8 * D, pr: PR(55) })
// Sprint 3 (en cours)
const tDocs = t('Documents en mise en page éditoriale', 'done', 'feature', 8, [L, C], 's3', { done: 2 * D, pr: PR(62), desc: 'Typo de lecture, chapô, tableaux, images, menu /.' })
t('Modèles de documents pré-remplis', 'done', 'feature', 5, [L], 's3', { done: 4 * D, pr: PR(60) })
t('Accueil : déplacer et redimensionner les blocs', 'done', 'feature', 5, [C, L], 's3', { done: 1 * D, pr: PR(61) })
const tReview = t('Fusionner une PR depuis Revues', 'review', 'feature', 5, [S, ME], 's3', { pr: PR(59), due: 1, desc: 'Bouton Fusionner dans la revue. Vérifier les droits sur le dépôt.' })
const tNotif = t('Notifications sur téléphone', 'doing', 'feature', 8, [S], 's3', { due: 3, desc: 'Push web (PWA) + pastille. Tester sur iPhone et Android.' })
const tPdf = t('Export PDF du sprint', 'doing', 'feature', 3, [L], 's3', { due: 4 })
const tBug = t('Le compteur de non-lus ne se remet pas à zéro', 'doing', 'bug', 2, [Hu, ME], 's3', { due: -1, desc: 'Reproduit sur Chrome Android : ouvrir le salon ne vide pas la pastille.' })
t('Recherche globale Ctrl+K', 'todo', 'feature', 5, [], 's3', { due: 6 })
t('Mentions @ dans les commentaires', 'todo', 'feature', 3, [L], 's3', { due: 5 })
const tA11y = t('Audit accessibilité (contrastes, clavier)', 'todo', 'research', 3, [Hu, C], 's3', { due: 7 })
// Sprint 4 (prévu)
const tPoker = t('Poker planning en direct', 'todo', 'feature', 8, [S], 's4')
t('Appels audio et partage d\'écran', 'todo', 'feature', 13, [S, L], 's4')
t('App téléphone : barre du bas', 'todo', 'feature', 5, [C, L], 's4')
t('Résumé automatique du sprint', 'todo', 'feature', 3, [ME], 's4')
// Backlog
t('Mode hors ligne', 'todo', 'research', 5, [], null)
t('Import depuis Trello', 'todo', 'feature', 5, [], null)
t('Statistiques personnelles', 'todo', 'feature', 3, [], null)
t('Le thème sombre clignote au lancement', 'todo', 'bug', 1, [], null)
t('Widgets écran d\'accueil', 'todo', 'research', 3, [], null)

// ---------- Documents texte (éditeur) ----------
const tx = (text, marks) => ({ type: 'text', text, ...(marks ? { marks } : {}) })
const b = (text) => tx(text, [{ type: 'bold' }])
const hl = (text) => tx(text, [{ type: 'highlight' }])
const P = (...c) => ({ type: 'paragraph', content: c.map((x) => (typeof x === 'string' ? tx(x) : x)).filter((x) => x.text !== '') })
const H2 = (s) => ({ type: 'heading', attrs: { level: 2 }, content: [tx(s)] })
const UL = (items) => ({ type: 'bulletList', content: items.map((i) => ({ type: 'listItem', content: [Array.isArray(i) ? P(...i) : P(i)] })) })
const OL = (items) => ({ type: 'orderedList', content: items.map((i) => ({ type: 'listItem', content: [P(i)] })) })
const TODO = (items) => ({ type: 'taskList', content: items.map(([done, s]) => ({ type: 'taskItem', attrs: { checked: done }, content: [P(s)] })) })
const TABLE = (head, rows) => ({
  type: 'table',
  content: [
    { type: 'tableRow', content: head.map((h) => ({ type: 'tableHeader', content: [P(h)] })) },
    ...rows.map((r) => ({ type: 'tableRow', content: r.map((c) => ({ type: 'tableCell', content: [Array.isArray(c) ? P(...c) : P(c)] })) })),
  ],
})
const QUOTE = (s) => ({ type: 'blockquote', content: [P(s)] })
const plain = (node) => (node.text ?? '') + (node.content ?? []).map(plain).join(node.type === 'tableRow' ? ' · ' : '')
const preview = (blocks) => blocks.map((x) => (['bulletList', 'orderedList', 'taskList', 'table'].includes(x.type) ? x.content.map(plain).join('\n') : plain(x))).join('\n').slice(0, 2000)

const notes = [
  {
    title: 'Cahier des charges Kollab v1', kind: 'cdc', pinned: true, by: S, upBy: ME, created: 30 * D, updated: 2 * D,
    blocks: [
      P('Un seul outil au lieu de cinq pour une petite équipe qui code : tâches liées aux PR, sprints, documents et chat.'),
      H2('Contexte'),
      P('L\'équipe jongle entre Trello, Slack, Google Docs, GitHub et Discord. Les infos se perdent entre les outils.'),
      H2('Objectifs'),
      UL(['Suivre chaque tâche jusqu\'à sa PR fusionnée', 'Préparer un sprint en moins de 15 minutes', 'Retrouver une décision en moins de 30 secondes']),
      H2('Périmètre'),
      TABLE(['Fonction', 'Priorité', 'Lot'], [
        ['Tableau kanban et sprints', [b('Haute')], 'Lot 1'],
        ['Chat et salons Discord', [b('Haute')], 'Lot 1'],
        ['Documents collaboratifs', 'Moyenne', 'Lot 2'],
        ['Poker planning', 'Moyenne', 'Lot 2'],
        ['Appels et partage d\'écran', 'Basse', 'Lot 3'],
      ]),
      H2('Contraintes'),
      P('Budget serré : hébergement gratuit (Supabase, Vercel). Ordinateur et téléphone dès la première version.'),
      H2('Planning'),
      TABLE(['Étape', 'Date'], [['Lot 1 en ligne', '15 novembre'], ['Lot 2 en ligne', '6 décembre'], ['Version 1.0', '20 décembre']]),
    ],
  },
  {
    title: 'Daily du 25 novembre', kind: 'daily', pinned: true, by: L, upBy: S, created: 3 * H, updated: 40,
    blocks: [
      P('18 points sur 50 dans le Sprint 3. Une PR attend une relecture.'),
      H2('Tour de table'),
      TABLE(['Qui', 'Hier', 'Aujourd\'hui'], [
        [[b('Ambroise')], 'Relecture des modèles de documents', 'Fusionner une PR depuis Revues'],
        [[b('Léa')], 'Documents en mise en page éditoriale', 'Export PDF du sprint'],
        [[b('Sami')], 'Fusion depuis Revues', 'Notifications sur téléphone'],
        [[b('Chloé')], 'Accueil en blocs', 'Maquettes du sprint 4'],
        [[b('Hugo')], 'Tests sur iPhone', 'Compteur de non-lus'],
      ]),
      H2('Blocages'),
      P('Sami attend les clés VAPID pour les notifications. ', hl('Ambroise s\'en occupe ce matin.')),
      H2('Actions'),
      TODO([[true, 'Créer les clés VAPID @Ambroise'], [false, 'Relire la PR de fusion @Sami avant 16 h'], [false, 'Tester la pastille sur Android @Hugo']]),
    ],
  },
  {
    title: 'Compte rendu : démo client du 21 novembre', kind: 'cr', pinned: false, by: ME, upBy: ME, created: 4 * D, updated: 4 * D,
    blocks: [
      P('Nadia valide le tableau et le chat. Elle veut un export PDF du sprint pour sa direction.'),
      P(b('Présents'), ' : Ambroise, Nadia Rousseau, Sami Benali, Léa Martin'),
      H2('Points abordés'),
      UL(['Démo du tableau kanban et des sprints', 'Chat relié au Discord de l\'équipe', 'Questions sur la sécurité des données']),
      H2('Décisions'),
      OL(['Export PDF du sprint ajouté au Sprint 3', 'Appels audio repoussés au Sprint 4', 'Prochaine démo le 5 décembre']),
      H2('Actions'),
      TODO([[true, 'Envoyer le compte rendu à Nadia @Ambroise'], [false, 'Export PDF du sprint @Léa'], [false, 'Note sur la sécurité des données @Sami']]),
    ],
  },
  {
    title: 'Spec : notifications sur téléphone', kind: 'spec', pinned: false, by: S, upBy: S, created: 5 * D, updated: 6 * H,
    blocks: [
      P('Prévenir chaque membre sur son téléphone quand on le mentionne ou qu\'on lui attribue une tâche.'),
      H2('Problème'),
      P('Les membres ne voient les mentions qu\'en ouvrant l\'app. Les PR attendent parfois deux jours.'),
      H2('Solution proposée'),
      P('Notifications push web via la PWA, une pastille sur l\'icône, et un réglage pour couper. Pas d\'email à chaque message.'),
      H2('Critères d\'acceptation'),
      TODO([[true, 'Une mention envoie une notification en moins de 5 secondes'], [true, 'La pastille affiche le nombre de non-lus'], [false, 'Ouvrir la notification mène au bon message'], [false, 'On peut tout couper dans Réglages']]),
      H2('Questions ouvertes'),
      UL(['Faut-il regrouper les notifications d\'un même salon ?', 'iPhone : demander l\'installation avant l\'autorisation ?']),
    ],
  },
  {
    title: 'Rétro du Sprint 2', kind: 'retro', pinned: false, by: L, upBy: Hu, created: 7 * D, updated: 7 * D,
    blocks: [
      P('26 points sur 26 livrés. Premier sprint terminé à l\'heure.'),
      H2('À garder'),
      UL(['Le poker planning du lundi', 'Les PR courtes, relues dans la journée', 'Les tests sur vrai téléphone avant la fusion']),
      H2('À améliorer'),
      UL(['Des tâches encore trop grosses (8 points et plus)', 'Le daily déborde souvent après 15 minutes']),
      QUOTE('« On a livré plus vite quand chaque PR faisait moins de 300 lignes. » Léa'),
      H2('Engagements'),
      TODO([[true, 'Découper toute tâche de 8 points ou plus @Ambroise'], [true, 'Minuteur de 15 minutes au daily @Hugo']]),
    ],
  },
  {
    title: 'Idées pour la version 1.1', kind: 'idee', pinned: false, by: C, upBy: L, created: 3 * D, updated: 1 * D,
    blocks: [
      UL(['Import depuis Trello en un clic', 'Mode focus avec minuteur Pomodoro', 'Statistiques personnelles : PR relues, points livrés', 'Tableau blanc pour l\'architecture', 'Widgets sur l\'écran d\'accueil du téléphone']),
    ],
  },
  {
    title: 'Guide d\'arrivée dans l\'équipe', kind: 'page', pinned: false, by: ME, upBy: C, created: 25 * D, updated: 5 * D,
    blocks: [
      P('Tout ce qu\'il faut pour être productif le premier jour.'),
      H2('Les rituels'),
      TABLE(['Rituel', 'Quand', 'Durée'], [['Daily', 'Chaque jour, 9 h 30', '15 min'], ['Poker planning', 'Lundi du sprint', '45 min'], ['Démo client', 'Fin de sprint', '30 min'], ['Rétro', 'Fin de sprint', '30 min']]),
      H2('Les règles de code'),
      UL(['Une branche par tâche : feature/… ou fix/…', 'Une PR relue par une autre personne avant la fusion', 'Pas de fusion le vendredi après 16 h']),
      H2('Où trouver quoi'),
      P('Les liens utiles sont dans ', b('Liens'), '. Les décisions sont dans les comptes rendus. Les questions vont dans #général.'),
    ],
  },
].map((x) => {
  const json = { type: 'doc', content: x.blocks }
  schema.nodeFromJSON(json).check()
  const ydoc = prosemirrorJSONToYDoc(schema, json, 'default')
  return { ...x, id: id(), ystate: Buffer.from(Y.encodeStateAsUpdate(ydoc)).toString('base64'), preview: preview(x.blocks) }
})

// ---------- Salons et messages ----------
const ch = { gen: id(), code: id(), sprint: id(), design: id(), ann: id() }
const channels = [[ch.gen, 'général'], [ch.code, 'revues-de-code'], [ch.sprint, 'sprint'], [ch.design, 'design'], [ch.ann, 'annonces']]
const ref = (task) => `[#${task.title}](tache:${task.id})`
const messages = []
const m = (c, who, min, body, reacts = [], o = {}) => { const x = { id: id(), c, who, min, body, reacts, ...o }; messages.push(x); return x }
m(ch.ann, ME, 21 * D, 'Bienvenue dans Kollab ! Le projet démarre lundi. Le cahier des charges est dans Documents.', [['🎉', [L, S, C, Hu]]])
m(ch.ann, ME, 7 * D - 60, 'Sprint 2 clôturé : 26 points sur 26. Bravo à tous 👏', [['👏', [L, S, C, Hu, N]], ['🚀', [S]]])
m(ch.ann, S, 6 * D, 'Sprint 3 lancé. Objectif : documents, revues de PR et notifications.', [['👍', [ME, L, Hu]]])
m(ch.gen, S, 26 * H, 'Bonjour à tous, point rapide à 10 h ?', [['👍', [ME, L]]])
m(ch.gen, ME, 26 * H - 4, 'Ok pour moi.')
m(ch.gen, L, 26 * H - 9, 'Je serai là, je finis le tableau avant.')
m(ch.gen, Hu, 5 * H, `J'ai reproduit ${ref(tBug)} sur Chrome Android. @Ambroise tu peux regarder avec moi ?`, [['👀', [ME]]])
m(ch.gen, ME, 5 * H - 12, 'Oui, à 14 h ça te va ?')
m(ch.gen, Hu, 5 * H - 15, 'Parfait.', [['👍', [ME]]])
m(ch.gen, null, 3 * H, 'Je passe sur Discord ce soir pour la démo, je vous montre la maquette de l\'appel.', [['❤️', [C]]], { discord: { name: 'Tom', avatar: null } })
m(ch.gen, N, 2 * H, 'Bonjour l\'équipe, l\'export PDF sera prêt pour la démo du 5 décembre ?')
m(ch.gen, L, 2 * H - 6, `Oui, ${ref(tPdf)} est en cours, je vous montre une version jeudi.`, [['🙏', [N]]])
m(ch.gen, S, 50, `@Ambroise les clés VAPID sont arrivées ? Je suis bloqué sur ${ref(tNotif)}.`)
m(ch.gen, ME, 38, 'Je les crée tout de suite, tu les auras avant midi.', [['🙌', [S]]])
m(ch.code, S, 9 * H, `PR prête pour ${ref(tReview)}. Elle ajoute le bouton Fusionner dans Revues.`, [['👀', [ME, L]]])
m(ch.code, L, 8 * H, 'Relu : deux remarques sur les messages d\'erreur, sinon c\'est bon pour moi.')
m(ch.code, ME, 7 * H, 'Merci Léa. Je relis à mon tour cet après-midi.')
m(ch.code, Hu, 2 * D, `Tests passés sur iPhone et Android pour ${ref(tDocs)} ✅`, [['🎉', [L, C]]])
m(ch.code, L, 2 * D - 30, 'Fusionnée, merci Hugo !')
m(ch.sprint, ME, 6 * D, 'Poker planning terminé : 50 points dans le Sprint 3.', [['👍', [S, L, C, Hu]]])
m(ch.sprint, C, 3 * D, `Je prends ${ref(tA11y)} avec Hugo la semaine prochaine.`)
m(ch.sprint, Hu, 3 * D - 20, 'Ça marche, je prépare la liste des écrans.')
m(ch.sprint, S, 20 * H, 'Burndown à jour : on est un peu en retard sur les notifications, rien d\'inquiétant.')
m(ch.design, C, 4 * D, 'Nouvelles maquettes de l\'accueil dans Figma, deux pistes. Vos avis ?', [['😍', [L, ME]]])
m(ch.design, ME, 4 * D - 25, 'Piste A pour moi : plus simple, les couleurs ressortent mieux.')
m(ch.design, L, 4 * D - 40, 'Pareil, la A. La B fait trop de cartes.', [['👍', [C]]])
m(ch.design, C, 4 * D - 55, 'Va pour la A, je passe aux maquettes téléphone.')
m(ch.design, C, 1 * D, `@Léa l'accueil en blocs est validé, tu peux fusionner.`, [['🚀', [L]]])

// ---------- Commentaires de tâches ----------
const comments = [
  [tReview, L, 8 * H, 'Deux remarques sur les messages d\'erreur, le reste est bon.'],
  [tReview, S, 7 * H, 'Corrigé. @Ambroise tu peux valider ?'],
  [tNotif, S, 50, 'Bloqué en attendant les clés VAPID.'],
  [tNotif, ME, 35, 'Clés créées, elles sont dans les secrets Supabase.'],
  [tBug, Hu, 5 * H, 'Reproduit sur Chrome Android 131. Pas sur iPhone.'],
  [tPoker, C, 2 * D, 'Maquette prête : cartes Fibonacci, révélation en même temps.'],
]

// ---------- Liens ----------
const links = [
  ['Dépôt GitHub', 'https://github.com/ambroise-boutrin/kollab', 30 * D],
  ['Kollab en ligne', 'https://kollab-tan-nu.vercel.app/app', 29 * D],
  ['Maquettes Figma', 'https://www.figma.com/', 20 * D],
  ['Tableau de bord Supabase', 'https://supabase.com/dashboard', 28 * D],
  ['Déploiements Vercel', 'https://vercel.com/dashboard', 28 * D],
  ['Guide Scrum (français)', 'https://scrumguides.org/', 25 * D],
]

// ---------- Notifications pour toi ----------
const notifs = [
  ['mention', S, 'Sami Benali t\'a mentionné dans #général', `@Ambroise les clés VAPID sont arrivées ? Je suis bloqué sur ${tNotif.title}.`, `/chat?salon=${ch.gen}`, 50, false],
  ['mention', S, `Sami Benali t'a mentionné sur « ${tReview.title} »`, 'Corrigé. @Ambroise tu peux valider ?', `/tableau?tache=${tReview.id}`, 7 * H, false],
  ['assigned', Hu, tBug.title, 'Hugo Lefèvre t\'a attribué cette tâche', `/tableau?tache=${tBug.id}`, 5 * H + 5, false],
  ['mention', Hu, 'Hugo Lefèvre t\'a mentionné dans #général', `J'ai reproduit ${tBug.title} sur Chrome Android. @Ambroise tu peux regarder avec moi ?`, `/chat?salon=${ch.gen}`, 5 * H, true],
  ['joined', C, 'Projet exemple', 'Chloé Durand a rejoint le projet', '/equipe', 28 * D, true],
  ['joined', N, 'Projet exemple', 'Nadia Rousseau a rejoint le projet', '/equipe', 22 * D, true],
]

// ---------- Historique ----------
const act = []
const a = (who, min, verb, target, tid, label, meta = {}) => act.push([who, min, verb, target, tid, label, meta])
a(ME, 31 * D, 'created', 'groups', G, 'Projet exemple')
for (const [k, v] of Object.entries(team)) a(v.id, { lea: 30, sami: 30, chloe: 28, hugo: 27, nadia: 22 }[k] * D, 'joined', 'group_members', v.id, null)
a(S, 30 * D, 'created', 'notes', notes[0].id, notes[0].title)
a(ME, 21 * D, 'sprint_closed', 'sprints', sp.s1.id, 'Sprint 1')
a(ME, 20 * D, 'sprint_active', 'sprints', sp.s2.id, 'Sprint 2')
a(ME, 7 * D, 'sprint_closed', 'sprints', sp.s2.id, 'Sprint 2')
a(L, 7 * D, 'created', 'notes', notes[4].id, notes[4].title)
a(ME, 6 * D, 'sprint_active', 'sprints', sp.s3.id, 'Sprint 3')
a(ME, 6 * D - 30, 'created', 'sprints', sp.s4.id, 'Sprint 4')
a(S, 5 * D, 'created', 'notes', notes[3].id, notes[3].title)
a(ME, 4 * D, 'created', 'notes', notes[2].id, notes[2].title)
a(C, 20 * D, 'created', 'links', null, 'Maquettes Figma')
for (const x of tasks.filter((x) => x.done)) a(x.who[0] ?? ME, x.done, 'moved', 'tasks', x.id, x.title, { from: 'review', to: 'done' })
a(S, 9 * H, 'pr_linked', 'tasks', tReview.id, tReview.title, { pr: tReview.pr })
a(S, 9 * H - 1, 'moved', 'tasks', tReview.id, tReview.title, { from: 'doing', to: 'review' })
a(Hu, 5 * H + 5, 'assigned', 'tasks', tBug.id, tBug.title)
a(Hu, 5 * H + 10, 'created', 'tasks', tBug.id, tBug.title)
a(L, 3 * H, 'created', 'notes', notes[1].id, notes[1].title)
a(L, 2 * H, 'moved', 'tasks', tPdf.id, tPdf.title, { from: 'todo', to: 'doing' })

// ---------- SQL ----------
const out = []
const w = (s) => out.push(s)
w(`-- Kollab : « Projet exemple », une équipe fictive et des données dans toutes les fonctions.
-- À coller dans Supabase > SQL Editor, puis Run. Ajoute seulement, ne modifie ni ne supprime rien.
-- Tout est rangé sous des identifiants qui commencent par e0 / e1 : retirer-projet-exemple.sql enlève tout.
begin;

-- Pas de déclencheurs pendant l'import : aucune notification envoyée sur ton téléphone, aucun message vers Discord.
-- L'historique et les notifications sont écrits plus bas, avec les bons auteurs et les bonnes dates.
set local session_replication_role = replica;

-- Déjà importé ? On s'arrête là.
do $$ begin
  if exists (select 1 from public.groups where id = '${G}') then raise exception 'Le projet exemple existe déjà. Lance retirer-projet-exemple.sql avant de recommencer.'; end if;
  if not exists (select 1 from auth.users where id = '${ME}') then raise exception 'Compte introuvable'; end if;
end $$;

-- Membres fictifs : comptes sans mot de passe (personne ne peut s'y connecter), adresses en .invalid (aucun email possible).`)
for (const [k, v] of Object.entries(team)) {
  w(`insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
values ('00000000-0000-0000-0000-000000000000', '${v.id}', 'authenticated', 'authenticated', '${emailOf(k)}', '', now(), '{"provider":"email","providers":["email"],"exemple":true}', ${q(JSON.stringify({ name: v.name }))}, now() - interval '32 days', now(), '', '', '', '');`)
  w(`insert into public.profiles (id, name, color, title, status, status_text, weekly_email, created_at) values ('${v.id}', ${q(v.name)}, '${v.color}', ${q(v.title)}, '${v.status}', ${q(v.st)}, false, now() - interval '32 days');`)
}
w(`
-- Le projet
insert into public.groups (id, name, created_by, created_at, color, sprint_days, daily_time) values ('${G}', 'Projet exemple', '${ME}', ${ago(31 * D)}, '#5546E0', 14, '09:30');
insert into public.group_members (group_id, user_id, role, title, joined_at, title_request) values
  ('${G}', '${ME}', 'admin', 'Product Owner', ${ago(31 * D)}, null),
${Object.entries(team).map(([k, v]) => `  ('${G}', '${v.id}', '${v.role}', ${q(v.title)}, ${ago({ lea: 30, sami: 30, chloe: 28, hugo: 27, nadia: 22 }[k] * D)}, ${q(v.req ?? null)})`).join(',\n')};
insert into public.email_invites (id, group_id, email, role, code, invited_by, created_at) values ('${id()}', '${G}', 'thomas.exemple@kollab.invalid', 'member', 'EXEMPLE-INVIT', '${ME}', ${ago(1 * D)});

-- Sprints
insert into public.sprints (id, group_id, name, goal, starts_on, ends_on, status, created_at, closed_at) values
${Object.values(sp).map((s) => `  ('${s.id}', '${G}', ${q(s.name)}, ${q(s.goal)}, ${day(s.a)}, ${day(s.b)}, '${s.status}', ${ago((Math.abs(s.a) + 2) * D)}, ${s.closed ? ago(-s.closed * D) : 'null'})`).join(',\n')};

-- Tâches
insert into public.tasks (id, group_id, title, description, status, kind, points, assignee_id, assignee_ids, pr_url, position, created_at, sprint_id, done_at, due_on) values
${tasks.map((x) => `  ('${x.id}', '${G}', ${q(x.title)}, ${q(x.desc)}, '${x.status}', '${x.kind}', ${x.points}, ${q(x.who[0] ?? null)}, ${arr(x.who)}, ${q(x.pr)}, ${x.pos}, ${ago(x.created)}, ${x.sprint ? `'${sp[x.sprint].id}'` : 'null'}, ${x.done ? ago(x.done) : 'null'}, ${x.due === null ? 'null' : day(x.due)})`).join(',\n')};

insert into public.task_comments (id, task_id, group_id, author_id, body, created_at) values
${comments.map(([tk, who, min, body]) => `  ('${id()}', '${tk.id}', '${G}', '${who}', ${q(body)}, ${ago(min)})`).join(',\n')};

-- Documents (éditeur collaboratif, avec les modèles éditoriaux)
insert into public.notes (id, group_id, title, kind, pinned, ystate, preview, created_by, created_at, updated_by, updated_at) values
${notes.map((x) => `  ('${x.id}', '${G}', ${q(x.title)}, '${x.kind}', ${x.pinned}, '${x.ystate}', ${q(x.preview)}, '${x.by}', ${ago(x.created)}, '${x.upBy}', ${ago(x.updated)})`).join(',\n')};

-- Liens (le dépôt GitHub en premier : il alimente Revues)
insert into public.links (id, group_id, title, url, created_at) values
${links.map(([ti, u, min]) => `  ('${id()}', '${G}', ${q(ti)}, ${q(u)}, ${ago(min)})`).join(',\n')};

-- Salons et messages
insert into public.channels (id, group_id, name, created_at) values
${channels.map(([cid, name], i) => `  ('${cid}', '${G}', ${q(name)}, ${ago(31 * D - i)})`).join(',\n')};
insert into public.messages (id, group_id, channel_id, author_id, body, created_at, discord_author) values
${messages.map((x) => `  ('${x.id}', '${G}', '${x.c}', ${q(x.who)}, ${q(x.body)}, ${ago(x.min)}, ${x.discord ? `${q(JSON.stringify(x.discord))}::jsonb` : 'null'})`).join(',\n')};
insert into public.message_reactions (message_id, group_id, user_id, emoji, created_at) values
${messages.flatMap((x) => x.reacts.flatMap(([e, us]) => us.map((u) => `  ('${x.id}', '${G}', '${u}', '${e}', ${ago(x.min - 2)})`))).join(',\n')};

-- Historique d'équipe
insert into public.activity (id, group_id, actor_id, verb, target, target_id, label, meta, created_at) values
${act.map(([who, min, verb, target, tid, label, meta]) => `  ('${id()}', '${G}', '${who}', '${verb}', '${target}', ${q(tid)}, ${q(label)}, ${q(JSON.stringify(meta))}::jsonb, ${ago(min)})`).join(',\n')};

-- Notifications pour toi (déjà marquées « envoyées » : rien ne part sur ton téléphone)
insert into public.notifications (id, user_id, group_id, actor_id, kind, title, body, link, created_at, read_at, pushed_at) values
${notifs.map(([kind, who, ti, body, link, min, read]) => `  ('${id()}', '${ME}', '${G}', '${who}', '${kind}', ${q(ti)}, ${q(body)}, ${q(link)}, ${ago(min)}, ${read ? ago(min - 30) : 'null'}, now())`).join(',\n')};

commit;
`)

const removal = `-- Kollab : retire le « Projet exemple » et ses membres fictifs. Rien d'autre n'est touché.
-- À coller dans Supabase > SQL Editor, puis Run.
begin;
delete from public.notifications where group_id = '${G}';
delete from public.groups where id = '${G}';
delete from auth.users where id in (${Object.values(team).map((v) => `'${v.id}'`).join(', ')}) and email like '%.exemple@kollab.invalid';
commit;
`
// Identifiants raccourcis : x(n) pour le projet, u(n) pour les membres fictifs, me() pour toi.
const pre = `create or replace function pg_temp.x(n int) returns uuid language sql immutable as $f$ select ('e0000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
create or replace function pg_temp.u(n int) returns uuid language sql immutable as $f$ select ('e1000000-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid $f$;
create or replace function pg_temp.me() returns uuid language sql immutable as $f$ select '${ME}'::uuid $f$;
`
let sql = out.join('\n')
  .replace(/'e0000000-0000-4000-8000-(\d{12})'/g, (_, d) => `pg_temp.x(${Number(d)})`)
  .replace(/'e1000000-0000-4000-8000-(\d{12})'/g, (_, d) => `pg_temp.u(${Number(d)})`)
  .replaceAll(`'${ME}'`, 'pg_temp.me()')
  .replace('begin;\n', `begin;\n${pre}`)
mkdirSync(OUT, { recursive: true })
writeFileSync(`${OUT}/projet-exemple.sql`, sql)
writeFileSync(`${OUT}/retirer-projet-exemple.sql`, removal)
console.log('ok', tasks.length, 'tâches', notes.length, 'documents', messages.length, 'messages', act.length, 'actions')
