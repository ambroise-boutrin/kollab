import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme, loadThemeChoice } from './lib/themes'
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import './styles.css'

/**
 * Deux entrées dans la même appli :
 * - `/` : le site de présentation (vitrine), pour les visiteurs du web ;
 * - `/app` : l'outil lui-même. Une app installée (PWA ou Tauri) ouvre toujours l'outil directement.
 */
const installed =
  window.matchMedia?.('(display-mode: standalone)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true ||
  '__TAURI_INTERNALS__' in window

const { pathname, search, hash } = window.location
const inApp = pathname === '/app' || pathname.startsWith('/app/')
// Anciens liens d'invitation (/?invitation=…) et app installée : direction l'outil.
if (!inApp && (installed || new URLSearchParams(search).has('invitation'))) {
  window.history.replaceState(null, '', `/app/${search}${hash}`)
}
const showApp = inApp || installed || new URLSearchParams(search).has('invitation')

const AppRoot = lazy(() => import('./AppRoot'))
const Site = lazy(() => import('./site/Site'))

if (showApp) {
  applyTheme(loadThemeChoice())
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(loadThemeChoice()))
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Suspense fallback={null}>{showApp ? <AppRoot installed={installed} /> : <Site />}</Suspense>
  </StrictMode>,
)
