import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BUNDLED_FONTS, FONT_FAMILIES, fontsByCategory } from '@/schema/fonts'

/**
 * The bundled fonts are the one asset the browser and the render service must
 * agree on byte-for-byte: the preview rasterises with them via @font-face and
 * libass loads the same directory. Nothing in a type check notices when a file
 * is missing, is not actually a font, or carries a family name different from
 * the one the ASS style line asks for — libass just silently substitutes and
 * the export stops matching the preview.
 *
 * 0.1.0 shipped a Roboto.ttf that was a saved HTML page.
 */

const FONT_DIR = join(__dirname, '../../public/fonts')

function fontPath(file: string): string {
  return join(FONT_DIR, file.replace(/^\/fonts\//, ''))
}

/** nameID 1 (font family) from the TTF `name` table. */
function internalFamily(path: string): string {
  const buf = readFileSync(path)
  const numTables = buf.readUInt16BE(4)
  let nameOffset = -1
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16
    if (buf.toString('latin1', rec, rec + 4) === 'name') {
      nameOffset = buf.readUInt32BE(rec + 8)
      break
    }
  }
  if (nameOffset < 0) throw new Error(`no name table in ${path}`)

  const count = buf.readUInt16BE(nameOffset + 2)
  const stringOffset = buf.readUInt16BE(nameOffset + 4)
  for (let i = 0; i < count; i++) {
    const rec = nameOffset + 6 + i * 12
    const platformId = buf.readUInt16BE(rec)
    const nameId = buf.readUInt16BE(rec + 6)
    const length = buf.readUInt16BE(rec + 8)
    const offset = buf.readUInt16BE(rec + 10)
    if (nameId !== 1) continue
    const start = nameOffset + stringOffset + offset
    const raw = buf.subarray(start, start + length)
    return platformId === 3 ? raw.swap16().toString('utf16le') : raw.toString('latin1')
  }
  throw new Error(`no family name in ${path}`)
}

describe('bundled fonts', () => {
  it.each(BUNDLED_FONTS)('$family ships a real font file', ({ file }) => {
    const path = fontPath(file)
    expect(existsSync(path), `${path} is missing`).toBe(true)
    const magic = readFileSync(path).subarray(0, 4)
    // 0x00010000 = TrueType, 'true' = legacy Mac, 'OTTO' = CFF outlines
    const tag = magic.toString('latin1')
    const isFont = magic.readUInt32BE(0) === 0x00010000 || tag === 'true' || tag === 'OTTO'
    expect(isFont, `${file} is not a font (starts with ${JSON.stringify(tag)})`).toBe(true)
  })

  it.each(BUNDLED_FONTS)('$family matches the name libass will match on', ({ family, file }) => {
    expect(internalFamily(fontPath(file))).toBe(family)
  })

  it.each(BUNDLED_FONTS)('$family ships its licence', ({ file }) => {
    const stem = file.replace(/^\/fonts\//, '').replace(/\.ttf$/, '')
    const licence = join(FONT_DIR, `LICENSE-${stem}.txt`)
    expect(existsSync(licence), `${licence} is missing`).toBe(true)
    expect(readFileSync(licence, 'utf8')).toMatch(/SIL OPEN FONT LICENSE/i)
  })

  it('declares an @font-face for every family, pointing at the same file', () => {
    const css = readFileSync(join(__dirname, '../index.css'), 'utf8')
    for (const { family, file } of BUNDLED_FONTS) {
      const face = new RegExp(`@font-face\\s*{[^}]*font-family:\\s*'${family}'[^}]*}`).exec(css)
      expect(face, `no @font-face for ${family}`).not.toBeNull()
      expect(face![0], `${family} @font-face points at the wrong file`).toContain(`url('${file}')`)
    }
  })

  it('has no duplicate families', () => {
    expect(new Set(FONT_FAMILIES).size).toBe(FONT_FAMILIES.length)
  })

  it('puts every font in exactly one picker group', () => {
    const grouped = fontsByCategory().flatMap((g) => g.fonts)
    expect(grouped).toHaveLength(BUNDLED_FONTS.length)
  })
})
