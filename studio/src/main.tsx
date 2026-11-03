import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Grundstile zuerst, damit Komponenten-Stile sie gezielt überschreiben können.
import './ui/tokens.css'
import './ui/base.css'
import { checkSession, CLOUD } from './api/cloud/config'
import { startWorker } from './api/cloud/worker'
import { App } from './app/App'

// Gehostet (Phase 7): Anmeldung prüfen und den Service Worker für Medien aus dem Repo starten, dann die App.
async function start() {
  if (CLOUD) await Promise.all([checkSession(), startWorker()])
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
