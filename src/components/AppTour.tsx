import { useCallback, useEffect, useState } from 'react'
import { finishTour, tourDone } from '../lib/intro'
import { useStore } from '../lib/store'
import { SpotlightTour, type TourStep } from './DemoTour'

/** Pour quelqu'un qui vient d'être invité : le projet existe déjà, on lui montre où sont ses tâches. */
const GUEST_STEPS: TourStep[] = [
  { path: '/', target: 'project', title: 'Ton équipe', text: 'Le projet que tu viens de rejoindre. Tu peux en rejoindre ou en créer d’autres ici.' },
  { path: '/', target: 'nav', title: 'Navigation', text: 'Tableau pour tes tâches, Chat pour l’équipe.' },
  { path: '/', target: 'members', title: 'Qui est là', text: 'Ton équipe, les gens en ligne en premier.' },
  { path: '/tableau', target: 'new-task', title: 'Tes tâches', text: '« Mes tâches » montre ce qui t’est attribué. Tu peux aussi en créer.' },
  { path: '/chat', target: 'composer', title: 'Dis bonjour', text: 'Présente-toi à l’équipe. @ pour mentionner quelqu’un.' },
  { path: '/', target: 'profile', title: 'Ton profil', text: 'Ta photo, ton statut, et ton rôle à proposer dans Équipe.' },
]

const STEPS: TourStep[] = [
  { path: '/', target: 'project', title: 'Ton projet', text: 'Change de projet, crée-en un autre ou ouvre ses réglages.' },
  { path: '/', target: 'nav', title: 'Navigation', text: 'Accueil, tableau du sprint, chat et équipe.' },
  { path: '/', target: 'members', title: 'Qui est là', text: 'Les membres du projet, ceux en ligne en premier.' },
  { path: '/tableau', target: 'new-task', title: 'Ajouter une tâche', text: 'Puis glisse-la de colonne en colonne.' },
  { path: '/chat', target: 'composer', title: 'Le chat', text: '@ pour mentionner, /tache pour créer une tâche.' },
  { path: '/', target: 'profile', title: 'Ton compte', text: 'Profil, comptes liés, thème et réglages.' },
]

/** Visite de l'app après l'introduction, une fois par compte ; « Revoir la visite » la relance. */
export function AppTour() {
  const { user, backend, workspace } = useStore()
  const me = workspace?.members.find((m) => m.id === user?.id)
  const steps = me && me.role !== 'admin' ? GUEST_STEPS : STEPS
  const uid = user?.id ?? ''
  // Déjà faite sur un autre appareil : le compte le sait, on ne la remontre pas.
  const [open, setOpen] = useState(() => !!uid && !tourDone(uid) && !user?.onboarded)
  const close = useCallback(() => {
    finishTour(uid)
    setOpen(false)
    if (!user?.onboarded) void backend.markOnboarded().catch(() => undefined)
  }, [uid, user?.onboarded, backend])
  useEffect(() => {
    const again = () => setOpen(true)
    window.addEventListener('kollab:tour', again)
    return () => window.removeEventListener('kollab:tour', again)
  }, [])
  if (!open) return null
  return <SpotlightTour steps={steps} onClose={close} finish={(done) => <button className="btn small" onClick={done} autoFocus>Terminer</button>} />
}
