import { defineConfig, devices } from '@playwright/test'

// End-to-end check of the demo script against the production build (npm run build first).
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {},
  },
  webServer: { command: 'npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: true },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] }, testMatch: /customer/ },
    { name: 'laptop', use: { viewport: { width: 1366, height: 860 } }, testMatch: /admin|pwa/ },
  ],
})
