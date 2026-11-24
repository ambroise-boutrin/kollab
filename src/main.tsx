import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { IS_TAURI } from './lib/base'
import { startUpdates } from './lib/updates'
import { blockPinchZoom, trackViewport } from './lib/viewport'
import { applyTheme, loadThemeChoice } from './lib/themes'
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import './styles.css'

/**
 * Deux entrées dans la même appli :
 * - `/` : le site de présentation (vitrine), pour les visiteurs du web ;
 * - `/app` : l'outil lui-même.
 * Dans Tauri, l'outil est servi à la racine, sans vitrine. Une PWA installée ouvre toujours l'outil.
 */
const installed =
  IS_TAURI ||
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

const { pathname, search, hash } = window.location
const inApp = pathname === '/app' || pathname.startsWith('/app/')
const invited = new URLSearchParams(search).has('invitation')
// Web : anciens liens d'invitation (/?invitation=…) et PWA installée, direction l'outil sous /app.
if (!IS_TAURI && !inApp && (installed || invited)) {
  window.history.replaceState(null, '', `/app/${search}${hash}`)
}
const showApp = IS_TAURI || inApp || installed || invited

const AppRoot = lazy(() => import('./AppRoot'))
const Site = lazy(() => import('./site/Site'))
const GitHubDone = lazy(() => import('./GitHubDone'))
// Petite fenêtre de connexion GitHub ouverte par l'app : pas d'app complète dedans.
const ghPopup = new URLSearchParams(search).has('gh-popup')

if (showApp) {
  blockPinchZoom()
  applyTheme(loadThemeChoice())
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(loadThemeChoice()))
}

// Mises à jour : updater Tauri sur le bureau, service worker (hors ligne compris) sur le web.
startUpdates()
trackViewport()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{ghPopup ? <GitHubDone /> : showApp ? <AppRoot installed={installed} /> : <Site />}</Suspense>
  </StrictMode>,
)
