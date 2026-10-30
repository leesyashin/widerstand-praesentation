/** Wird von scripts/publish.ts beim Bauen des Web-Players eingesetzt. */
declare module 'virtual:studio-bundle' {
  import type { Bundle } from '../api/client'
  const bundle: Bundle
  export default bundle
}
