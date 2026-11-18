import { IS_DESKTOP } from './updates'

/** Adresse du site vitrine, où vivent les pages juridiques. Vide dans l'appli bureau tant qu'elle n'est pas définie. */
export const SITE_URL = (import.meta.env.VITE_SITE_URL as string | undefined) || (IS_DESKTOP ? '' : window.location.origin)

/** Ouvre un lien dans le navigateur (et pas dans la fenêtre de l'appli bureau). */
export async function openExternal(url: string) {
  if (IS_DESKTOP) {
    const { openUrl } = await import('@tauri-apps/plugin-opener')
    await openUrl(url)
  } else window.open(url, '_blank', 'noopener')
}
