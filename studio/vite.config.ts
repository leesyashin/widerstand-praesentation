import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { studioFiles } from './server/vitePlugin'

export default defineConfig({
  plugins: [react(), studioFiles()],
})
