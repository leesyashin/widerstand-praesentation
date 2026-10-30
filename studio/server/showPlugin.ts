import { existsSync } from 'node:fs'
import { readFile, rename, writeFile } from 'node:fs/promises'
import type { IncomingMessage, ServerResponse } from 'node:http'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { fromZod } from '../src/schema/issues'
import { Rehearsal } from '../src/schema/rehearsal'
import { DECKS_DIR, isDeckName } from './decks'

/**
 * Präsentations-Dienste (Phase 4):
 * - verteilt Show-Nachrichten (Stand, Befehle) an alle verbundenen Fenster und Geräte
 * - GET  /api/show/info                → Adressen, unter denen das Handy den Dev-Server erreicht
 * - GET  /api/decks/<name>/rehearsal   → Probe-Zeiten
 * - PUT  /api/decks/<name>/rehearsal   → Probe-Zeiten speichern
 */
const SHOW_EVENT = 'studio:show'

function send(res: ServerResponse, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  return Buffer.concat(chunks).toString('utf8')
}

const EMPTY: Rehearsal = { runs: [] }

async function handle(server: ViteDevServer, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = new URL(req.url ?? '/', 'http://studio')
  const parts = url.pathname.split('/').filter(Boolean)

  if (url.pathname === '/api/show/info' && req.method === 'GET') {
    send(res, 200, { network: server.resolvedUrls?.network ?? [], local: server.resolvedUrls?.local ?? [] })
    return true
  }

  if (parts[0] === 'api' && parts[1] === 'decks' && parts[3] === 'rehearsal' && parts.length === 4) {
    const name = parts[2] ?? ''
    if (!isDeckName(name) || !existsSync(path.join(DECKS_DIR, name, 'deck.json'))) {
      send(res, 404, { ok: false, issues: [{ path: '', message: `Deck „${name}“ nicht gefunden` }] })
      return true
    }
    const file = path.join(DECKS_DIR, name, 'rehearsal.json')
    if (req.method === 'GET') {
      if (!existsSync(file)) {
        send(res, 200, { ok: true, rehearsal: EMPTY })
        return true
      }
      try {
        const parsed = Rehearsal.safeParse(JSON.parse(await readFile(file, 'utf8')))
        send(res, parsed.success ? 200 : 422, parsed.success ? { ok: true, rehearsal: parsed.data } : { ok: false, issues: fromZod(parsed.error) })
      } catch (err) {
        send(res, 422, { ok: false, issues: [{ path: '', message: (err as Error).message }] })
      }
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
      const parsed = Rehearsal.safeParse(value)
      if (!parsed.success) {
        send(res, 422, { ok: false, issues: fromZod(parsed.error) })
        return true
      }
      const tmp = `${file}.${process.pid}.tmp`
      await writeFile(tmp, JSON.stringify(parsed.data, null, 2) + '\n', 'utf8')
      await rename(tmp, file)
      send(res, 200, { ok: true, rehearsal: parsed.data })
      return true
    }
  }
  return false
}

export function showPlugin(): Plugin {
  return {
    name: 'studio-show',
    configureServer(server) {
      // Jede Show-Nachricht an alle Verbundenen weitergeben (Empfänger filtern nach Deck und Art).
      server.ws.on(SHOW_EVENT, (data: unknown) => server.ws.send({ type: 'custom', event: SHOW_EVENT, data }))
      server.middlewares.use((req, res, next) => {
        handle(server, req, res)
          .then((handled) => {
            if (!handled) next()
          })
          .catch((err: Error) => send(res, 500, { ok: false, issues: [{ path: '', message: err.message }] }))
      })
    },
  }
}
