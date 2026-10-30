import { icons } from 'lucide'

type IconNode = [string, Record<string, string | number>][]

/** "arrow-right" → "ArrowRight" (Lucide-Namen, siehe lucide.dev/icons). */
function pascal(name: string): string {
  return name.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase())
}

export function findIcon(name: string): IconNode | null {
  return ((icons as Record<string, IconNode>)[pascal(name)] ?? null) as IconNode | null
}

/** Lucide-Icon als SVG, Strichstärke und Farbe frei wählbar. */
export function LucideIcon({ node, color, strokeWidth }: { node: IconNode; color: string; strokeWidth: number }) {
  return (
    <svg
      className="el-icon-svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {node.map(([tag, attrs], i) => {
        const Tag = tag as 'path'
        return <Tag key={i} {...(attrs as Record<string, string>)} />
      })}
    </svg>
  )
}
