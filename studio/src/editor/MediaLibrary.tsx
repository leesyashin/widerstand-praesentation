import { useEffect, useRef, useState, type DragEvent as ReactDragEvent } from 'react'
import { assetUrl, api, type AssetInfo } from '../api/client'
import { useAssets, useBrandAssets } from '../api/live'
import type { Deck, Element } from '../schema/deck'
import { Icon } from '../ui/Icon'
import { ASSET_MIME } from './Canvas'
import { importFile, mb, type Imported } from './media'

type Props = {
  deck: Deck
  deckName: string
  /** Ausgewähltes Bild/Video – dann lässt sich die Datei ersetzen. */
  element: Element | undefined
  onInsert: (media: Imported) => void
  onReplace: (media: Imported) => void
  onClose: () => void
}

type Message = { id: number; text: string; kind: 'info' | 'error' | 'busy' }

/**
 * Medien-Bibliothek: alle Dateien des Decks und des Brand-Kits. Dateien per Drag & Drop (hierher oder direkt auf
 * die Folie) importieren – Bilder werden dabei optimiert, Videos bekommen ein Posterbild.
 */
export function MediaLibrary({ deck, deckName, element, onInsert, onReplace, onClose }: Props) {
  const assets = useAssets(deckName)
  const brand = useBrandAssets()
  const ref = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [over, setOver] = useState(false)
  const seq = useRef(0)

  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement
      if (!ref.current?.contains(target) && !target.closest('.media-toggle') && !target.closest('.selection-layer')) onClose()
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  const say = (text: string, kind: Message['kind']) => {
    const id = ++seq.current
    setMessages((m) => [...m.slice(-4), { id, text, kind }])
    return id
  }
  const update = (id: number, text: string, kind: Message['kind']) =>
    setMessages((m) => m.map((x) => (x.id === id ? { ...x, text, kind } : x)))

  const upload = async (files: FileList | File[]) => {
    for (const file of files) {
      const id = say(`${file.name} wird importiert …`, 'busy')
      try {
        const media = await importFile(deckName, file)
        update(id, `${media.path}${media.note ? ` · ${media.note}` : ''}`, 'info')
      } catch (err) {
        update(id, (err as Error).message, 'error')
      }
    }
  }

  const used = JSON.stringify(deck)
  const replaceable = element?.type === 'image' || element?.type === 'video' || element?.type === 'lottie' ? element.type : null

  const tile = (a: AssetInfo, deletable: boolean) => {
    const kind = a.kind === 'other' ? null : a.kind
    const url = assetUrl(deckName, a.path)
    const name = a.path.split('/').pop()
    const inUse = used.includes(`"${a.path}"`)
    return (
      <div
        key={a.path}
        className="media-tile"
        draggable={Boolean(kind)}
        title={`${a.path} · ${mb(a.size)}${inUse ? ' · wird verwendet' : ''}`}
        onDragStart={(e) => {
          if (!kind) return
          e.dataTransfer.setData(ASSET_MIME, JSON.stringify({ path: a.path, kind }))
          e.dataTransfer.effectAllowed = 'copy'
        }}
      >
        <button type="button" className="media-tile__thumb" disabled={!kind} onClick={() => kind && onInsert({ path: a.path, kind })}>
          {a.kind === 'image' && <img src={url} alt="" loading="lazy" draggable={false} />}
          {a.kind === 'video' && <video src={url} preload="metadata" muted />}
          {a.kind === 'lottie' && <span className="media-tile__kind">Lottie</span>}
          {a.kind === 'other' && <span className="media-tile__kind">Datei</span>}
        </button>
        <span className="media-tile__name">{name}</span>
        <span className="media-tile__actions">
          {replaceable && kind === replaceable && (
            <button type="button" className="btn btn--mini" title="Datei des ausgewählten Elements ersetzen" onClick={() => onReplace({ path: a.path, kind })}>
              <Icon name="redo" size={12} />
            </button>
          )}
          {deletable && !inUse && (
            <button
              type="button"
              className="btn btn--mini"
              title="Datei löschen (wird nirgends verwendet)"
              onClick={() => {
                if (confirm(`${a.path} endgültig löschen?`)) void api.deleteAsset(deckName, a.path)
              }}
            >
              <Icon name="trash" size={12} />
            </button>
          )}
        </span>
      </div>
    )
  }

  const onDrop = (e: ReactDragEvent) => {
    e.preventDefault()
    setOver(false)
    if (e.dataTransfer.files.length) void upload(e.dataTransfer.files)
  }

  return (
    <div
      ref={ref}
      className={`media-library material ${over ? 'is-over' : ''}`}
      onDragOver={(e) => {
        if (![...e.dataTransfer.types].includes('Files')) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (!ref.current?.contains(e.relatedTarget as Node)) setOver(false)
      }}
      onDrop={onDrop}
    >
      <div className="media-library__head">
        <h3 className="section-title">Medien</h3>
        <button type="button" className="btn" onClick={() => input.current?.click()}>
          <Icon name="upload" size={14} /> Importieren
        </button>
        <input
          ref={input}
          type="file"
          multiple
          hidden
          accept="image/*,video/*,.json,.svg"
          onChange={(e) => {
            if (e.target.files) void upload([...e.target.files])
            e.target.value = ''
          }}
        />
      </div>
      <p className="field-hint muted">
        Dateien hierher oder direkt auf die Folie ziehen. Bilder werden auf max. 3840 px optimiert, Videos (max. 100 MB)
        bekommen ein Posterbild. Klick fügt ein, Ziehen platziert.
      </p>
      {messages.length > 0 && (
        <ul className="media-messages">
          {messages.map((m) => (
            <li key={m.id} className={`media-messages__${m.kind}`}>
              {m.text}
            </li>
          ))}
        </ul>
      )}
      <h4 className="media-library__section">Dieses Deck</h4>
      {assets.value?.length ? (
        <div className="media-grid">{assets.value.map((a) => tile(a, true))}</div>
      ) : (
        <div className="media-empty muted">Noch keine Dateien in decks/{deckName}/assets/</div>
      )}
      {brand.value && brand.value.length > 0 && (
        <>
          <h4 className="media-library__section">Brand-Kit</h4>
          <div className="media-grid">{brand.value.map((a) => tile(a, false))}</div>
        </>
      )}
    </div>
  )
}
