import changelog from '../changelog.json'

/** Une entrée de l'historique des versions (src/changelog.json). */
export interface Release {
  version: string
  date: string
  title: string
  items: string[]
}

export const RELEASES = changelog as Release[]
export const APP_VERSION = __APP_VERSION__
export const IS_DESKTOP = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export interface PendingUpdate {
  version: string | null
  items: string[]
  /** Télécharge et installe ; onProgress reçoit une fraction de 0 à 1, ou null si la taille est inconnue. */
  install(onProgress: (fraction: number | null) => void): Promise<void>
}

type Listener = (u: PendingUpdate | null) => void
const listeners = new Set<Listener>()
let pending: PendingUpdate | null = null

function publish(u: PendingUpdate | null) {
  pending = u
  listeners.forEach((cb) => cb(u))
}

export function onUpdate(cb: Listener): () => void {
  listeners.add(cb)
  cb(pending)
  return () => listeners.delete(cb)
}

/** Nouveautés d'une version : d'abord le fichier local, sinon les notes de la release GitHub. */
function notesFromBody(body: string | undefined): string[] {
  return (body ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.startsWith('- '))
    .map((l) => l.slice(2))
}

/* --- Appli bureau : updater Tauri branché sur les releases GitHub --- */

async function checkDesktop(): Promise<boolean> {
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check()
  if (!update) return false
  publish({
    version: update.version,
    items: notesFromBody(update.body),
    async install(onProgress) {
      let total = 0
      let done = 0
      await update.downloadAndInstall((e) => {
        if (e.event === 'Started') total = e.data.contentLength ?? 0
        else if (e.event === 'Progress') {
          done += e.data.chunkLength
          onProgress(total ? Math.min(done / total, 1) : null)
        } else onProgress(1)
      })
      onProgress(1)
      // Laisse le temps au fondu de fin avant de relancer.
      await new Promise((r) => setTimeout(r, 700))
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    },
  })
  return true
}

/* --- Version web (PWA) : nouveau service worker prêt --- */

let reloadWeb: ((reload?: boolean) => Promise<void>) | null = null
let registration: ServiceWorkerRegistration | undefined

async function latestReleaseNotes(): Promise<{ version: string | null; items: string[] }> {
  try {
    const r = await fetch('https://api.github.com/repos/ambroise-boutrin/kollab/releases/latest')
    if (!r.ok) throw new Error()
    const j = (await r.json()) as { tag_name?: string; body?: string }
    return { version: j.tag_name?.replace(/^v/, '') ?? null, items: notesFromBody(j.body) }
  } catch {
    return { version: null, items: [] }
  }
}

export function startUpdates() {
  // Aperçu de la fenêtre de mise à jour : ajoute ?apercu-mise-a-jour à l'adresse.
  if (new URLSearchParams(window.location.search).has('apercu-mise-a-jour')) {
    publish({
      version: '0.2.0',
      items: ['Poker planning en direct', 'Sprints et graphique d’avancement', 'Relecture des PR GitHub dans Kollab'],
      async install(onProgress) {
        for (let i = 1; i <= 20; i++) {
          await new Promise((r) => setTimeout(r, 90))
          onProgress(i / 20)
        }
        await new Promise((r) => setTimeout(r, 900))
        document.documentElement.classList.remove('restarting')
        dismissUpdate()
      },
    })
  }
  if (IS_DESKTOP) {
    const run = () => void checkDesktop().catch(() => {})
    setTimeout(run, 4000)
    setInterval(run, 6 * 3600 * 1000)
    return
  }
  if (!('serviceWorker' in navigator)) return
  void import('virtual:pwa-register').then(({ registerSW }) => {
    reloadWeb = registerSW({
      immediate: true,
      onRegisteredSW(_url, r) {
        registration = r
        if (r) setInterval(() => void r.update(), 3600 * 1000)
      },
      async onNeedRefresh() {
        const notes = await latestReleaseNotes()
        publish({
          ...notes,
          async install(onProgress) {
            onProgress(1)
            await new Promise((r) => setTimeout(r, 700))
            await reloadWeb?.(true)
          },
        })
      },
    })
  })
}

/** Bouton « Rechercher une mise à jour ». Renvoie true si une version est prête. */
export async function checkNow(): Promise<boolean> {
  if (pending) {
    publish(pending)
    return true
  }
  if (IS_DESKTOP) return checkDesktop()
  await registration?.update()
  await new Promise((r) => setTimeout(r, 1500))
  return pending !== null
}

export function dismissUpdate() {
  listeners.forEach((cb) => cb(null))
}
