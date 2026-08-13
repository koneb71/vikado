# Bundled fonts

These TTFs are shipped with Vikado and are the **only** fonts text and subtitles may use.
That restriction is deliberate: the browser loads these exact files as webfonts for the
preview, and the render service points libass at this same directory (`VIKADO_FONTS_DIR`)
when it burns text into the exported video. Using a system font would render correctly in
one place and wrongly in the other.

The list the editor offers is defined in `web/src/schema/fonts.ts`. Adding a font means
dropping the TTF here, adding its licence file, adding an `@font-face` rule in
`web/src/index.css`, and adding an entry to `BUNDLED_FONTS`.

| Font | File | Licence |
| --- | --- | --- |
| Inter | `Inter.ttf` | SIL Open Font License 1.1 — [`LICENSE-Inter.txt`](LICENSE-Inter.txt) |
| Roboto | `Roboto.ttf` | SIL Open Font License 1.1 — [`LICENSE-Roboto.txt`](LICENSE-Roboto.txt) |
| Oswald | `Oswald.ttf` | SIL Open Font License 1.1 — [`LICENSE-Oswald.txt`](LICENSE-Oswald.txt) |
| Playfair Display | `PlayfairDisplay.ttf` | SIL Open Font License 1.1 — [`LICENSE-PlayfairDisplay.txt`](LICENSE-PlayfairDisplay.txt) |
| JetBrains Mono | `JetBrainsMono.ttf` | SIL Open Font License 1.1 — [`LICENSE-JetBrainsMono.txt`](LICENSE-JetBrainsMono.txt) |

All five are variable fonts taken from [google/fonts](https://github.com/google/fonts).
The SIL Open Font License permits bundling and redistribution; each licence file above is
the copyright and licence text that shipped with that family, kept verbatim.

Vikado's own MIT licence in the repository root does not apply to these font files.
