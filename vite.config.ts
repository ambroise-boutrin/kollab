import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import pkg from './package.json' with { type: 'json' }
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  // Le serveur de dev de Tauri attend ce port précis.
  server: { port: 5173, strictPort: true },
  plugins: [
    react(),
    VitePWA({
      // Enregistré à la main dans main.tsx, pour ne pas le faire dans l'appli bureau.
      injectRegister: false,
      registerType: 'prompt',
      includeAssets: ['logo.svg'],
      // Polices et icônes en cache : chargement instantané et hors ligne.
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,woff2}'] },
      manifest: {
        name: 'Kollab',
        short_name: 'Kollab',
        description: "Gestion de projet, revues de code et chat d'équipe.",
        lang: 'fr',
        start_url: '/',
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
