import { useSyncExternalStore } from 'react'

/** État des PR liées aux tâches, rempli par la vérification régulière du store, lu par les cartes. */
export interface PrState {
  merged: boolean
  closed: boolean
  draft: boolean
  checks: { failed: number; running: number; passed: number; total: number } | null
}

const states = new Map<string, PrState>()
const subs = new Set<() => void>()
let version = 0

export function setPrState(url: string, s: PrState) {
  states.set(url, s)
  version++
  subs.forEach((f) => f())
}

export function usePrState(url: string | null): PrState | undefined {
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f) }, () => version)
  return url ? states.get(url) : undefined
}
