import { api } from '../api/client'

/**
 * Medien importieren: Bilder werden im Browser für die Bühne optimiert (längste Kante max. 3840 px,
 * JPEG bzw. WebP bei Transparenz), Videos bekommen automatisch ein Posterbild.
 * So bleiben die Dateien im Git-Repo schlank, ohne dass auf dem Mac etwas installiert werden muss.
 */

const MAX_EDGE = 3840
/** Kleinere Bilder bleiben unverändert, wenn sie auch nicht zu groß sind. */
const KEEP_BELOW = 1.5 * 1024 * 1024
export const MAX_VIDEO = 100 * 1024 * 1024

export type Imported = {
  path: string
  kind: 'image' | 'video' | 'lottie'
  width?: number
  height?: number
  poster?: string
  /** Was beim Import passiert ist, z. B. „verkleinert auf 3840 px“. */
  note?: string
}

const OPTIMIZABLE = ['image/jpeg', 'image/png', 'image/webp']

function stemOf(name: string) {
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(0, dot) : name
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Hat das Bild transparente Pixel? (an einer kleinen Kopie geprüft) */
function hasAlpha(bitmap: ImageBitmap): boolean {
  const c = document.createElement('canvas')
  c.width = Math.min(256, bitmap.width)
  c.height = Math.max(1, Math.round((c.width / bitmap.width) * bitmap.height))
  const ctx = c.getContext('2d', { willReadFrequently: true })
  if (!ctx) return false
  ctx.drawImage(bitmap, 0, 0, c.width, c.height)
  const data = ctx.getImageData(0, 0, c.width, c.height).data
  for (let i = 3; i < data.length; i += 4) if (data[i]! < 250) return true
  return false
}

async function optimizeImage(file: File): Promise<{ blob: Blob; name: string; width: number; height: number; note?: string }> {
  const bitmap = await createImageBitmap(file)
  const { width, height } = bitmap
  const longest = Math.max(width, height)
  if (!OPTIMIZABLE.includes(file.type) || (longest <= MAX_EDGE && file.size <= KEEP_BELOW)) {
    bitmap.close()
    return { blob: file, name: file.name, width, height }
  }
  const k = Math.min(1, MAX_EDGE / longest)
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(width * k)
  canvas.height = Math.round(height * k)
  const ctx = canvas.getContext('2d')
  if (!ctx) return { blob: file, name: file.name, width, height }
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const alpha = file.type !== 'image/jpeg' && hasAlpha(bitmap)
  bitmap.close()
  const type = alpha ? 'image/webp' : 'image/jpeg'
  const blob = await canvasBlob(canvas, type, alpha ? 0.9 : 0.86)
  if (!blob || (blob.size >= file.size && k === 1)) return { blob: file, name: file.name, width, height }
  const notes = [k < 1 && `verkleinert auf ${Math.max(canvas.width, canvas.height)} px`, `${mb(file.size)} → ${mb(blob.size)}`]
  return {
    blob,
    name: `${stemOf(file.name)}.${alpha ? 'webp' : 'jpg'}`,
    width: canvas.width,
    height: canvas.height,
    note: notes.filter(Boolean).join(', '),
  }
}

/** Erstes aussagekräftiges Standbild eines Videos als JPEG (max. 1920 px). */
async function videoPoster(file: File): Promise<{ blob: Blob; width: number; height: number } | null> {
  const url = URL.createObjectURL(file)
  try {
    const video = document.createElement('video')
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = url
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve()
      video.onerror = () => reject(new Error('Video lässt sich nicht lesen'))
    })
    const width = video.videoWidth
    const height = video.videoHeight
    // Nicht das allererste Bild (oft schwarz), sondern kurz danach.
    video.currentTime = Math.min(1, (video.duration || 1) * 0.1)
    await new Promise<void>((resolve) => {
      video.onseeked = () => resolve()
      setTimeout(resolve, 3000)
    })
    const k = Math.min(1, 1920 / Math.max(width, height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * k)
    canvas.height = Math.round(height * k)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const blob = await canvasBlob(canvas, 'image/jpeg', 0.84)
    return blob ? { blob, width, height } : null
  } catch {
    return null
  } finally {
    URL.revokeObjectURL(url)
  }
}

export const mb = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1).replace('.', ',')} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`

/** Lädt eine Datei in den assets-Ordner des Decks – optimiert, mit Posterbild bei Videos. */
export async function importFile(deck: string, file: File): Promise<Imported> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  if (file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp', 'avif', 'gif', 'svg'].includes(ext)) {
    const svg = ext === 'svg' || file.type === 'image/svg+xml'
    const img = svg ? { blob: file, name: file.name, width: 0, height: 0 } : await optimizeImage(file)
    const r = await api.uploadAsset(deck, img.blob, img.name)
    if (!r.ok) throw new Error(r.issues[0]?.message ?? 'Hochladen fehlgeschlagen')
    return { path: r.value, kind: 'image', width: img.width || undefined, height: img.height || undefined, note: 'note' in img ? img.note : undefined }
  }
  if (file.type.startsWith('video/') || ['mp4', 'webm', 'mov', 'm4v'].includes(ext)) {
    if (file.size > MAX_VIDEO) {
      throw new Error(`${file.name} ist ${mb(file.size)} groß – bitte eine Web-Version unter 100 MB exportieren (z. B. H.264, 1080p).`)
    }
    const poster = await videoPoster(file)
    const r = await api.uploadAsset(deck, file, file.name)
    if (!r.ok) throw new Error(r.issues[0]?.message ?? 'Hochladen fehlgeschlagen')
    let posterPath: string | undefined
    if (poster) {
      const p = await api.uploadAsset(deck, poster.blob, `${stemOf(r.value.split('/').pop() ?? 'video')}-poster.jpg`)
      if (p.ok) posterPath = p.value
    }
    return { path: r.value, kind: 'video', width: poster?.width, height: poster?.height, poster: posterPath, note: posterPath ? 'Posterbild erzeugt' : undefined }
  }
  if (ext === 'json') {
    const r = await api.uploadAsset(deck, file, file.name)
    if (!r.ok) throw new Error(r.issues[0]?.message ?? 'Hochladen fehlgeschlagen')
    return { path: r.value, kind: 'lottie' }
  }
  throw new Error(`${file.name}: Dateityp nicht unterstützt (Bilder, Videos, Lottie-JSON)`)
}

/** Natürliche Größe eines vorhandenen Bildes/Videos (für das Seitenverhältnis beim Einfügen). */
export function measureMedia(url: string, kind: 'image' | 'video'): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    if (kind === 'image') {
      const img = new Image()
      img.onload = () => resolve(img.naturalWidth ? { width: img.naturalWidth, height: img.naturalHeight } : null)
      img.onerror = () => resolve(null)
      img.src = url
    } else {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => resolve({ width: v.videoWidth, height: v.videoHeight })
      v.onerror = () => resolve(null)
      v.src = url
    }
    setTimeout(() => resolve(null), 4000)
  })
}
