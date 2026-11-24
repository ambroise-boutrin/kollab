/** L'appli bureau Tauri sert l'outil à la racine ; sur le web, la vitrine occupe `/` et l'outil vit sous `/app`. */
export const IS_TAURI = '__TAURI_INTERNALS__' in window

/** Préfixe des routes de l'outil : `''` dans Tauri, `'/app'` sur le web. */
export const APP_BASE = IS_TAURI ? '' : '/app'

/** L'outil sur le web : l'appli d'ordi y renvoie la connexion GitHub, ouverte dans le navigateur. */
export const WEB_APP = 'https://kollab-tan-nu.vercel.app/app'
