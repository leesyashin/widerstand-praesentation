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
  chart: 'M3 13V9M6.5 13V5M10 13V7.5M13.5 13V3M2.5 13.5h11',
  space: 'M2.5 4.5h5v3.5h-5zM9 8.5h4.5V12H9zM5 8v2.5h4',
  icon: 'M8 2.5l1.6 3.4 3.7.4-2.8 2.5.8 3.7L8 10.6l-3.3 1.9.8-3.7-2.8-2.5 3.7-.4z',
  alignLeft: 'M2.5 2v12M5 4.5h8v2.5H5zM5 9.5h5V12H5z',
  alignHCenter: 'M8 2v12M3.5 4.5h9v2.5h-9zM5 9.5h6V12H5z',
  alignRight: 'M13.5 2v12M3 4.5h8v2.5H3zM6 9.5h5V12H6z',
  alignTop: 'M2 2.5h12M4.5 5h2.5v8H4.5zM9.5 5H12v5H9.5z',
  alignVCenter: 'M2 8h12M4.5 3.5h2.5v9H4.5zM9.5 5H12v6H9.5z',
  alignBottom: 'M2 13.5h12M4.5 3h2.5v8H4.5zM9.5 6H12v5H9.5z',
  distributeH: 'M2.5 2v12M13.5 2v12M6.5 5h3v6h-3z',
  distributeV: 'M2 2.5h12M2 13.5h12M5 6.5h6v3H5z',
  group: 'M2.5 2.5h11v11h-11zM5 5h3.5v3H5zM8 8.5h3V11H8z',
  ungroup: 'M2.5 2.5h7v6h-7zM6.5 7.5h7v6h-7z',
  eye: 'M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8ZM8 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z',
  eyeOff: 'M2.5 2.5l11 11M6.6 3.7A6.7 6.7 0 0 1 8 3.5c4.1 0 6.5 4.5 6.5 4.5a11 11 0 0 1-1.7 2.2M4.2 5.1A11 11 0 0 0 1.5 8s2.4 4.5 6.5 4.5c1 0 1.9-.3 2.7-.7',
  lock: 'M4 7.5h8v6H4zM5.5 7.5V5.5a2.5 2.5 0 0 1 5 0v2',
  unlock: 'M4 7.5h8v6H4zM5.5 7.5V5.5a2.5 2.5 0 0 1 4.8-1',
  grid: 'M2.5 2.5h4.5V7H2.5zM9 2.5h4.5V7H9zM2.5 9h4.5v4.5H2.5zM9 9h4.5v4.5H9z',
  master: 'M2.5 3.5h11v9h-11zM2.5 6h11M5 3.5V6',
  folder: 'M2 4.5v8h12V6H8L6.5 4.5z',
  upload: 'M8 10.5V3M5 6l3-3 3 3M3 10.5v2.5h10v-2.5',
  font: 'M3 13 7 3h2l4 10M4.8 9.5h6.4',
  chevronDown: 'M4 6l4 4 4-4',
  chevronRight: 'M6 4l4 4-4 4',
  forward: 'M5.5 2.5h8v8M2.5 5.5h8v8h-8z',
  backward: 'M2.5 2.5h8v8h-8zM5.5 10.5v3h8v-8h-3',
  rotate: 'M13 8a5 5 0 1 1-1.5-3.6M13 2.5v2.5h-2.5',
  x: 'M4 4l8 8M12 4l-8 8',
  sliders: 'M2.5 4.5h7M12.5 4.5h1M2.5 11.5h1M6.5 11.5h7M11 3v3M5 10v3',
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
