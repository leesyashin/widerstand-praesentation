import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { showPlugin } from './server/showPlugin'
import { studioFiles } from './server/vitePlugin'

// Gehostete App (npm run build:cloud auf Vercel): Repo und Branch aus Vercels Build-Umgebung übernehmen,
// damit beim Anmelden nur noch der Zugangsschlüssel fehlt.
const { VERCEL_GIT_REPO_OWNER: owner, VERCEL_GIT_REPO_SLUG: slug, VERCEL_GIT_COMMIT_REF: ref } = process.env
if (owner && slug) process.env.VITE_GITHUB_REPO ??= `${owner}/${slug}`
if (ref) process.env.VITE_GITHUB_BRANCH ??= ref

export default defineConfig({
  // showPlugin vor studioFiles: dessen /api-Handler beantwortet unbekannte Pfade mit 404.
  plugins: [react(), showPlugin(), studioFiles()],
  // Erzeugtes (Web-Player, Exporte, Screenshots) soll den Editor nicht neu laden.
  server: { watch: { ignored: ['**/published/**', '**/exports/**', '**/shots/**'] } },
})
