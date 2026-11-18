import { useId } from 'react'

/** Le K de Kollab : une pilule verticale et deux pilules en diagonale. */
export function LogoMark({ size = 30, animated = false }: { size?: number; animated?: boolean }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}a`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5B4FE9" />
          <stop offset="1" stopColor="#4338CA" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#C4A6FB" />
          <stop offset="1" stopColor="#6D5BF0" />
        </linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#7C5CF5" />
          <stop offset="1" stopColor="#A274F7" />
        </linearGradient>
      </defs>
      <g className={animated ? 'pA' : undefined}>
        <rect x="4" y="4" width="13" height="32" rx="6.5" fill={`url(#${id}a)`} />
      </g>
      <g className={animated ? 'pC' : undefined}>
        <rect x="15" y="17" width="20" height="13" rx="6.5" transform="rotate(45 25 23.5)" fill={`url(#${id}c)`} />
      </g>
      <g className={animated ? 'pB' : undefined}>
        <rect x="9" y="11" width="28" height="13" rx="6.5" transform="rotate(-45 23 17.5)" fill={`url(#${id}b)`} />
      </g>
    </svg>
  )
}
