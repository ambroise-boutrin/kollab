import { useSyncExternalStore } from 'react'
import { ghLinked } from './github'

/** Vrai quand GitHub est relié au compte ; se met à jour dès qu'il arrive ou part, sans recharger. */
export function useGhLinked(): boolean {
  return useSyncExternalStore(
    (f) => {
      const evs = ['kollab:gh-token', 'kollab:gh-expired', 'storage', 'focus']
      evs.forEach((e) => window.addEventListener(e, f))
      return () => evs.forEach((e) => window.removeEventListener(e, f))
    },
    () => ghLinked(),
  )
}
