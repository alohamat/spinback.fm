import { getPaletteSync } from 'colorthief'
import type { Color } from 'colorthief'

export function colorDistance(a: Color, b: Color): number {
  const { r: r1, g: g1, b: b1 } = a.rgb()
  const { r: r2, g: g2, b: b2 } = b.rgb()
  return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2)
}

export function pickDistinctColors(palette: Color[], count = 3): Color[] {
  if (!palette || palette.length === 0) return []
  const picked: Color[] = [palette[0]!]
  while (picked.length < count && picked.length < palette.length) {
    const best = palette
      .filter(c => !picked.includes(c))
      .reduce((a, b) =>
        Math.min(...picked.map(p => colorDistance(p, b))) >
        Math.min(...picked.map(p => colorDistance(p, a))) ? b : a
      )
    picked.push(best)
  }
  return picked
}

export function extractPaletteFromCover(
  imgUrl: string,
  onLoaded: (extracted: { primary: string; secondary: string; tertiary: string }) => void
): HTMLImageElement {
  const img = new Image()
  img.crossOrigin = 'Anonymous'
  img.src = imgUrl

  img.onload = () => {
    try {
      const raw = getPaletteSync(img, { colorCount: 8 })
      if (raw && raw.length >= 3) {
        const [c1, c2, c3] = pickDistinctColors(raw, 3)
        onLoaded({
          primary: c1?.hex() ?? '#111111',
          secondary: c2?.hex() ?? '#333333',
          tertiary: c3?.hex() ?? '#222222'
        })
      }
    } catch (e) {
      console.error('Error extracting palette from image:', e)
    }
  }

  return img
}
