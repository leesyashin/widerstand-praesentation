import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Grundstile zuerst, damit Komponenten-Stile sie gezielt überschreiben können.
import './ui/tokens.css'
import './ui/base.css'
import { App } from './app/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
