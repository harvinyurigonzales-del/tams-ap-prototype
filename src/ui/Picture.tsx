import type { ImageRef } from '../seed/types'

/**
 * Destination or vehicle image with an honest source label: generated illustrations say so, and photos
 * from the team's design file are marked as representative.
 */
export function Picture({ image, className = '', label = true }: { image: ImageRef; className?: string; label?: boolean }) {
  return (
    <div className={`relative overflow-hidden bg-brand-100 ${className}`}>
      <img src={image.src} alt={image.alt} loading="lazy" decoding="async" className="size-full object-cover" />
      {label && (
        <span className="absolute right-2 bottom-2 rounded-md bg-black/45 px-1.5 py-0.5 text-[10px] font-medium text-white">
          {image.kind === 'illustration' ? 'Illustration' : 'Representative photo'}
        </span>
      )}
    </div>
  )
}
