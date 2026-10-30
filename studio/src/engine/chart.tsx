import type { ChartElement } from '../schema/deck'
import { resolveColor } from './brand'
import { formatGermanNumber } from './text'

/**
 * Charts als SVG in logischen Pixeln. Teile tragen Klassen, an denen der Build "grow" ansetzt:
 * .chart-bar (wachsen), .chart-line / .chart-seg (zeichnen), .chart-dot, .chart-area, .chart-value, .chart-label.
 */
const LABEL = 26
const VALUE = 34

function format(value: number, unit: string | undefined): string {
  const decimals = Number.isInteger(value) ? 0 : 1
  return formatGermanNumber(value, decimals, Math.abs(value) >= 10000) + (unit ?? '')
}

export function ChartBody({ el }: { el: ChartElement }) {
  const { w, h } = el.frame
  const color = (c?: string) => resolveColor(c ?? el.color ?? 'brand.accent')
  const max = el.max ?? Math.max(...el.data.map((d) => d.value), 1)
  const showLabels = el.showLabels ?? true
  const showValues = el.showValues ?? true
  const top = showValues ? VALUE + 20 : 8
  const bottom = showLabels ? LABEL + 24 : 8
  const plotH = Math.max(10, h - top - bottom)

  if (el.chart === 'donut') {
    const size = Math.min(w, h)
    const r = size / 2 - size * 0.08
    const stroke = size * 0.12
    const c = 2 * Math.PI * r
    const total = el.data.reduce((s, d) => s + Math.max(0, d.value), 0) || 1
    const lengths = el.data.map((d) => (Math.max(0, d.value) / total) * c)
    const starts = lengths.map((_, i) => lengths.slice(0, i).reduce((s, l) => s + l, 0))
    const gap = el.data.length > 1 ? Math.min(6, c * 0.01) : 0
    const palette = ['brand.accent', 'brand.textMuted', 'brand.accent2', 'brand.text', 'brand.surface']
    return (
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`}>
        <g transform={`translate(${w / 2} ${h / 2}) rotate(-90)`}>
          <circle r={r} style={{ fill: 'none', stroke: 'var(--brand-surface)', strokeWidth: stroke }} />
          {el.data.map((d, i) => {
            const len = lengths[i] ?? 0
            return (
              <circle
                key={i}
                className="chart-seg"
                r={r}
                data-len={Math.max(0, len - gap)}
                data-circ={c}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-(starts[i] ?? 0)}
                style={{ fill: 'none', stroke: resolveColor(d.color ?? palette[i % palette.length]), strokeWidth: stroke }}
              />
            )
          })}
        </g>
        {showValues && (
          <text
            className="chart-value"
            x={w / 2}
            y={h / 2}
            textAnchor="middle"
            dominantBaseline="central"
            style={{ fill: 'var(--brand-text)', fontSize: size * 0.16, fontWeight: 650 }}
          >
            {format(el.data[0]?.value ?? 0, el.unit)}
          </text>
        )}
        {showLabels && el.data[0] && (
          <text
            className="chart-label"
            x={w / 2}
            y={h / 2 + size * 0.13}
            textAnchor="middle"
            style={{ fill: 'var(--brand-textMuted)', fontSize: Math.max(18, size * 0.05) }}
          >
            {el.data[0].label}
          </text>
        )}
      </svg>
    )
  }

  const n = el.data.length
  const slot = w / n
  const y = (v: number) => top + plotH - (Math.max(0, v) / max) * plotH

  if (el.chart === 'line') {
    const pts = el.data.map((d, i) => [slot * i + slot / 2, y(d.value)] as const)
    const path = pts.map(([x, py], i) => `${i ? 'L' : 'M'}${x} ${py}`).join(' ')
    const area = `${path} L${pts[pts.length - 1]![0]} ${top + plotH} L${pts[0]![0]} ${top + plotH} Z`
    const gid = `area-${el.id}`
    return (
      <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" style={{ stopColor: color(), stopOpacity: 0.28 }} />
            <stop offset="1" style={{ stopColor: color(), stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        <line x1={0} x2={w} y1={top + plotH} y2={top + plotH} style={{ stroke: 'var(--brand-surface)', strokeWidth: 2 }} />
        <path className="chart-area" d={area} style={{ fill: `url(#${gid})` }} />
        <path className="chart-line" d={path} style={{ fill: 'none', stroke: color(), strokeWidth: 5, strokeLinejoin: 'round', strokeLinecap: 'round' }} />
        {pts.map(([x, py], i) => (
          <g key={i}>
            <circle className="chart-dot" cx={x} cy={py} r={9} style={{ fill: color(el.data[i]?.color), stroke: 'var(--brand-background)', strokeWidth: 4 }} />
            {showValues && (
              <text className="chart-value" x={x} y={py - 26} textAnchor="middle" style={{ fill: 'var(--brand-text)', fontSize: VALUE * 0.8, fontWeight: 600 }}>
                {format(el.data[i]!.value, el.unit)}
              </text>
            )}
            {showLabels && (
              <text className="chart-label" x={x} y={h - 8} textAnchor="middle" style={{ fill: 'var(--brand-textMuted)', fontSize: LABEL }}>
                {el.data[i]!.label}
              </text>
            )}
          </g>
        ))}
      </svg>
    )
  }

  // Balken
  const barW = slot * 0.62
  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`}>
      <line x1={0} x2={w} y1={top + plotH} y2={top + plotH} style={{ stroke: 'var(--brand-surface)', strokeWidth: 2 }} />
      {el.data.map((d, i) => {
        const x = slot * i + (slot - barW) / 2
        const by = y(d.value)
        return (
          <g key={i}>
            <rect className="chart-bar" x={x} y={by} width={barW} height={top + plotH - by} rx={Math.min(10, barW / 6)} style={{ fill: color(d.color) }} />
            {showValues && (
              <text className="chart-value" x={x + barW / 2} y={by - 16} textAnchor="middle" style={{ fill: 'var(--brand-text)', fontSize: VALUE, fontWeight: 650 }}>
                {format(d.value, el.unit)}
              </text>
            )}
            {showLabels && (
              <text className="chart-label" x={x + barW / 2} y={h - 8} textAnchor="middle" style={{ fill: 'var(--brand-textMuted)', fontSize: LABEL }}>
                {d.label}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
