/** Logo du projet : l'image choisie, sinon une composition géométrique propre au projet. */
const PALETTE = ['#5546E0', '#2F6FD0', '#0F7A63', '#2E7D4F', '#D9822B', '#C2413A', '#9B3FB8', '#D6457A', '#14142B']

function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** Quatre compositions en aplats, couleurs tirées de l'identifiant du projet. */
function Shapes({ seed, color }: { seed: string; color?: string | null }) {
  const h = hash(seed)
  const bg = color || PALETTE[h % PALETTE.length]
  let alt = color ? (color === '#FFD23F' ? '#14142B' : '#FFD23F') : PALETTE[(h >>> 4) % PALETTE.length]
  if (alt === bg) alt = PALETTE[(h + 3) % PALETTE.length]
  const kind = (h >>> 8) % 4
  const rot = ((h >>> 12) % 4) * 90
  return (
    <svg viewBox="0 0 40 40" width="100%" height="100%" aria-hidden="true">
      <rect width="40" height="40" fill={bg} />
      <g transform={`rotate(${rot} 20 20)`}>
        {kind === 0 && (<><circle cx="40" cy="40" r="26" fill={alt} /><circle cx="13" cy="13" r="7" fill="#fff" /></>)}
        {kind === 1 && (<><path d="M0 40 A20 20 0 0 1 40 40 Z" fill="#fff" /><circle cx="20" cy="40" r="9" fill={alt} /></>)}
        {kind === 2 && (<><rect x="20" y="0" width="20" height="20" fill={alt} /><path d="M0 40 V20 A20 20 0 0 1 20 40 Z" fill="#fff" /></>)}
        {kind === 3 && (<><path d="M0 0 H40 L0 40 Z" fill={alt} /><circle cx="28" cy="28" r="7" fill="#fff" /></>)}
      </g>
    </svg>
  )
}

/** Couleurs proposées à la création d'un projet. */
export const PROJECT_COLORS = [
  { id: '#5546E0', label: 'Indigo' },
  { id: '#FFD23F', label: 'Jaune' },
  { id: '#FF7262', label: 'Corail' },
  { id: '#0F7A63', label: 'Vert' },
  { id: '#2F6FD0', label: 'Bleu' },
]

export function ProjectMark({ id, logoUrl, color, size = 32, radius }: { id: string; logoUrl?: string | null; color?: string | null; size?: number; radius?: number }) {
  return (
    <span className="project-mark" style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.28) }} aria-hidden="true">
      {logoUrl ? <img src={logoUrl} alt="" width={size} height={size} /> : <Shapes seed={id} color={color} />}
    </span>
  )
}
