import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

const buildTime = new Date().toISOString()

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.0.0'),
    __BUILD_TIME__: JSON.stringify(buildTime),
    __COMMIT__: JSON.stringify((process.env.VERCEL_GIT_COMMIT_SHA ?? 'local').slice(0, 7)),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icons/*.svg', 'icons/*.png', 'sample-receipt.svg', 'offline.html'],
      manifest: {
        name: 'TAMS AP Booking (Prototype)',
        short_name: 'TAMS AP',
        description: 'Booking management prototype with sample data',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#1D3A7A',
        background_color: '#F5EFE3',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,woff2,webmanifest}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/sw\.js$/, /^\/manifest\.webmanifest$/, /^\/workbox-/],
        cleanupOutdatedCaches: true,
        // Photos are large, so they are not precached: each one is cached the first time it is shown.
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/images/photos/'),
            handler: 'CacheFirst',
            options: { cacheName: 'photos', expiration: { maxEntries: 120, maxAgeSeconds: 60 * 60 * 24 * 30 }, cacheableResponse: { statuses: [0, 200] } },
          },
        ],
      },
    }),
  ],
})
