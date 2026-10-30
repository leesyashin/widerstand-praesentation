// Schlanke UI-Icons (1,5 px Strich, 16 px Raster) im Stil von SF Symbols.
const paths = {
  chevronLeft: 'M10 3.5 5.5 8l4.5 4.5',
  play: 'M5 3.2v9.6c0 .4.4.6.7.4l7.3-4.8c.3-.2.3-.6 0-.8L5.7 2.8c-.3-.2-.7 0-.7.4Z',
  warning: 'M8 2.5 1.8 13h12.4L8 2.5ZM8 6.5v3M8 11.3v.2',
  stack: 'M8 2 2 5l6 3 6-3-6-3ZM2 8l6 3 6-3M2 11l6 3 6-3',
  sparkle: 'M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.1 2.1M10.5 10.5l2.1 2.1M3.4 12.6l2.1-2.1M10.5 5.5l2.1-2.1',
  undo: 'M5.5 6.5h5a3 3 0 0 1 0 6H8M5.5 6.5 8 4M5.5 6.5 8 9',
  redo: 'M10.5 6.5h-5a3 3 0 0 0 0 6H8M10.5 6.5 8 4M10.5 6.5 8 9',
  text: 'M3.5 4h9M8 4v8.5M6 12.5h4',
  shape: 'M3 3.5h10v9H3z',
  line: 'M3 13 13 3',
  image: 'M2.5 3.5h11v9h-11zM2.5 10.5l3.2-3 3 2.8 1.8-1.6 3 2.3M10.5 6.2v.1',
  plus: 'M8 3.5v9M3.5 8h9',
  copy: 'M5.5 5.5h7v7h-7zM3.5 10.5v-7h7',
  trash: 'M3 4.5h10M6.5 4.5V3h3v1.5M4.5 4.5l.7 8.5h5.6l.7-8.5',
  icon: 'M8 2.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7L8 10.6l-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z',
} as const

export type IconName = keyof typeof paths

export function Icon({ name, size = 16 }: { name: IconName; size?: number }) {
  const filled = name === 'play'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={paths[name]} />
    </svg>
  )
}
