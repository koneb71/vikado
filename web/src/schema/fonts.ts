/**
 * The bundled font list — the ONLY fonts text/subtitles may use, so the
 * browser preview and the libass renderer draw from identical files.
 * Files live in web/public/fonts (served at /fonts in dev and prod; the
 * render service points libass' fontsdir at the same directory).
 */
export interface BundledFont {
  family: string
  file: string
  category: 'sans' | 'serif' | 'display' | 'mono'
}

export const BUNDLED_FONTS: BundledFont[] = [
  { family: 'Inter', file: '/fonts/Inter.ttf', category: 'sans' },
  { family: 'Roboto', file: '/fonts/Roboto.ttf', category: 'sans' },
  { family: 'Oswald', file: '/fonts/Oswald.ttf', category: 'display' },
  { family: 'Playfair Display', file: '/fonts/PlayfairDisplay.ttf', category: 'serif' },
  { family: 'JetBrains Mono', file: '/fonts/JetBrainsMono.ttf', category: 'mono' },
]

export const FONT_FAMILIES = BUNDLED_FONTS.map((f) => f.family)
