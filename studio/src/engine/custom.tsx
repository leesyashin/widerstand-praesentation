import type { ComponentType } from 'react'
import type { z } from 'zod'
import type { CustomProps } from './customTypes'

/**
 * Registry der eigenen Komponenten aus studio/custom/*.tsx.
 * Jede Datei exportiert: default (Komponente), optional `schema` (Zod für props) und `meta`.
 */
type CustomModule = {
  default: ComponentType<CustomProps<Record<string, unknown>>>
  schema?: z.ZodType
  meta?: { label?: string; description?: string }
}

const modules = import.meta.glob<CustomModule>('../../custom/*.tsx', { eager: true })

export const CUSTOM_COMPONENTS: Record<string, CustomModule> = Object.fromEntries(
  Object.entries(modules).map(([file, mod]) => [file.split('/').pop()!.replace(/\.tsx$/, ''), mod]),
)
