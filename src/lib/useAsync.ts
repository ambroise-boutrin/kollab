import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Charge une donnée asynchrone ; `reload` relance.
 * `every` (ms) : rafraîchit en silence tant que la page est visible, et au retour sur la page.
 */
export function useAsync<T>(fn: (() => Promise<T>) | null, deps: unknown[], every = 0) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const silent = useRef(false)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    if (!fn) return
    let alive = true
    const quiet = silent.current
    silent.current = false
    if (!quiet) {
      setLoading(true)
      setError(null)
    }
    fn()
      .then((d) => {
        if (!alive) return
        setData(d)
        setError(null)
      })
      .catch((e) => alive && !quiet && setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [...deps, tick]) // eslint-disable-line react-hooks/exhaustive-deps

  const enabled = !!fn && every > 0
  useEffect(() => {
    if (!enabled) return
    const refresh = () => {
      if (document.visibilityState !== 'visible') return
      silent.current = true
      setTick((t) => t + 1)
    }
    const id = setInterval(refresh, every)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [enabled, every])

  return { data, error, loading, reload, setData }
}
