import { App } from './App'
import { Splash } from './components/Splash'
import { ToastProvider } from './components/Toast'
import { StoreProvider } from './lib/store'

/** L'outil Kollab, servi sous /app. L'animation de lancement n'apparaît que dans l'app installée. */
export default function AppRoot({ installed }: { installed: boolean }) {
  return (
    <StoreProvider>
      <ToastProvider>
        {installed && <Splash />}
        <App />
      </ToastProvider>
    </StoreProvider>
  )
}
