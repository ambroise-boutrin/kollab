import { useCallback, useEffect, useState } from 'react'
import { finishTour, tourDone } from '../lib/intro'
import { useStore } from '../lib/store'
import { SpotlightTour, type TourStep } from './DemoTour'

const STEPS: TourStep[] = [
  { path: '/', target: 'project', title: 'Ton projet', text: 'Change de projet, crée-en un autre ou ouvre ses réglages.' },
  { path: '/', target: 'nav', title: 'Navigation', text: 'Accueil, tableau du sprint, chat et équipe.' },
  { path: '/', target: 'members', title: 'Qui est là', text: 'Les membres du projet, ceux en ligne en premier.' },
  { path: '/tableau', target: 'new-task', title: 'Ajouter une tâche', text: 'Puis glisse-la de colonne en colonne.' },
  { path: '/chat', target: 'composer', title: 'Le chat', text: '@ pour mentionner, /tache pour créer une tâche.' },
  { path: '/', target: 'profile', title: 'Ton compte', text: 'Profil, comptes liés, thème et réglages.' },
]

/** Visite de l'app après l'introduction, une fois par appareil ; « Revoir la visite » la relance. */
export function AppTour() {
  const { user } = useStore()
  const uid = user?.id ?? ''
  const [open, setOpen] = useState(() => !!uid && !tourDone(uid))
  const close = useCallback(() => {
    finishTour(uid)
    setOpen(false)
  }, [uid])
  useEffect(() => {
    const again = () => setOpen(true)
    window.addEventListener('kollab:tour', again)
    return () => window.removeEventListener('kollab:tour', again)
  }, [])
  if (!open) return null
  return <SpotlightTour steps={STEPS} onClose={close} finish={(done) => <button className="btn small" onClick={done} autoFocus>Terminer</button>} />
}
