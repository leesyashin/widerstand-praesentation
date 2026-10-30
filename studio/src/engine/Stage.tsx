import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import type { Deck } from '../schema/deck'

/**
 * Bühne in festen logischen Pixeln (z. B. 1920×1080), skaliert auf den verfügbaren Platz.
 * Alles darin rechnet in Folien-Koordinaten – unabhängig von Bildschirmgröße.
 */
export function Stage({
  format,
  children,
  className,
}: {
  format: Deck['format']
  children: ReactNode
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      setScale(Math.min(width / format.width, height / format.height))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [format.width, format.height])

  return (
    <div ref={ref} className={`stage ${className ?? ''}`}>
      <div
        className="stage__frame"
        style={{ width: format.width * scale, height: format.height * scale, opacity: scale ? 1 : 0 }}
      >
        <div
          className="stage__surface"
          style={{ width: format.width, height: format.height, transform: `scale(${scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  )
}
