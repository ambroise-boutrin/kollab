import { useSyncExternalStore } from 'react'
import { ghToken } from './github'

/** Vrai quand un jeton GitHub est là ; se met à jour dès qu'il arrive ou part, sans recharger. */
export function useGhLinked(): boolean {
  return useSyncExternalStore(
    (f) => {
      const evs = ['kollab:gh-token', 'kollab:gh-expired', 'storage', 'focus']
      evs.forEach((e) => window.addEventListener(e, f))
      return () => evs.forEach((e) => window.removeEventListener(e, f))
    },
    () => !!ghToken(),
  )
}
