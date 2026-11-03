import type { ReactNode } from 'react'
import type { Look } from '../schema/deck'

/**
 * Shader-Looks als SVG-Filter – sie wirken auf echtes HTML (Text bleibt Text):
 * distort (flüssig/Hitzeflimmern), chromatic (Farbversatz), glitch (Störung in Schüben).
 * Lebendig nur im Editor und in der Präsentation; Screenshots und Vorschaubilder zeigen einen ruhigen Stand.
 */
export function LookFilter({ id, look, live }: { id: string; look: Look; live: boolean }) {
  const amount = look.amount
  const speed = look.speed ?? 0.3
  return (
    <filter id={id} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
      {look.type === 'distort' && <Distort amount={amount} speed={speed} scale={look.scale ?? 0.5} live={live} />}
      {look.type === 'chromatic' && <Chromatic amount={amount} speed={speed} live={live} />}
      {look.type === 'glitch' && <Glitch amount={amount} speed={speed} live={live} />}
    </filter>
  )
}

function Distort({ amount, speed, scale, live }: { amount: number; speed: number; scale: number; live: boolean }) {
  const f = 0.002 + scale * 0.028
  const dur = 14 - speed * 12
  return (
    <>
      <feTurbulence type="fractalNoise" baseFrequency={f} numOctaves={2} seed={4} result="n">
        {live && <animate attributeName="baseFrequency" dur={`${dur}s`} values={`${f};${f * 1.5};${f * 0.8};${f}`} repeatCount="indefinite" />}
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="n" scale={amount * 70} xChannelSelector="R" yChannelSelector="G" />
    </>
  )
}

/** RGB-Kanäle auseinanderschieben und wieder mischen. */
function Channels({ dx, children }: { dx: number; children?: ReactNode }) {
  return (
    <>
      <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
      <feOffset in="r" dx={-dx} dy={0} result="r2">
        {children}
      </feOffset>
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
      <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
      <feOffset in="b" dx={dx} dy={0} result="b2" />
      <feBlend in="r2" in2="g" mode="screen" result="rg" />
      <feBlend in="rg" in2="b2" mode="screen" />
    </>
  )
}

function Chromatic({ amount, speed, live }: { amount: number; speed: number; live: boolean }) {
  const dx = 2 + amount * 14
  return (
    <Channels dx={dx}>
      {live && <animate attributeName="dx" dur={`${8 - speed * 6}s`} values={`${-dx};${-dx * 0.4};${-dx * 1.3};${-dx}`} repeatCount="indefinite" />}
    </Channels>
  )
}

function Glitch({ amount, speed, live }: { amount: number; speed: number; live: boolean }) {
  const s = amount * 80
  const dur = `${4.5 - speed * 3.5}s`
  // Meist ruhig, dann kurze Schübe – „discrete“ springt ohne Überblenden.
  const bursts = `0;0;0;0;0;0;${s};${-s * 0.6};0;0;0;0;${s * 0.4};0;0;${-s};${s * 0.7};0;0;0`
  return (
    <>
      <feTurbulence type="turbulence" baseFrequency="0.00001 0.12" numOctaves={1} seed={2} result="bands">
        {live && <animate attributeName="seed" dur={dur} values="2;7;11;3;9;5" calcMode="discrete" repeatCount="indefinite" />}
      </feTurbulence>
      <feDisplacementMap in="SourceGraphic" in2="bands" scale={live ? 0 : s * 0.3} xChannelSelector="R" yChannelSelector="R" result="moved">
        {live && <animate attributeName="scale" dur={dur} values={bursts} calcMode="discrete" repeatCount="indefinite" />}
      </feDisplacementMap>
      <feColorMatrix in="moved" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
      <feOffset in="r" dx={-amount * 6} result="r2">
        {live && <animate attributeName="dx" dur={dur} values={bursts.split(';').map((v) => String(-Math.abs(Number(v)) * 0.25)).join(';')} calcMode="discrete" repeatCount="indefinite" />}
      </feOffset>
      <feColorMatrix in="moved" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb" />
      <feBlend in="r2" in2="gb" mode="screen" />
    </>
  )
}

/** Gemeinsamer Filter für den Glitch-Übergang (einmal im Dokument). */
export function ensureTransitionFilter(): string {
  const id = 'studio-tx-rgb'
  if (document.getElementById(id)) return id
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg')
  svg.setAttribute('width', '0')
  svg.setAttribute('height', '0')
  svg.style.position = 'absolute'
  svg.innerHTML = `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB">
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r"/>
    <feOffset in="r" dx="-18" result="r2"/>
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0" result="gb"/>
    <feOffset in="gb" dx="10" result="gb2"/>
    <feBlend in="r2" in2="gb2" mode="screen"/>
  </filter>`
  document.body.append(svg)
  return id
}
