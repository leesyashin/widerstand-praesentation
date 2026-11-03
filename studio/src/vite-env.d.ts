/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" im Cloud-Build (npm run build:cloud). */
  readonly VITE_STUDIO_CLOUD?: string
}
