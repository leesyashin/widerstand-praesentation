import path from 'node:path'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin, ViteDevServer } from 'vite'
import {
  BRAND_DIR,
  DECKS_DIR,
  isDeckName,
  listDeckNames,
  readBrand,
  readDeck,
  summarizeDeck,
  writeDeck,
} from './decks'
import { BRAND_CHANGED, DECK_CHANGED } from '../src/api/events'

const MAX_BODY = 10 * 1024 * 1024

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(new Error('Anfrage zu groß'))
        req.destroy()
      } else chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://studio')
  const parts = url.pathname.split('/').filter(Boolean)
  if (parts[0] !== 'api') return false

  if (parts[1] === 'brand' && parts.length === 2 && req.method === 'GET') {
    const result = await readBrand()
    send(res, result.ok ? 200 : 422, result)
    return true
  }

  if (parts[1] === 'decks' && parts.length === 2 && req.method === 'GET') {
    const names = await listDeckNames()
    send(res, 200, { decks: await Promise.all(names.map(summarizeDeck)) })
    return true
  }

  if (parts[1] === 'decks' && parts.length === 3) {
    const name = parts[2] ?? ''
    if (!isDeckName(name)) {
      send(res, 400, { ok: false, issues: [{ path: '', message: `Ungültiger Deck-Name: ${name}` }] })
      return true
    }
    if (req.method === 'GET') {
      const result = await readDeck(name)
      const missing = !result.ok && result.issues.some((i) => i.message.endsWith('deck.json fehlt'))
      send(res, result.ok ? 200 : missing ? 404 : 422, result)
      return true
    }
    if (req.method === 'PUT') {
      let value: unknown
      try {
        value = JSON.parse(await readBody(req))
      } catch (err) {
        send(res, 400, { ok: false, issues: [{ path: '', message: (err as Error).message }] })
        return true
      }
      const result = await writeDeck(name, value)
      send(res, result.ok ? 200 : 422, result.ok ? { ok: true, deck: result.deck } : result)
      return true
    }
  }

  send(res, 404, { ok: false, issues: [{ path: '', message: `Unbekannter Endpunkt: ${req.method} ${url.pathname}` }] })
  return true
}

/** Welches Deck betrifft eine geänderte Datei? (deck.json oder ein Asset im Deck-Ordner) */
function deckForFile(file: string): string | null {
  const rel = path.relative(DECKS_DIR, file)
  if (rel.startsWith('..') || path.isAbsolute(rel)) return null
  const name = rel.split(path.sep)[0] ?? ''
  if (rel.endsWith('.tmp')) return null
  return isDeckName(name) ? name : null
}

function watchFiles(server: ViteDevServer) {
  server.watcher.add([DECKS_DIR, BRAND_DIR])
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  // Mehrere Dateiereignisse kurz hintereinander (z. B. Editor speichert atomar) → ein Event.
  const notify = (event: string, data: Record<string, string>) => {
    const key = event + JSON.stringify(data)
    clearTimeout(timers.get(key))
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key)
        server.ws.send({ type: 'custom', event, data })
      }, 60),
    )
  }
  const onFile = (file: string) => {
    // Alles im Brand-Ordner (brand.json, Logo, Schriften) betrifft alle Decks.
    if (!path.relative(BRAND_DIR, path.resolve(file)).startsWith('..')) return notify(BRAND_CHANGED, {})
    const name = deckForFile(path.resolve(file))
    if (name) notify(DECK_CHANGED, { name })
  }
  server.watcher.on('add', onFile)
  server.watcher.on('change', onFile)
  server.watcher.on('unlink', onFile)
  server.watcher.on('addDir', onFile)
  server.watcher.on('unlinkDir', onFile)
}

/** Datei-Dienst für Studio: Decks lesen/speichern über /api und Live-Updates bei Änderungen von außen. */
export function studioFiles(): Plugin {
  return {
    name: 'studio-files',
    configureServer(server) {
      watchFiles(server)
      server.middlewares.use((req, res, next) => {
        handle(req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch((err: Error) => send(res, 500, { ok: false, issues: [{ path: '', message: err.message }] }))
      })
    },
  }
}
