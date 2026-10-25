import type { ImageRef } from './types'
import { PHOTO_DATA } from './photoData'

// Photos of real places and vehicles, mostly from Wikimedia Commons, resized into WebP by scripts/photos.py.
// A few were supplied by the team and still need their source confirmed. Credits travel with each image and are
// listed on the Photo credits page.

export function photoRef(slug: string, alt: string, kind: 'photo' | 'vehicle' = 'photo'): ImageRef | undefined {
  const p = PHOTO_DATA[slug]
  if (!p) return undefined
  const srcset = p.widths.map((w) => ({ w, src: `/images/photos/${slug}-${w}.webp` }))
  const mid = srcset.find((s) => s.w >= 960) ?? srcset[srcset.length - 1]
  return { src: mid.src, srcset, alt, kind: p.supplied && kind === 'photo' ? 'supplied' : kind, lqip: p.lqip, focus: p.focus, credit: p.credit }
}

/** Every bundled photo with its credit, for the Photo credits page. */
export const photoCredits = () => Object.entries(PHOTO_DATA).map(([slug, p]) => ({ slug, ...p.credit, thumb: `/images/photos/${slug}-${p.widths[0]}.webp` }))
