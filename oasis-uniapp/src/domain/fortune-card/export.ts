/**
 * The share card is painted on a detached bitmap.
 * A canvas left in the page at 1080×1440 CSS pixels gets its backing store
 * clamped to the phone viewport, so toDataURL comes back cropped.
 * Set the bitmap with the width and height properties only, and do not attach it.
 */

export const SHARE_BITMAP_WIDTH = 1080
export const SHARE_BITMAP_HEIGHT = 1440
export const EXPORT_CANVAS_ATTACHED = false

export interface ShareBitmap {
  width: number
  height: number
}

export function createShareBitmap<T extends ShareBitmap>(create: () => T): T {
  const canvas = create()
  canvas.width = SHARE_BITMAP_WIDTH
  canvas.height = SHARE_BITMAP_HEIGHT
  if (canvas.width !== SHARE_BITMAP_WIDTH || canvas.height !== SHARE_BITMAP_HEIGHT) {
    throw new Error('share bitmap was clamped')
  }
  return canvas
}
