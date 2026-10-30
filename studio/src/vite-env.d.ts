/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" im Cloud-Build (npm run build:cloud). */
  readonly VITE_STUDIO_CLOUD?: string
  readonly VITE_GITHUB_REPO?: string
  readonly VITE_GITHUB_BRANCH?: string
  readonly VITE_GITHUB_API?: string
  readonly VITE_STUDIO_DIR?: string
}
