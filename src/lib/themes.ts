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

export function applyTheme(choice: ThemeChoice) {
  const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
  const id = choice.followSystem && prefersDark ? 'nuit' : choice.id
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0]
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
