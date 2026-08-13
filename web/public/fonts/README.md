# Bundled fonts

These TTFs are shipped with Vikado and are the **only** fonts text and subtitles may use.
That restriction is deliberate: the browser loads these exact files as webfonts for the
preview, and the render service points libass at this same directory (`VIKADO_FONTS_DIR`)
when it burns text into the exported video. Using a system font would render correctly in
one place and wrongly in the other.

The list the editor offers is defined in `web/src/schema/fonts.ts`. Adding a font means
dropping the TTF here, adding its licence file, adding an `@font-face` rule in
`web/src/index.css`, and adding an entry to `BUNDLED_FONTS`.
`web/src/schema/fonts.test.ts` fails if any of those four drift apart.

## Two rules, both enforced by the tests

**The file's internal family name must equal the `family` string.** That string is what
goes into the ASS style line, and it is all libass has to match on. A mismatch does not
error — libass quietly substitutes a different face and the export stops matching the
preview. (0.1.0 shipped a `Roboto.ttf` that was a saved HTML page, so every Roboto project
silently rendered in a fallback font on both sides.)

**A variable font's default instance must be Regular.** libass renders the default
instance; the browser can pick any point on the weight axis. Montserrat defaults to Thin
and Merriweather to Light upstream, so both are pinned to `wght=400` with
`fonttools varLib.instancer` before bundling, and their name tables rewritten to the plain
family name. Check a new variable font with:

```bash
python3 -c "from fontTools.ttLib import TTFont; f=TTFont('X.ttf'); print(f['name'].getDebugName(1), f['OS/2'].usWeightClass)"
```

The `@font-face` weight range must also match what the file can do. A single-weight face
declared as `font-weight: 100 900` would be used as-is by the browser at 700 while libass
synthesises faux bold — so static faces declare `font-weight: 400` and both sides
synthesise alike.

| Font | File | Category | Licence |
| --- | --- | --- | --- |
| Inter | `Inter.ttf` | Sans | SIL OFL 1.1 — [`LICENSE-Inter.txt`](LICENSE-Inter.txt) |
| Roboto | `Roboto.ttf` | Sans | SIL OFL 1.1 — [`LICENSE-Roboto.txt`](LICENSE-Roboto.txt) |
| Montserrat | `Montserrat.ttf` | Sans | SIL OFL 1.1 — [`LICENSE-Montserrat.txt`](LICENSE-Montserrat.txt) |
| Poppins | `Poppins.ttf` | Sans | SIL OFL 1.1 — [`LICENSE-Poppins.txt`](LICENSE-Poppins.txt) |
| Playfair Display | `PlayfairDisplay.ttf` | Serif | SIL OFL 1.1 — [`LICENSE-PlayfairDisplay.txt`](LICENSE-PlayfairDisplay.txt) |
| Merriweather | `Merriweather.ttf` | Serif | SIL OFL 1.1 — [`LICENSE-Merriweather.txt`](LICENSE-Merriweather.txt) |
| Oswald | `Oswald.ttf` | Display | SIL OFL 1.1 — [`LICENSE-Oswald.txt`](LICENSE-Oswald.txt) |
| Bebas Neue | `BebasNeue.ttf` | Display | SIL OFL 1.1 — [`LICENSE-BebasNeue.txt`](LICENSE-BebasNeue.txt) |
| Anton | `Anton.ttf` | Display | SIL OFL 1.1 — [`LICENSE-Anton.txt`](LICENSE-Anton.txt) |
| Bangers | `Bangers.ttf` | Display | SIL OFL 1.1 — [`LICENSE-Bangers.txt`](LICENSE-Bangers.txt) |
| Lobster | `Lobster.ttf` | Script | SIL OFL 1.1 — [`LICENSE-Lobster.txt`](LICENSE-Lobster.txt) |
| Caveat | `Caveat.ttf` | Handwriting | SIL OFL 1.1 — [`LICENSE-Caveat.txt`](LICENSE-Caveat.txt) |
| JetBrains Mono | `JetBrainsMono.ttf` | Mono | SIL OFL 1.1 — [`LICENSE-JetBrainsMono.txt`](LICENSE-JetBrainsMono.txt) |

All of them come from [google/fonts](https://github.com/google/fonts). The SIL Open Font
License permits bundling and redistribution; each licence file above is the copyright and
licence text that shipped with that family, kept verbatim.

Vikado's own MIT licence in the repository root does not apply to these font files.
