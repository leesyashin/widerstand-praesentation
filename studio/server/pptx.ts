import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Browser, Page } from 'playwright'
import PptxGenJS from 'pptxgenjs'
import { resolveDeck } from '../src/engine/masters'
import type { Brand } from '../src/schema/brand'
import type { Deck, Element, Slide } from '../src/schema/deck'
import type { Issue } from '../src/schema/issues'
import { launchBrowser } from './browser'
import { BRAND_DIR, DECKS_DIR, readBrand, readDeck, STUDIO_ROOT } from './decks'

/**
 * PowerPoint-Export. Playwright öffnet jede Folie im Endzustand (#/render/…) und liest die
 * tatsächlich dargestellte Typografie aus. Daraus entstehen echte PPTX-Objekte:
 *   Text, Bilder, Rechtecke/Ellipsen, Linien/Pfeile, Videos (MP4/MOV) und Notizen.
 * Alles, was PowerPoint nicht kann – Licht-Verlauf, Korn, Vignette, Glas-Unschärfe, Icons, Charts,
 * Lottie, eigene Komponenten, 3D-Neigung –, wird als Bild eingebettet. Animationen und Übergänge
 * gehen verloren (Grenze des Formats); Elemente, die am Ende der Folie ausgeblendet sind, fehlen.
 */

export type PptxResult = { ok: true; buffer: Buffer; slides: number; images: number } | { ok: false; issues: Issue[] }

/** Logische Pixel pro Zoll: 1920 px = 13,33 in (PowerPoint-Breitbild), 1 px = 0,5 pt. */
const PX_PER_IN = 144
const inch = (px: number) => px / PX_PER_IN
const pt = (px: number) => px / 2

/* ---------- Farben ---------- */

type Rgba = { hex: string; alpha: number }

/** Deck-Farbe (Hex, rgb(), Brand-Token, transparent) → PPTX-Farbe ohne # plus Deckkraft. */
export function parseColor(value: string | undefined, brand: Brand): Rgba | null {
  if (!value || value === 'transparent') return null
  if (value.startsWith('brand.')) return parseColor(brand.colors[value.slice(6)], brand)
  const hex = value.match(/^#([0-9a-f]{3,8})$/i)?.[1]
  if (hex) {
    const full = hex.length <= 4 ? [...hex].map((c) => c + c).join('') : hex
    const alpha = full.length === 8 ? parseInt(full.slice(6), 16) / 255 : 1
    return { hex: full.slice(0, 6).toUpperCase(), alpha }
  }
  const rgb = value.match(/^rgba?\(([^)]*)\)$/)?.[1]
  if (rgb) {
    const [r = 0, g = 0, b = 0, a = 1] = rgb.split(/[\s,/]+/).filter(Boolean).map(Number)
    const to = (n: number) => Math.round(Math.min(255, Math.max(0, n))).toString(16).padStart(2, '0')
    return { hex: (to(r) + to(g) + to(b)).toUpperCase(), alpha: a }
  }
  return null
}

/** PPTX-Transparenz in Prozent (0 = deckend). */
const transparency = (alpha: number) => Math.round((1 - Math.min(1, Math.max(0, alpha))) * 100)

/* ---------- Text ---------- */

type Run = { text: string; options: { bold?: boolean; italic?: boolean; breakLine?: boolean } }

/** Inline-Markup der Text-Elemente (**fett**, *kursiv*, \n) als PPTX-Textläufe. */
export function textRuns(content: string, uppercase: boolean): Run[] {
  const runs: Run[] = []
  const lines = content.split('\n')
  lines.forEach((line, i) => {
    const start = runs.length
    let last = 0
    const push = (text: string, opts: Run['options'] = {}) => {
      if (text) runs.push({ text: uppercase ? text.toLocaleUpperCase('de-DE') : text, options: { ...opts } })
    }
    for (const m of line.matchAll(/\*\*(.+?)\*\*|\*(.+?)\*/g)) {
      push(line.slice(last, m.index))
      push(m[1] ?? m[2] ?? '', m[1] !== undefined ? { bold: true } : { italic: true })
      last = m.index + m[0].length
    }
    push(line.slice(last))
    if (runs.length === start) push(' ') // Leerzeile behalten
    if (i < lines.length - 1) runs[runs.length - 1]!.options.breakLine = true
  })
  return runs
}

/* ---------- Seite im Browser ---------- */

/** Was die Seite über ein Element verrät (berechnete Stile im Endzustand). */
type Seen = {
  id: string
  visible: boolean
  text?: {
    family: string
    size: number
    weight: number
    lineHeight: number | null
    letterSpacing: number
    color: string
    align: string
    uppercase: boolean
    valign: string
  }
}

// Läuft im Browser (als String, damit der Node-Teil ohne DOM-Typen auskommt).
const COLLECT = `(() => [...document.querySelectorAll('.slide__content > .el')].map((el) => {
  const anim = el.querySelector(':scope > .el-anim')
  const cs = getComputedStyle(anim ?? el)
  const visible = cs.visibility !== 'hidden' && Number(cs.opacity) > 0.02 && getComputedStyle(el).display !== 'none'
  const out = { id: el.dataset.elementId, visible }
  const text = el.querySelector('.el-text')
  if (text) {
    const t = getComputedStyle(text)
    const size = parseFloat(t.fontSize)
    out.text = {
      family: t.fontFamily.split(',')[0].trim().replace(/^["']|["']$/g, ''),
      size,
      weight: Number(t.fontWeight) || 400,
      lineHeight: t.lineHeight === 'normal' ? null : parseFloat(t.lineHeight),
      letterSpacing: t.letterSpacing === 'normal' ? 0 : parseFloat(t.letterSpacing),
      color: t.color,
      align: t.textAlign,
      uppercase: t.textTransform === 'uppercase',
      valign: t.justifyContent,
    }
  }
  return out
}))()`

/** Bild auf den Rahmen zuschneiden (cover/contain, Fokus, Rundung) – als data-URL in Originalauflösung. */
const IMAGE = `(async ({ id, w, h, fit, fx, fy, radius }) => {
  const img = document.querySelector('.el[data-element-id="' + CSS.escape(id) + '"] img')
  if (!img) return null
  await img.decode().catch(() => {})
  const nw = img.naturalWidth || w, nh = img.naturalHeight || h
  // Auflösung: so viel, wie das Bild hergibt – höchstens doppelte Rahmengröße.
  const k = Math.max(1, Math.min(2, fit === 'cover' ? Math.min(nw / w, nh / h) : Math.max(nw / w, nh / h)))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * k)
  canvas.height = Math.round(h * k)
  const ctx = canvas.getContext('2d')
  if (radius > 0) {
    ctx.beginPath()
    ctx.roundRect(0, 0, canvas.width, canvas.height, radius * k)
    ctx.clip()
  }
  if (fit === 'cover') {
    const s = Math.max(w / nw, h / nh)
    const sw = w / s, sh = h / s
    ctx.drawImage(img, (nw - sw) * fx, (nh - sh) * fy, sw, sh, 0, 0, canvas.width, canvas.height)
  } else {
    const s = Math.min(w / nw, h / nh)
    const dw = nw * s * k, dh = nh * s * k
    ctx.drawImage(img, 0, 0, nw, nh, (canvas.width - dw) / 2, (canvas.height - dh) / 2, dw, dh)
  }
  const opaque = fit === 'cover' && !radius && !/\\.(png|webp|gif)($|\\?)/i.test(img.src)
  return canvas.toDataURL(opaque ? 'image/jpeg' : 'image/png', 0.92)
})`

/**
 * Nur ein Element (oder nur den Hintergrund) sichtbar lassen. Gibt den Bereich zurück, den das Element
 * ungedreht samt überstehender Teile (z. B. Chart-Beschriftungen) einnimmt.
 */
const ISOLATE = `(({ id }) => {
  document.getElementById('pptx-isolate')?.remove()
  const style = document.createElement('style')
  style.id = 'pptx-isolate'
  style.textContent = id === null
    ? '.slide__content > .el { visibility: hidden !important }'
    : 'html, body, #root, .present, .stage, .slide { background: transparent !important; transition: none !important }' +
      '.slide__content > :not([data-element-id="' + CSS.escape(id) + '"]), .slide__fx { visibility: hidden !important }' +
      '.slide__content > [data-element-id="' + CSS.escape(id) + '"] { transform: none !important }'
  document.head.appendChild(style)
  if (id === null) return null
  const el = document.querySelector('.slide__content > [data-element-id="' + CSS.escape(id) + '"]')
  if (!el) return null
  let l = Infinity, t = Infinity, r = -Infinity, b = -Infinity
  for (const n of [el, ...el.querySelectorAll('*')]) {
    const box = n.getBoundingClientRect()
    if (!box.width && !box.height) continue
    l = Math.min(l, box.left); t = Math.min(t, box.top); r = Math.max(r, box.right); b = Math.max(b, box.bottom)
  }
  const W = document.documentElement.clientWidth, H = document.documentElement.clientHeight
  l = Math.max(0, Math.floor(l)); t = Math.max(0, Math.floor(t)); r = Math.min(W, Math.ceil(r)); b = Math.min(H, Math.ceil(b))
  return r > l && b > t ? { x: l, y: t, w: r - l, h: b - t } : null
})`

const RESET = `document.getElementById('pptx-isolate')?.remove()`

type Box = { x: number; y: number; w: number; h: number }

/* ---------- Export ---------- */

/** Bild-, Video- und Brand-Dateien des Decks auf der Platte. */
function fileOf(name: string, src: string): string {
  return src.startsWith('brand/') ? path.join(BRAND_DIR, src.slice(6)) : path.join(DECKS_DIR, name, src)
}

const VIDEO_EXT = new Set(['.mp4', '.m4v', '.mov'])

/** Elemente, die PowerPoint selbst darstellen kann. */
function isNative(el: Element): boolean {
  if (el.tilt && (el.tilt.x || el.tilt.y)) return false
  switch (el.type) {
    case 'text':
      return true
    case 'image':
      // SVG ohne feste Größe lässt sich nicht verlässlich auf ein Canvas zeichnen – als Screenshot (2×) scharf genug.
      return path.extname(el.src).toLowerCase() !== '.svg'
    case 'shape':
      return true
    case 'video':
      return VIDEO_EXT.has(path.extname(el.src).toLowerCase())
    default:
      return false
  }
}

/** Hintergrund, den PowerPoint ohne Bild darstellen kann (einfarbig, ohne Effekte). */
function nativeBackground(slide: Slide, brand: Brand): Rgba | null {
  const visibleFx = (slide.effects ?? []).filter((e) => e.type !== 'float' && e.amount !== 0)
  const bg = slide.background ?? { type: 'color' as const, color: 'brand.background' }
  if (visibleFx.length || bg.type !== 'color') return null
  const color = parseColor(bg.color, brand)
  return color && color.alpha === 1 ? color : null
}

async function openSlide(page: Page, base: string, name: string, slide: Slide) {
  await page.goto(`${base}/#/render/${encodeURIComponent(name)}/${encodeURIComponent(slide.id)}`)
  await page.waitForFunction(
    (id) => {
      const doc = (globalThis as unknown as { document: { body: { dataset: Record<string, string> }; querySelector(s: string): unknown } }).document
      return doc.body.dataset.ready === '1' && Boolean(doc.querySelector(`.slide[data-slide-id="${id}"]`))
    },
    slide.id,
    { timeout: 20000 },
  )
}

/**
 * Exportiert ein Deck als PPTX. `baseUrl` = laufender Studio-Dev-Server (für die Render-Ansicht).
 * Optional einen offenen Browser mitgeben (sonst wird einer gestartet).
 */
export async function exportPptx(name: string, baseUrl: string, browser?: Browser): Promise<PptxResult> {
  const read = await readDeck(name)
  if (!read.ok) return read
  const brandResult = await readBrand()
  if (!brandResult.ok) return brandResult
  const brand = brandResult.brand
  const deck: Deck = resolveDeck(read.deck)
  const { width, height } = deck.format

  const pptx = new PptxGenJS()
  pptx.defineLayout({ name: 'STUDIO', width: inch(width), height: inch(height) })
  pptx.layout = 'STUDIO'
  pptx.title = deck.title
  pptx.company = brand.name

  const ownBrowser = !browser
  const b = browser ?? (await launchBrowser())
  const page = await b.newPage({ viewport: { width, height }, deviceScaleFactor: 2 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  let images = 0
  const base = baseUrl.replace(/\/$/, '')

  try {
    for (const slide of deck.slides) {
      const out = pptx.addSlide()
      if (slide.skip) out.hidden = true
      if (slide.notes) out.addNotes(slide.notes)
      await openSlide(page, base, name, slide)
      const seen = new Map(((await page.evaluate(COLLECT)) as Seen[]).map((s) => [s.id, s]))

      // Hintergrund: einfarbig nativ, sonst als Bild (inkl. Verlauf, Korn, Vignette, Letterbox).
      const color = nativeBackground(slide, brand)
      if (color) out.background = { color: color.hex }
      else {
        await page.evaluate(`(${ISOLATE})({ id: null })`)
        const shot = await page.screenshot({ type: 'jpeg', quality: 88, scale: 'css' })
        out.background = { data: `data:image/jpeg;base64,${shot.toString('base64')}` }
        images += 1
        await page.evaluate(RESET)
      }

      for (const el of slide.elements) {
        if (el.hidden || !seen.get(el.id)?.visible) continue
        const f = el.frame
        const pos = { x: inch(f.x), y: inch(f.y), w: inch(f.w), h: inch(f.h), rotate: f.rotation ?? 0 }
        const opacity = el.opacity ?? 1

        if (isNative(el) && el.type === 'text') {
          const t = seen.get(el.id)?.text
          if (!t) continue
          const c = parseColor(t.color, brand) ?? { hex: 'FFFFFF', alpha: 1 }
          out.addText(textRuns(el.content, t.uppercase), {
            ...pos,
            margin: 0,
            fontFace: t.family,
            fontSize: pt(t.size),
            bold: t.weight >= 600,
            color: c.hex,
            transparency: transparency(c.alpha * opacity),
            align: t.align === 'center' ? 'center' : t.align === 'right' || t.align === 'end' ? 'right' : 'left',
            valign: t.valign === 'center' ? 'middle' : t.valign === 'flex-end' ? 'bottom' : 'top',
            lineSpacing: t.lineHeight ? pt(t.lineHeight) : undefined,
            charSpacing: t.letterSpacing ? pt(t.letterSpacing) : undefined,
            wrap: true,
            fit: 'none',
            objectName: el.name ?? el.id,
          })
          continue
        }

        if (isNative(el) && el.type === 'image') {
          const data = (await page.evaluate(`(${IMAGE})(${JSON.stringify({
            id: el.id,
            w: f.w,
            h: f.h,
            fit: el.fit ?? 'cover',
            fx: el.focus?.x ?? 0.5,
            fy: el.focus?.y ?? 0.5,
            radius: el.radius ?? 0,
          })})`)) as string | null
          if (!data) continue
          out.addImage({ data, ...pos, transparency: transparency(opacity), altText: el.alt, objectName: el.name ?? el.id })
          images += 1
          continue
        }

        if (isNative(el) && el.type === 'shape') {
          addShape(pptx, out, el, pos, opacity, brand)
          continue
        }

        if (isNative(el) && el.type === 'video') {
          const cover = el.poster
            ? `data:image/${path.extname(el.poster).slice(1).replace('jpg', 'jpeg')};base64,${(await readFile(fileOf(name, el.poster))).toString('base64')}`
            : await elementShot(page, el.id).then((s) => s && s.data)
          out.addMedia({ type: 'video', path: fileOf(name, el.src), ...pos, cover: cover ?? undefined, objectName: el.name ?? el.id })
          continue
        }

        // Alles andere als Bild: Icons, Charts, Lottie, eigene Komponenten, geneigte Elemente, WebM-Videos.
        const shot = await elementShot(page, el.id)
        if (!shot) continue
        out.addImage({
          data: shot.data,
          x: inch(shot.box.x),
          y: inch(shot.box.y),
          w: inch(shot.box.w),
          h: inch(shot.box.h),
          rotate: pos.rotate,
          objectName: el.name ?? el.id,
        })
        images += 1
      }
    }
  } finally {
    await page.close()
    if (ownBrowser) await b.close()
  }

  const buffer = (await pptx.write({ outputType: 'nodebuffer', compression: true })) as Buffer
  return { ok: true, buffer, slides: deck.slides.length, images }
}

/** Ein Element allein (ohne Hintergrund) als PNG in doppelter Auflösung. */
async function elementShot(page: Page, id: string): Promise<{ data: string; box: Box } | null> {
  const box = (await page.evaluate(`(${ISOLATE})(${JSON.stringify({ id })})`)) as Box | null
  try {
    if (!box) return null
    const clip = { x: box.x, y: box.y, width: box.w, height: box.h }
    const png = await page.screenshot({ clip, omitBackground: true, type: 'png' })
    return { data: `data:image/png;base64,${png.toString('base64')}`, box }
  } finally {
    await page.evaluate(RESET)
  }
}

type Pos = { x: number; y: number; w: number; h: number; rotate: number }

function addShape(
  pptx: PptxGenJS,
  out: PptxGenJS.Slide,
  el: Extract<Element, { type: 'shape' }>,
  pos: Pos,
  opacity: number,
  brand: Brand,
) {
  const stroke = el.stroke && parseColor(el.stroke.color, brand)
  const name = el.name ?? el.id
  if (el.shape === 'line' || el.shape === 'arrow') {
    // Linie waagerecht durch die Rahmenmitte – gedreht um dieselbe Mitte wie im Browser.
    const color = stroke ?? parseColor(el.fill, brand) ?? { hex: 'FFFFFF', alpha: 1 }
    out.addShape(pptx.ShapeType.line, {
      x: pos.x,
      y: pos.y + pos.h / 2,
      w: pos.w,
      h: 0,
      rotate: pos.rotate,
      line: {
        color: color.hex,
        width: pt(el.stroke?.width ?? 2),
        transparency: transparency(color.alpha * opacity),
        endArrowType: el.shape === 'arrow' ? 'triangle' : undefined,
      },
      objectName: name,
    })
    return
  }
  const glass = el.glass ?? 0
  const fill = parseColor(el.fill, brand) ?? (glass > 0 ? { hex: 'FFFFFF', alpha: 1 } : null)
  // Glas: PowerPoint kennt keine Hintergrund-Unschärfe – es bleibt die Tönung wie im Browser.
  const fillAlpha = fill ? fill.alpha * (glass > 0 ? 0.12 + glass * 0.18 : 1) * opacity : 0
  const radius = Math.min(el.radius ?? 0, Math.min(el.frame.w, el.frame.h) / 2)
  const type = el.shape === 'ellipse' ? pptx.ShapeType.ellipse : radius > 0 ? pptx.ShapeType.roundRect : pptx.ShapeType.rect
  out.addShape(type, {
    ...pos,
    fill: fill ? { color: fill.hex, transparency: transparency(fillAlpha) } : { type: 'none' },
    line: stroke
      ? { color: stroke.hex, width: pt(el.stroke!.width), transparency: transparency(stroke.alpha * opacity) }
      : { type: 'none' },
    rectRadius: type === pptx.ShapeType.roundRect ? inch(radius) : undefined,
    objectName: name,
  })
}

export const EXPORTS_DIR = path.join(STUDIO_ROOT, 'exports')
