import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { issueApiPlugin } from './server/issueApi'
import { settingsApiPlugin } from './server/settingsApi'

export default defineConfig({
  plugins: [react(), tailwindcss(), issueApiPlugin(), settingsApiPlugin()],
  server: {
    proxy: {
      // Proxy FHIR requests to avoid CORS issues during development
      '/fhir': {
        target: 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
})
