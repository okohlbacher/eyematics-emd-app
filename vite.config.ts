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
    host: 'localhost',
    proxy: {
      // Proxy FHIR requests to avoid CORS issues during development
      '/fhir': {
        target: 'http://127.0.0.1:8080',
        changeOrigin: true,
      },
      // Proxy API requests to the Express backend during development.
      // Use 127.0.0.1 (not 'localhost') so this matches Express's IPv4 bind
      // and avoids IPv6 (::1) resolution failures on macOS.
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
})
