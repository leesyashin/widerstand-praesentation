// Schlanke UI-Icons (1,5 px Strich, 16 px Raster) im Stil von SF Symbols.
const paths = {
  chevronLeft: 'M10 3.5 5.5 8l4.5 4.5',
  play: 'M5 3.2v9.6c0 .4.4.6.7.4l7.3-4.8c.3-.2.3-.6 0-.8L5.7 2.8c-.3-.2-.7 0-.7.4Z',
  warning: 'M8 2.5 1.8 13h12.4L8 2.5ZM8 6.5v3M8 11.3v.2',
  stack: 'M8 2 2 5l6 3 6-3-6-3ZM2 8l6 3 6-3M2 11l6 3 6-3',
  sparkle: 'M8 1.5v3M8 11.5v3M1.5 8h3M11.5 8h3M3.4 3.4l2.1 2.1M10.5 10.5l2.1 2.1M3.4 12.6l2.1-2.1M10.5 5.5l2.1-2.1',
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
