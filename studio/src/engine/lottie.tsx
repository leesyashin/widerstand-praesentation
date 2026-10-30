import lottie from 'lottie-web/build/player/lottie_light'
import { useEffect, useRef, useState } from 'react'
import type { LottieElement } from '../schema/deck'
import { BUILD_IN_EVENT } from './buildEvents'
import type { RenderMode } from './SlideView'


/**
 * Lottie-Animation (After Effects / Bodymovin).
 * Editor/Präsentation: spielt beim Erscheinen – mit Einblend-Build erst, wenn der Build startet.
 * Vorschau/Screenshot: steht auf `posterFrame` (Standard: letzter Frame).
 */
export function LottieView({ el, url, mode }: { el: LottieElement; url: string; mode: RenderMode }) {
  const container = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const live = mode === 'view' || mode === 'present'
  const waitForBuild = Boolean(el.build?.in) && mode === 'present'

  useEffect(() => {
    const node = container.current
    if (!node) return
    let anim: ReturnType<typeof lottie.loadAnimation> | null = null
    let cancelled = false
    // Kommt das Build-Signal, bevor die Datei geladen ist, wird es nachgeholt.
    let requested = false
    const trigger = node.closest('.el-anim')
    const play = () => {
      requested = true
      anim?.goToAndPlay(0, true)
    }
    void fetch(url)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((data: unknown) => {
        if (cancelled) return
        anim = lottie.loadAnimation({
          container: node,
          renderer: 'svg',
          loop: el.loop ?? false,
          autoplay: false,
          animationData: data,
          rendererSettings: { preserveAspectRatio: 'xMidYMid meet' },
        })
        anim.setSpeed(el.speed ?? 1)
        if (live && (!waitForBuild || requested)) anim.play()
        else if (!live) anim.goToAndStop(el.posterFrame ?? Math.max(0, anim.totalFrames - 1), true)
      })
      .catch((err: Error) => !cancelled && setError(err.message))
    trigger?.addEventListener(BUILD_IN_EVENT, play)
    return () => {
      cancelled = true
      trigger?.removeEventListener(BUILD_IN_EVENT, play)
      anim?.destroy()
    }
  }, [url, el.loop, el.speed, el.posterFrame, live, waitForBuild])

  if (error) {
    return (
      <div className="el-placeholder">
        <strong>Lottie</strong>
        <span>Datei nicht lesbar ({error})</span>
      </div>
    )
  }
  return <div ref={container} className="el-lottie" />
}
