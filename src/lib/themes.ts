export interface Theme {
  id: string
  name: string
  dark: boolean
  bg: string
  surface: string
  subtle: string
  line: string
  text: string
  muted: string
  accent: string
  ok: string
  danger: string
}

export const THEMES: Theme[] = [
  { id: 'indigo', name: 'Indigo', dark: false, bg: '#F5F6FA', surface: '#FFFFFF', subtle: '#EFF1F6', line: '#E3E7F0', text: '#14142B', muted: '#5D6275', accent: '#5546E0', ok: '#2E7D4F', danger: '#B5462E' },
  { id: 'nuit', name: 'Nuit', dark: true, bg: '#13141C', surface: '#1D1F2B', subtle: '#262938', line: '#30344A', text: '#F1F2F7', muted: '#A4A9BC', accent: '#6E62E8', ok: '#2F8A57', danger: '#C4553E' },
  { id: 'menthe', name: 'Menthe', dark: false, bg: '#EEF7F3', surface: '#FFFFFF', subtle: '#E2F0EA', line: '#D2E5DC', text: '#14251D', muted: '#4D6359', accent: '#0F7A63', ok: '#2F6FD0', danger: '#B5462E' },
  { id: 'corail', name: 'Corail', dark: false, bg: '#FFF4F1', surface: '#FFFFFF', subtle: '#FCE8E3', line: '#F3D7CF', text: '#2A1B18', muted: '#6B5550', accent: '#C2413A', ok: '#2E7D4F', danger: '#9C2F22' },
  { id: 'ocean', name: 'Océan', dark: false, bg: '#EEF4FB', surface: '#FFFFFF', subtle: '#E2ECF8', line: '#D3E0F0', text: '#122033', muted: '#4F5F75', accent: '#1F5FC4', ok: '#2E7D4F', danger: '#B5462E' },
]

const KEY = 'kollab-theme'

export interface ThemeChoice {
  id: string
  /** Couleur principale personnalisée, remplace celle du thème. */
  accent: string | null
  /** Suit le mode clair/sombre de l'appareil (Nuit la nuit). */
  followSystem: boolean
}

export function loadThemeChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { id: 'indigo', accent: null, followSystem: false, ...JSON.parse(raw) }
  } catch {
    /* ignoré */
  }
  return { id: 'indigo', accent: null, followSystem: true }
}

export function saveThemeChoice(choice: ThemeChoice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice))
  } catch {
    /* ignoré */
  }
}

/* --- Thèmes créés par l'utilisateur (gardés sur l'appareil) --- */

const CUSTOM_KEY = 'kollab-themes-perso'

function hex(c: string): [number, number, number] {
  const v = c.replace('#', '')
  const n = parseInt(v.length === 3 ? v.split('').map((x) => x + x).join('') : v, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}
/** Mélange deux couleurs : t = part de b (0 à 1). */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = hex(a)
  const [r2, g2, b2] = hex(b)
  const m = (x: number, y: number) => Math.round(x + (y - x) * t).toString(16).padStart(2, '0')
  return `#${m(r1, r2)}${m(g1, g2)}${m(b1, b2)}`.toUpperCase()
}
export function isDark(c: string): boolean {
  const [r, g, b] = hex(c)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 128
}

/** Thème complet à partir de quatre couleurs ; les nuances intermédiaires sont calculées. */
export function makeTheme(id: string, name: string, c: { bg: string; surface: string; text: string; accent: string }): Theme {
  const dark = isDark(c.bg)
  return {
    id,
    name,
    dark,
    bg: c.bg,
    surface: c.surface,
    subtle: mix(c.surface, c.text, dark ? 0.08 : 0.05),
    line: mix(c.surface, c.text, dark ? 0.16 : 0.1),
    text: c.text,
    muted: mix(c.text, c.bg, 0.4),
    accent: c.accent,
    ok: dark ? '#2F8A57' : '#2E7D4F',
    danger: dark ? '#C4553E' : '#B5462E',
  }
}

export function customThemes(): Theme[] {
  try {
    return JSON.parse(localStorage.getItem(CUSTOM_KEY) ?? '[]') as Theme[]
  } catch {
    return []
  }
}
export function saveCustomTheme(t: Theme) {
  const list = customThemes().filter((x) => x.id !== t.id)
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify([...list, t]))
  } catch {
    /* ignoré */
  }
}
export function deleteCustomTheme(id: string) {
  try {
    localStorage.setItem(CUSTOM_KEY, JSON.stringify(customThemes().filter((x) => x.id !== id)))
  } catch {
    /* ignoré */
  }
}
export const allThemes = () => [...THEMES, ...customThemes()]

/** Applique un thème tel quel (aperçu pendant l'édition). */
export function applyThemeObject(t: Theme, accent: string | null = null) {
  paint(t, accent)
}

export function applyTheme(choice: ThemeChoice) {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const id = choice.followSystem && prefersDark ? 'nuit' : choice.id
  const t = allThemes().find((x) => x.id === id) ?? THEMES[0]
  paint(t, choice.accent)
}

function paint(t: Theme, accent: string | null) {
  const choice = { accent }
  const root = document.documentElement
  const set = (k: string, v: string) => root.style.setProperty(k, v)
  set('--bg', t.bg)
  set('--surface', t.surface)
  set('--subtle', t.subtle)
  set('--line', t.line)
  set('--text', t.text)
  set('--muted', t.muted)
  set('--accent', choice.accent ?? t.accent)
  set('--ok', t.ok)
  set('--danger', t.danger)
  set('--shadow-rgb', t.dark ? '0,0,0' : '40,48,80')
  root.dataset.dark = String(t.dark)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg)
}
