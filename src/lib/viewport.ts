/**
 * Suit la zone réellement visible (clavier ouvert sur téléphone) dans --vv-h / --vv-top,
 * pour que les fenêtres restent au-dessus du clavier.
 */
export function trackViewport() {
  const vv = window.visualViewport
  if (!vv) return
  const root = document.documentElement.style
  let raf = 0
  const set = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(() => {
      root.setProperty('--vv-h', `${vv.height}px`)
      root.setProperty('--vv-top', `${vv.offsetTop}px`)
      document.documentElement.classList.toggle('kb-open', window.innerHeight - vv.height > 120)
    })
  }
  vv.addEventListener('resize', set)
  vv.addEventListener('scroll', set)
  set()
}

/** Pas de zoom à deux doigts dans l'appli (iOS ignore user-scalable=no). */
export function blockPinchZoom() {
  const stop = (e: Event) => e.preventDefault()
  document.addEventListener('gesturestart', stop, { passive: false })
  document.addEventListener('gesturechange', stop, { passive: false })
  document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault() }, { passive: false })
}
