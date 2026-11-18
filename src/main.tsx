import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { IS_TAURI } from './lib/base'
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

if (showApp) {
  applyTheme(loadThemeChoice())
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(loadThemeChoice()))
}

// Hors ligne pour la version web. L'appli bureau embarque déjà tous ses fichiers.
if (!IS_TAURI && 'serviceWorker' in navigator) {
  void import('virtual:pwa-register').then(({ registerSW }) => registerSW({ immediate: true }))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{showApp ? <AppRoot installed={installed} /> : <Site />}</Suspense>
  </StrictMode>,
)
