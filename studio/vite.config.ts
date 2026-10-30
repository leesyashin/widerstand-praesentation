import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { showPlugin } from './server/showPlugin'
import { studioFiles } from './server/vitePlugin'

export default defineConfig({
  // showPlugin vor studioFiles: dessen /api-Handler beantwortet unbekannte Pfade mit 404.
  plugins: [react(), showPlugin(), studioFiles()],
})
