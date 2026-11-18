import { App } from './App'
import { Splash } from './components/Splash'
import { UpdateDialog } from './components/UpdateDialog'
import { ToastProvider } from './components/Toast'
import { DemoTour } from './components/DemoTour'
import { DEMO_SESSION, StoreProvider } from './lib/store'

/** L'outil Kollab, servi sous /app sur le web et à la racine dans Tauri. L'animation de lancement n'apparaît que dans l'app installée. */
export default function AppRoot({ installed }: { installed: boolean }) {
  return (
    <StoreProvider>
      <ToastProvider>
        {installed && <Splash />}
        <App />
        {DEMO_SESSION && <DemoTour />}
        <UpdateDialog />
      </ToastProvider>
    </StoreProvider>
  )
}
