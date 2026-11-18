import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Icon } from './Icon'
import { ProjectForm } from './ProjectForm'
import { useToast } from './Toast'

/** Fenêtre « Nouveau projet ou rejoindre », ouverte depuis le sélecteur de projet. */
export function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { switchGroup } = useStore()
  const navigate = useNavigate()
  const toast = useToast()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-back" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="new-project-title">
        <div className="modal-head">
          <h2 id="new-project-title">Nouveau projet</h2>
          <button className="icon-btn" aria-label="Fermer" onClick={onClose}><Icon name="close" size={18} /></button>
        </div>
        <ProjectForm
          onDone={async ({ id, how }) => {
            await switchGroup(id)
            onClose()
            navigate('/')
            toast(how === 'created' ? 'Projet créé' : 'Tu as rejoint le projet')
          }}
        />
      </div>
    </div>
  )
}
