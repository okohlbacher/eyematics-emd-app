import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'

// API endpoints are served by the Express backend at :3000 in dev
// (proxied below) and by the same Express process in production.
// The previous in-Vite API shims (issueApiPlugin / settingsApiPlugin /
// fhirApiPlugin) duplicated server logic and drifted out of sync with
// the real JWT auth middleware — they have been removed so there is a
// single source of truth for every /api/* route.

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as { version: string };

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Proxy FHIR requests to avoid CORS issues during development
      '/fhir': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
      // Proxy API requests to the Express backend during development
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
