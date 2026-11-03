// Studio unterwegs: lädt Medien (decks/<name>/…, brand/…) über die Server-Funktion (api/studio.ts → /api/media),
// die den GitHub-Schlüssel anhängt; angemeldet ist das Gerät über das Sitzungs-Cookie.
// Die App hängt an bekannte Dateien ?v=<blob-sha> an – solche Antworten ändern sich nie und bleiben im Cache.
const MEDIA_CACHE = 'studio-media-v1'

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) =>
  // Aufräumen aus der Version mit Schlüssel auf dem Gerät.
  event.waitUntil(Promise.all([caches.delete('studio-config'), self.clients.claim()])),
)

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  const scope = new URL(self.registration.scope).pathname
  if (!url.pathname.startsWith(scope)) return
  const rel = url.pathname.slice(scope.length)
  if (!rel.startsWith('decks/') && !rel.startsWith('brand/')) return
  event.respondWith(serve(req, url, decodeURIComponent(rel)))
})

async function serve(req, url, rel) {
  const version = url.searchParams.get('v')
  const key = new Request(url.href)
  const cache = await caches.open(MEDIA_CACHE)
  let res = version ? await cache.match(key) : null
  if (!res) {
    try {
      res = await download(rel)
      if (res.ok) await cache.put(key, res.clone())
    } catch {
      res = await cache.match(key, { ignoreSearch: true })
      if (!res) return new Response('Offline', { status: 503 })
    }
  }
  return ranged(req, res)
}

async function download(rel) {
  const scope = new URL(self.registration.scope).pathname
  const res = await fetch(`${scope}api/media?path=${encodeURIComponent(rel)}`, { credentials: 'same-origin', cache: 'no-store' })
  if (!res.ok) return new Response(null, { status: res.status })
  const type = res.headers.get('Content-Type') || 'application/octet-stream'
  return new Response(await res.blob(), { headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes' } })
}

/** Safari spielt Videos nur mit Teilantworten (206) ab. */
async function ranged(req, res) {
  const range = req.headers.get('Range')
  const m = range && /^bytes=(\d*)-(\d*)$/.exec(range)
  if (!m || !res.ok) return res
  const blob = await res.blob()
  const size = blob.size
  let start = m[1] === '' ? size - Number(m[2]) : Number(m[1])
  let end = m[1] === '' || m[2] === '' ? size - 1 : Number(m[2])
  start = Math.max(0, start)
  end = Math.min(end, size - 1)
  if (start > end) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
  return new Response(blob.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  })
}
