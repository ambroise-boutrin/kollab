import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { Splash } from './components/Splash'
import { ToastProvider } from './components/Toast'
import { StoreProvider } from './lib/store'
import { applyTheme, loadThemeChoice } from './lib/themes'
import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import './styles.css'

applyTheme(loadThemeChoice())
window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener('change', () => applyTheme(loadThemeChoice()))

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <ToastProvider>
        <Splash />
        <App />
      </ToastProvider>
    </StoreProvider>
  </StrictMode>,
)
