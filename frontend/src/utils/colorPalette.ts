import { getPaletteSync } from 'colorthief'

export function extractPaletteFromCover(
  imgUrl: string,
  onLoaded: (extracted: { primary: string; secondary: string; tertiary: string }) => void
): HTMLImageElement {
  const img = new Image()
  img.crossOrigin = 'Anonymous'
  img.src = imgUrl

  img.onload = () => {
    try {
      const palette = getPaletteSync(img, { colorCount: 5 })
      if (palette && palette.length > 0) {
        onLoaded({
          primary: palette[0]?.hex() ?? '#111111',
          secondary: palette[1]?.hex() ?? palette[0]?.hex() ?? '#333333',
          tertiary: palette[2]?.hex() ?? palette[0]?.hex() ?? '#222222'
        })
      }
    } catch (e) {
      console.error('Error extracting palette from image:', e)
    }
  }

  return img
}
