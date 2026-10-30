import { z } from 'zod'

/**
 * Probe-Zeiten eines Decks – eigene Datei decks/<name>/rehearsal.json, damit das Deck selbst sauber bleibt.
 * Zeiten in Millisekunden, pro Folie nach Folien-ID.
 */
export const RehearsalRun = z.strictObject({
  date: z.string(),
  totalMs: z.number().min(0),
  slides: z.record(z.string(), z.number().min(0)),
})

export const Rehearsal = z.strictObject({
  $schema: z.string().optional(),
  /** Geplante Gesamtdauer in Minuten. */
  targetMinutes: z.number().positive().max(600).optional(),
  /** Letzte Proben, neueste zuletzt (höchstens 20). */
  runs: z.array(RehearsalRun).max(20),
})

export type RehearsalRun = z.infer<typeof RehearsalRun>
export type Rehearsal = z.infer<typeof Rehearsal>
