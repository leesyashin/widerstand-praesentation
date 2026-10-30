/** Was eine eigene Komponente (studio/custom/*.tsx) übergeben bekommt. */
export type CustomProps<P> = {
  /** Die props aus der deck.json, geprüft gegen das exportierte `schema`. */
  props: P
  /** edit = Editor, thumb = Vorschaubild, present = Präsentation, render = Screenshot. */
  mode: 'view' | 'thumb' | 'present' | 'render'
  /** Größe des Elements in logischen Pixeln. */
  width: number
  height: number
  /** Pfad aus props → URL, z. B. "assets/foto.jpg" oder "brand/logo.svg". */
  assetUrl: (src: string) => string
}
