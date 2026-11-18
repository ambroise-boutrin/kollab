import type { PushApi } from './backend'
import { IS_TAURI } from './base'

/** 'ok' : disponible ; 'ios-install' : iPhone, il faut d'abord ajouter Kollab à l'écran d'accueil ; 'no' : pas possible ici. */
export type PushSupport = 'ok' | 'ios-install' | 'no'

const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
const standalone = () => window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true

export function pushSupport(): PushSupport {
  if (IS_TAURI) return 'no'
  const ok = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window
  if (isIos() && !standalone()) return 'ios-install'
  return ok ? 'ok' : 'no'
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  // En développement il n'y a pas de service worker : on n'attend pas indéfiniment.
  return Promise.race([navigator.serviceWorker.ready, new Promise<null>((r) => setTimeout(() => r(null), 4000))])
}

function keyBytes(b64: string) {
  const s = atob((b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(s, (c) => c.charCodeAt(0))
}

export async function pushEnabled(): Promise<boolean> {
  if (pushSupport() !== 'ok' || Notification.permission !== 'granted') return false
  const r = await registration()
  return !!(await r?.pushManager.getSubscription())
}

export async function enablePush(api: PushApi) {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') throw new Error(perm === 'denied' ? 'Notifications bloquées : autorise-les dans les réglages du navigateur.' : 'Notifications non autorisées')
  const r = await registration()
  if (!r) throw new Error('Recharge la page puis réessaie.')
  const key = await api.publicKey()
  const sub = (await r.pushManager.getSubscription()) ?? (await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }))
  await api.subscribe(sub.toJSON())
}

export async function disablePush(api: PushApi) {
  const r = await registration()
  const sub = await r?.pushManager.getSubscription()
  if (!sub) return
  await api.unsubscribe(sub.endpoint)
  await sub.unsubscribe().catch(() => undefined)
}

/** Au lancement : rattache l'appareil au compte connecté (utile après un changement de compte). */
export async function syncPush(api: PushApi) {
  if (!(await pushEnabled())) return
  const sub = await (await registration())?.pushManager.getSubscription()
  if (sub) await api.subscribe(sub.toJSON()).catch(() => undefined)
}
