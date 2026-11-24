/** Versions des CGU et CGV, à changer (avec la date) à chaque modification. L'app enregistre la version des CGU acceptée. */
export const CGU_VERSION = '1.1'
export const CGV_VERSION = '1.0'
export const LEGAL_UPDATED = '24 novembre 2026'
export const LEGAL_UPDATED_EN = '24 November 2026'

/** Chemins des pages juridiques du site vitrine (version française, qui fait foi). */
export const LEGAL_PATHS = {
  mentions: '/mentions-legales',
  cgu: '/cgu',
  cgv: '/cgv',
  confidentialite: '/confidentialite',
  cookies: '/cookies',
} as const
