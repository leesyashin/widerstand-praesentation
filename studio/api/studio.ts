import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * Studio unterwegs – der Schlüssel bleibt auf dem Server (Vercel-Funktion).
 *
 * Die gehostete App meldet sich mit einem Passwort an und bekommt ein Sitzungs-Cookie. Alle Zugriffe aufs Repo laufen
 * über diese Funktion, die den GitHub-Zugangsschlüssel aus der Vercel-Umgebung anhängt. Das Handy sieht den Schlüssel nie.
 *
 * Umgebung (Vercel → Settings → Environment Variables):
 *   GITHUB_TOKEN     Fine-grained token, nur dieses Repo, Contents: Read and write   (Pflicht)
 *   STUDIO_PASSWORD  Passwort für die Anmeldung                                       (Pflicht)
 *   STUDIO_REPO      "owner/repo"   – sonst aus VERCEL_GIT_REPO_OWNER/SLUG
 *   STUDIO_BRANCH    Branch         – sonst VERCEL_GIT_COMMIT_REF, dann "main"
 *   STUDIO_DIR       Ordner der App im Repo – Standard "studio"
 *   GITHUB_API       nur für Tests
 *
 * Wege (vercel.json leitet /api/<weg> hierher, als ?route=<weg>):
 *   GET  session            angemeldet? → { repo, branch, dir }
 *   POST login  {password}  setzt das Cookie
 *   POST logout             löscht es
 *   *    gh/<pfad>          GitHub-API unter /repos/<repo>/<pfad> – nur die Pfade, die die App braucht
 *   GET  media?path=<datei> Datei roh aus dem Repo (gestreamt, auch große Videos)
 */

const COOKIE = 'studio_session'
const SESSION_DAYS = 180

type Env = { token: string; password: string; repo: string; branch: string; dir: string; api: string }

function env(): Env | string {
  const e = process.env
  const repo = e.STUDIO_REPO || (e.VERCEL_GIT_REPO_OWNER && e.VERCEL_GIT_REPO_SLUG ? `${e.VERCEL_GIT_REPO_OWNER}/${e.VERCEL_GIT_REPO_SLUG}` : '')
  if (!e.GITHUB_TOKEN) return 'GITHUB_TOKEN fehlt in den Vercel-Einstellungen (Environment Variables)'
  if (!e.STUDIO_PASSWORD) return 'STUDIO_PASSWORD fehlt in den Vercel-Einstellungen (Environment Variables)'
  if (!repo) return 'Repo unbekannt – STUDIO_REPO in den Vercel-Einstellungen setzen (z. B. name/repo)'
  return {
    token: e.GITHUB_TOKEN,
    password: e.STUDIO_PASSWORD,
    repo,
    branch: e.STUDIO_BRANCH || e.VERCEL_GIT_COMMIT_REF || 'main',
    dir: (e.STUDIO_DIR ?? 'studio').replace(/^\/+|\/+$/g, ''),
    api: (e.GITHUB_API || 'https://api.github.com').replace(/\/$/, ''),
  }
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers } })

const fail = (status: number, message: string) => json({ message }, status)

/* ---------- Sitzung: "<ablauf>.<hmac>" – das Passwort ändern meldet alle Geräte ab ---------- */

function sign(cfg: Env, value: string) {
  return createHmac('sha256', `${cfg.password}\n${cfg.token}`).update(value).digest('base64url')
}

function sameText(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}

function signedIn(cfg: Env, req: Request): boolean {
  const cookie = req.headers.get('cookie') ?? ''
  const raw = cookie.split(/;\s*/).find((c) => c.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  const [expires, mac] = (raw ?? '').split('.')
  if (!expires || !mac || !(Number(expires) > Date.now())) return false
  return sameText(mac, sign(cfg, expires))
}

function sessionCookie(cfg: Env | null, req: Request) {
  const secure = new URL(req.url).protocol === 'https:' ? '; Secure' : ''
  if (!cfg) return `${COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`
  const expires = String(Date.now() + SESSION_DAYS * 86400_000)
  return `${COOKIE}=${expires}.${sign(cfg, expires)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DAYS * 86400}${secure}`
}

/* ---------- Zugriff aufs Repo: nur, was die App braucht ---------- */

const SHA = /^[0-9a-f]{40}$/

/** Datei-Pfad innerhalb des App-Ordners, ohne "..", sonst null. */
function safePath(cfg: Env, path: string): string | null {
  const parts = path.split('/')
  if (!path || parts.some((p) => !p || p === '.' || p === '..')) return null
  if (cfg.dir && !path.startsWith(`${cfg.dir}/`)) return null
  return path
}

const encPath = (path: string) => path.split('/').map(encodeURIComponent).join('/')

function decode(text: string): string | null {
  try {
    return decodeURIComponent(text)
  } catch {
    return null
  }
}

/** Freigegebener GitHub-Pfad (neu kodiert) oder null. */
function allowed(cfg: Env, method: string, route: string, body: { branch?: unknown } | null): string | null {
  const file = route.startsWith('contents/') ? safePath(cfg, decode(route.slice(9)) ?? '') : null
  if (method === 'GET') {
    if (route === `git/ref/heads/${cfg.branch}`) return route
    const m = route.match(/^git\/(trees|blobs)\/([^/]+)$/)
    if (m) return SHA.test(m[2]!) ? route : null
    return file ? `contents/${encPath(file)}` : null
  }
  if (method === 'PUT' || method === 'DELETE') return file && body?.branch === cfg.branch ? `contents/${encPath(file)}` : null
  return null
}

function github(cfg: Env, path: string, init: RequestInit & { accept?: string } = {}) {
  return fetch(`${cfg.api}/repos/${cfg.repo}/${path}`, {
    ...init,
    headers: {
      Accept: init.accept ?? 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'studio',
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    },
  })
}

async function proxy(cfg: Env, req: Request, route: string, search: string): Promise<Response> {
  const method = req.method
  const text = method === 'PUT' || method === 'DELETE' ? await req.text() : ''
  let body: { branch?: unknown } | null = null
  if (text) {
    try {
      body = JSON.parse(text) as { branch?: unknown }
    } catch {
      return fail(400, 'Ungültige Anfrage')
    }
  }
  const target = allowed(cfg, method, route, body)
  if (!target) return fail(403, 'Dieser Zugriff ist für Studio nicht freigegeben')
  const res = await github(cfg, `${target}${search}`, {
    method,
    body: text || undefined,
    headers: req.headers.get('if-none-match') ? { 'If-None-Match': req.headers.get('if-none-match')! } : undefined,
  })
  // Kein 401 von GitHub durchreichen – das hieße für die App „neu anmelden“; hier liegt es am Schlüssel bei Vercel.
  if (res.status === 401) return fail(502, 'Der GitHub-Schlüssel bei Vercel ist ungültig oder abgelaufen (GITHUB_TOKEN erneuern)')
  const headers = new Headers({ 'Content-Type': res.headers.get('content-type') ?? 'application/json', 'Cache-Control': 'no-store' })
  for (const h of ['etag', 'x-ratelimit-remaining']) if (res.headers.get(h)) headers.set(h, res.headers.get(h)!)
  return new Response(res.body, { status: res.status, headers })
}

const TYPES: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif', gif: 'image/gif',
  svg: 'image/svg+xml', mp4: 'video/mp4', m4v: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  json: 'application/json', woff2: 'font/woff2', woff: 'font/woff', otf: 'font/otf', ttf: 'font/ttf',
}

/** Datei roh – gestreamt, damit auch Videos über Vercels 4,5-MB-Grenze für Antworten gehen. */
async function media(cfg: Env, rel: string | null): Promise<Response> {
  const full = rel && safePath(cfg, cfg.dir ? `${cfg.dir}/${rel}` : rel)
  if (!full || !/^(decks|brand)\//.test(rel)) return fail(400, 'Ungültiger Pfad')
  const res = await github(cfg, `contents/${encPath(full)}?ref=${encodeURIComponent(cfg.branch)}`, { accept: 'application/vnd.github.raw+json' })
  if (!res.ok) return new Response(null, { status: res.status === 401 ? 502 : res.status })
  const type = TYPES[full.split('.').pop()!.toLowerCase()] ?? 'application/octet-stream'
  const headers = new Headers({ 'Content-Type': type, 'Cache-Control': 'private, no-cache' })
  if (res.headers.get('content-length')) headers.set('Content-Length', res.headers.get('content-length')!)
  return new Response(res.body, { headers })
}

/* ---------- Eingang ---------- */

/** Fehlversuche bremsen (pro Instanz – reicht gegen Durchprobieren, weil jede Antwort dann Sekunden braucht). */
let failures = 0

export async function handle(req: Request): Promise<Response> {
  const url = new URL(req.url)
  const route = (url.searchParams.get('route') ?? url.pathname.replace(/^\/api\/?/, '')).replace(/^\/+/, '')
  url.searchParams.delete('route')
  const cfg = env()
  if (typeof cfg === 'string') return fail(503, cfg)

  if (route === 'login' && req.method === 'POST') {
    const { password } = (await req.json().catch(() => ({}))) as { password?: unknown }
    if (typeof password !== 'string' || !sameText(password, cfg.password)) {
      failures++
      await new Promise((r) => setTimeout(r, Math.min(failures, 10) * 400))
      return fail(401, 'Passwort stimmt nicht')
    }
    failures = 0
    return json({ repo: cfg.repo, branch: cfg.branch, dir: cfg.dir }, 200, { 'Set-Cookie': sessionCookie(cfg, req) })
  }
  if (route === 'logout' && req.method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(null, req) })

  if (!signedIn(cfg, req)) return fail(401, 'Nicht angemeldet')
  if (route === 'session') return json({ repo: cfg.repo, branch: cfg.branch, dir: cfg.dir })
  if (route === 'media' && req.method === 'GET') return media(cfg, url.searchParams.get('path'))
  if (route.startsWith('gh/')) return proxy(cfg, req, route.slice(3), url.search)
  return fail(404, 'Unbekannt')
}

// Vercel: Web-Standard-Handler je Methode.
export const GET = handle
export const POST = handle
export const PUT = handle
export const DELETE = handle
