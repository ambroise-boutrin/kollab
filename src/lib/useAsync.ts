import { useCallback, useEffect, useState } from 'react'

/** Charge une donnée asynchrone ; `reload` relance. */
export function useAsync<T>(fn: (() => Promise<T>) | null, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])
  useEffect(() => {
    if (!fn) return
    let alive = true
    setLoading(true)
    setError(null)
    fn()
      .then((d) => alive && setData(d))
      .catch((e) => alive && setError(e instanceof Error ? e.message : 'Erreur'))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [...deps, tick]) // eslint-disable-line react-hooks/exhaustive-deps
  return { data, error, loading, reload, setData }
}
