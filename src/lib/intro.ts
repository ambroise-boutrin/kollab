/** Avancement de l'introduction et de la visite, par utilisateur et par appareil. */
export type IntroStep = 'bienvenue' | 'projet' | 'comptes' | 'equipe' | 'fin'
export interface IntroState { step: IntroStep; how?: 'created' | 'joined' }

const introKey = (uid: string) => `kollab-intro:${uid}`
const tourKey = (uid: string) => `kollab-tour:${uid}`

function get(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function set(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* sans stockage, l'introduction peut revenir : ce n'est pas grave */
  }
}

/** L'introduction en cours, ou null si elle est terminée ou jamais commencée. */
export function readIntro(uid: string): IntroState | null {
  const raw = get(introKey(uid))
  if (!raw || raw === 'done') return null
  try {
    return JSON.parse(raw) as IntroState
  } catch {
    return null
  }
}
export const introDone = (uid: string) => get(introKey(uid)) === 'done'
export const saveIntro = (uid: string, state: IntroState) => set(introKey(uid), JSON.stringify(state))
export function finishIntro(uid: string) {
  set(introKey(uid), 'done')
  set(tourKey(uid), null)
}
export const tourDone = (uid: string) => get(tourKey(uid)) === 'done'
export const finishTour = (uid: string) => set(tourKey(uid), 'done')
/** Présentation restée à moitié alors que le compte a déjà ses projets : on la range, sans relancer la visite. */
export const dropIntro = (uid: string) => set(introKey(uid), 'done')
