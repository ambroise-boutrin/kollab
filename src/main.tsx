import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Splash } from './components/Splash'
import { ToastProvider } from './components/Toast'
import { StoreProvider } from './lib/store'
import { startUpdates } from './lib/updates'
import { UpdateDialog } from './components/UpdateDialog'
import { applyTheme, loadThemeChoice } from './lib/themes'
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import './styles.css'

applyTheme(loadThemeChoice())
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(loadThemeChoice()))

// Mises à jour : updater Tauri sur le bureau, service worker (hors ligne compris) sur le web.
startUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <Splash />
        <App />
        <UpdateDialog />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
)
