// v1.20.1: fonts are self-hosted (bundled by Vite) — no Google Fonts request: the production CSP
// blocked it anyway, and in dev it sent every visitor's IP to Google.
import '@fontsource-variable/inter'
import '@fontsource-variable/jetbrains-mono'
import './index.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
