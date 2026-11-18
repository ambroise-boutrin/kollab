import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import changelog from './src/changelog.json' with { type: 'json' }
import pkg from './package.json' with { type: 'json' }
import { VitePWA } from 'vite-plugin-pwa'

const BUILD_ID = String(Date.now())

/** Écrit /version.json : la page compare son build à celui en ligne pour proposer de recharger. */
function versionFile(): Plugin {
  return {
    name: 'kollab-version',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version: pkg.version, build: BUILD_ID, release: changelog[0] }) })
    },
  }
}

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version), __BUILD_ID__: JSON.stringify(BUILD_ID) },
  // Le serveur de dev de Tauri attend ce port précis.
  server: { port: 5173, strictPort: true },
  plugins: [
    react(),
    versionFile(),
    VitePWA({
      // Enregistré à la main dans main.tsx, pour ne pas le faire dans l'appli bureau.
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['logo.svg'],
      // Polices et icônes en cache : chargement instantané et hors ligne.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], globIgnores: ['version.json'],
        cleanupOutdatedCaches: true,
        // Le cache hors ligne ne sert que l'appli : le site vitrine se charge toujours depuis le réseau, donc toujours à jour.
        navigateFallbackAllowlist: [/^\/app(\/|$)/],
        directoryIndex: '__aucun__',
      },
      manifest: {
        name: 'Kollab',
        short_name: 'Kollab',
        description: "Gestion de projet, revues de code et chat d'équipe.",
        lang: 'fr',
        start_url: '/app/',
        scope: '/',
        display: 'standalone',
        background_color: '#F5F6FA',
        theme_color: '#5546E0',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
