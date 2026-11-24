import { useEffect, useState } from 'react'
import { backend } from './lib/store'

/**
 * Petite fenêtre de connexion GitHub : elle reçoit le retour de GitHub, range le jeton sur le compte,
 * puis se ferme. Kollab, resté ouvert derrière, reprend tout seul.
 */
export default function GitHubDone() {
  const [state, setState] = useState<'wait' | 'ok' | 'fail'>('wait')

  useEffect(() => {
    // Le client lit le retour de GitHub dans l'adresse et range le jeton (voir onAuthChange).
    const stop = backend.onAuthChange(() => undefined)
    let alive = true
    const failed = /error=/.test(window.location.hash + window.location.search)
    // Retour avec une session : la liaison est faite (Google, Discord…). Pour GitHub, on attend aussi le jeton.
    const signedIn = /access_token=/.test(window.location.hash) || /code=/.test(window.location.search)
    void (async () => {
      if (failed) return setState('fail')
      for (let i = 0; i < 20 && alive; i++) {
        if ((await backend.syncGitHub().catch(() => false)) || (signedIn && i >= 4)) {
          setState('ok')
          // Un popup se ferme seul ; un onglet du navigateur (appli d'ordi) reste avec le message.
          setTimeout(() => window.close(), 900)
          return
        }
        await new Promise((r) => setTimeout(r, 500))
      }
      if (alive) setState('fail')
    })()
    return () => { alive = false; stop() }
  }, [])

  return (
    <main className="gh-done">
      <div className={`gh-done-card ${state}`}>
        <span className="gh-done-ico" aria-hidden="true">
          {state === 'ok' ? '✓' : state === 'fail' ? '!' : ''}
        </span>
        <h1>{state === 'ok' ? 'C’est relié' : state === 'fail' ? 'Connexion interrompue' : 'Connexion…'}</h1>
        <p>
          {state === 'ok'
            ? 'Tu peux fermer cette fenêtre et revenir dans Kollab.'
            : state === 'fail'
              ? 'Ferme cette fenêtre et réessaie depuis Kollab.'
              : 'Un instant, on range ta connexion.'}
        </p>
        {state !== 'wait' && <button className="btn" onClick={() => window.close()}>Fermer</button>}
      </div>
    </main>
  )
}
