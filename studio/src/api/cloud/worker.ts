/** Service Worker (public/sw.js) für Medien aus dem privaten Repo – nur in der gehosteten App. */

/** Beim Abmelden: zwischengespeicherte Medien von diesem Gerät löschen. */
export async function clearMediaCache() {
  if ('caches' in window) await caches.delete('studio-media-v1')
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
