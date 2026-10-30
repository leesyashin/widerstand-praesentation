import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Grundstile zuerst, damit Komponenten-Stile sie gezielt überschreiben können.
import './ui/tokens.css'
import './ui/base.css'
import { CLOUD, loadConfig } from './api/cloud/config'
import { startWorker, syncWorkerConfig } from './api/cloud/worker'
import { App } from './app/App'

// Gehostet (Phase 7): erst den Service Worker für Medien aus dem Repo starten, dann die App.
async function start() {
  if (CLOUD) {
    await syncWorkerConfig(loadConfig()).catch(() => {})
    await startWorker()
  }
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

void start()
