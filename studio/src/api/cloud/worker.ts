import type { CloudConfig } from './config'

/** Service Worker (public/sw.js) für Medien aus dem privaten Repo – nur in der gehosteten App. */

const CONFIG_CACHE = 'studio-config'
const CONFIG_KEY = '/__studio/config'

/** Anmeldedaten an den Service Worker geben (über den Cache Storage, den beide lesen können). */
export async function syncWorkerConfig(config: CloudConfig | null) {
  if (!('caches' in window)) return
  const cache = await caches.open(CONFIG_CACHE)
  if (config) await cache.put(CONFIG_KEY, new Response(JSON.stringify(config), { headers: { 'Content-Type': 'application/json' } }))
  else {
    await cache.delete(CONFIG_KEY)
    await caches.delete('studio-media-v1')
  }
  navigator.serviceWorker?.controller?.postMessage('studio:config')
}

/** Registrieren und warten, bis er die Seite steuert – sonst laufen die ersten Bild-Anfragen an ihm vorbei. */
export async function startWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) return false
  try {
    await navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller) {
      await new Promise<void>((resolve) => {
        navigator.serviceWorker.addEventListener('controllerchange', () => resolve(), { once: true })
        setTimeout(resolve, 3000)
      })
    }
    return Boolean(navigator.serviceWorker.controller)
  } catch {
    return false
  }
}
