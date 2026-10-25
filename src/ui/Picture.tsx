import type { ImageRef } from '../seed/types'

const LABEL_POS = { br: 'right-2 bottom-2', tr: 'right-2 top-2', tl: 'left-2 top-2', bl: 'left-2 bottom-2' } as const

/**
 * Destination or vehicle image with an honest source label: generated illustrations say so, and photos
 * from the team's design file are marked as representative.
 */
export function Picture({
  image,
  className = '',
  imgClassName = '',
  label = true,
  labelAt = 'br',
  eager = false,
}: {
  image: ImageRef
  className?: string
  imgClassName?: string
  label?: boolean
  labelAt?: keyof typeof LABEL_POS
  eager?: boolean
}) {
  // Callers that place the image themselves (a full-bleed hero) pass `absolute`; otherwise it anchors its label.
  const position = /\b(absolute|fixed)\b/.test(className) ? '' : 'relative'
  return (
    <div className={`${position} overflow-hidden bg-brand-100 ${className}`}>
      <img
        src={image.src}
        alt={image.alt}
        loading={eager ? 'eager' : 'lazy'}
        fetchPriority={eager ? 'high' : undefined}
        decoding="async"
        className={`size-full object-cover ${imgClassName}`}
      />
      {label && (
        <span className={`absolute ${LABEL_POS[labelAt]} z-[1] rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white`}>
          {image.kind === 'illustration' ? 'Illustration' : 'Representative photo'}
        </span>
      )}
    </div>
  )
}
