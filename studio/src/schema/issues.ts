import type { z } from 'zod'

export type Issue = { path: string; message: string }

export function formatPath(path: PropertyKey[]): string {
  return path.map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`)).join('').replace(/^\./, '')
}

export function fromZod(error: z.ZodError): Issue[] {
  return error.issues.map((i) => ({ path: formatPath(i.path), message: i.message }))
}
