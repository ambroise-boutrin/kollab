import type { NoteKind } from './types'

/** Types de documents : nom, couleur et modèle de départ. */
export const NOTE_KINDS: Record<NoteKind, { label: string; plural: string; color: string; hint: string }> = {
  cr: { label: 'Compte rendu', plural: 'Comptes rendus', color: 'var(--nk-cr)', hint: 'Présents, décisions, à faire' },
  daily: { label: 'Daily', plural: 'Dailies', color: 'var(--nk-daily)', hint: 'Rempli avec les tâches de chacun' },
  spec: { label: 'Spec', plural: 'Specs', color: 'var(--nk-spec)', hint: 'Problème, solution, critères' },
  retro: { label: 'Rétro de sprint', plural: 'Rétros', color: 'var(--nk-retro)', hint: 'Garder, changer, actions' },
  cdc: { label: 'Cahier des charges', plural: 'Cahiers des charges', color: 'var(--nk-cdc)', hint: 'Contexte, objectifs, périmètre' },
  idee: { label: 'Idées', plural: 'Idées', color: 'var(--nk-idee)', hint: 'En vrac, à trier plus tard' },
  page: { label: 'Page', plural: 'Pages', color: 'var(--nk-page)', hint: 'Juste un titre' },
}
export const NOTE_KIND_ORDER: NoteKind[] = ['cr', 'daily', 'spec', 'retro', 'cdc', 'idee', 'page']

/** Pour les documents créés avant les types : on devine au titre. */
export function guessNoteKind(title: string): NoteKind {
  const t = title.toLowerCase()
  if (/daily|stand-?up|mêlée/.test(t)) return 'daily'
  if (/compte[- ]rendu|\bcr\b|réunion|reunion|démo|demo/.test(t)) return 'cr'
  if (/r[ée]tro/.test(t)) return 'retro'
  if (/cahier des charges|\bcdc\b/.test(t)) return 'cdc'
  if (/sp[ée]c/.test(t)) return 'spec'
  if (/id[ée]e/.test(t)) return 'idee'
  return 'page'
}
