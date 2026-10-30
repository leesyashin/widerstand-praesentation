// Studio unterwegs: lädt Medien (decks/<name>/…, brand/…) mit dem Zugangsschlüssel aus dem privaten GitHub-Repo.
// Die App hängt an bekannte Dateien ?v=<blob-sha> an – solche Antworten ändern sich nie und bleiben im Cache.
// Anmeldedaten legt die App unter CONFIG_KEY in den Cache Storage (siehe src/api/cloud/worker.ts).
const MEDIA_CACHE = 'studio-media-v1'
const CONFIG_CACHE = 'studio-config'
const CONFIG_KEY = '/__studio/config'

const TYPES = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif',
  svg: 'image/svg+xml', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  json: 'application/json', woff2: 'font/woff2', woff: 'font/woff', otf: 'font/otf', ttf: 'font/ttf',
}

let config = null

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('message', (event) => {
  if (event.data === 'studio:config') config = null // neu einlesen
})

async function loadConfig() {
  if (config) return config
  const res = await (await caches.open(CONFIG_CACHE)).match(CONFIG_KEY)
  config = res ? await res.json() : null
  return config
}

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
  const cfg = await loadConfig()
  if (!cfg) return new Response('Nicht angemeldet', { status: 401 })
  const version = url.searchParams.get('v')
  const key = new Request(url.href)
  const cache = await caches.open(MEDIA_CACHE)
  let res = version ? await cache.match(key) : null
  if (!res) {
    try {
      res = await download(cfg, rel, version)
      if (res.ok) await cache.put(key, res.clone())
    } catch {
      res = await cache.match(key, { ignoreSearch: true })
      if (!res) return new Response('Offline', { status: 503 })
    }
  }
  return ranged(req, res)
}

async function download(cfg, rel, version) {
  const base = `${cfg.api}/repos/${cfg.repo}`
  const full = (cfg.dir ? `${cfg.dir}/` : '') + rel
  const target = version
    ? `${base}/git/blobs/${version}`
    : `${base}/contents/${full.split('/').map(encodeURIComponent).join('/')}?ref=${encodeURIComponent(cfg.branch)}`
  const res = await fetch(target, {
    cache: version ? 'force-cache' : 'no-cache',
    headers: {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
  if (!res.ok) return new Response(null, { status: res.status })
  const type = TYPES[rel.split('.').pop().toLowerCase()] || 'application/octet-stream'
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
