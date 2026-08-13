/**
 * The bundled font list — the ONLY fonts text/subtitles may use, so the
 * browser preview and the libass renderer draw from identical files.
 * Files live in web/public/fonts (served at /fonts in dev and prod; the
 * render service points libass' fontsdir at the same directory).
 *
 * Two rules keep the two renderers agreeing, both enforced by fonts.test.ts:
 *   - `family` MUST equal the font file's internal family name, because that
 *     string is what goes into the ASS style line for libass to match on.
 *   - every family needs an @font-face in index.css pointing at the same file.
 * A variable font whose default instance is not Regular is pinned to weight
 * 400 before bundling, or libass renders the default instance (Thin, Light)
 * while the browser renders 400.
 */
export interface BundledFont {
  family: string
  file: string
  category: 'sans' | 'serif' | 'display' | 'script' | 'handwriting' | 'mono'
}

export const BUNDLED_FONTS: BundledFont[] = [
  { family: 'Inter', file: '/fonts/Inter.ttf', category: 'sans' },
  { family: 'Roboto', file: '/fonts/Roboto.ttf', category: 'sans' },
  { family: 'Montserrat', file: '/fonts/Montserrat.ttf', category: 'sans' },
  { family: 'Poppins', file: '/fonts/Poppins.ttf', category: 'sans' },
  { family: 'Playfair Display', file: '/fonts/PlayfairDisplay.ttf', category: 'serif' },
  { family: 'Merriweather', file: '/fonts/Merriweather.ttf', category: 'serif' },
  { family: 'Oswald', file: '/fonts/Oswald.ttf', category: 'display' },
  { family: 'Bebas Neue', file: '/fonts/BebasNeue.ttf', category: 'display' },
  { family: 'Anton', file: '/fonts/Anton.ttf', category: 'display' },
  { family: 'Bangers', file: '/fonts/Bangers.ttf', category: 'display' },
  { family: 'Lobster', file: '/fonts/Lobster.ttf', category: 'script' },
  { family: 'Caveat', file: '/fonts/Caveat.ttf', category: 'handwriting' },
  { family: 'JetBrains Mono', file: '/fonts/JetBrainsMono.ttf', category: 'mono' },
]

export const FONT_FAMILIES = BUNDLED_FONTS.map((f) => f.family)

export const FONT_CATEGORY_LABELS: Record<BundledFont['category'], string> = {
  sans: 'Sans serif',
  serif: 'Serif',
  display: 'Display',
  script: 'Script',
  handwriting: 'Handwriting',
  mono: 'Monospace',
}

/** Bundled fonts grouped for the font picker, in registry order. */
export function fontsByCategory(): { category: BundledFont['category']; label: string; fonts: BundledFont[] }[] {
  const order: BundledFont['category'][] = ['sans', 'serif', 'display', 'script', 'handwriting', 'mono']
  return order
    .map((category) => ({
      category,
      label: FONT_CATEGORY_LABELS[category],
      fonts: BUNDLED_FONTS.filter((f) => f.category === category),
    }))
    .filter((g) => g.fonts.length > 0)
}
