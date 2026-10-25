import { ImageOff } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { ImageRef } from '../seed/types'

const LABEL_POS = { br: 'right-2 bottom-2', tr: 'right-2 top-2', tl: 'left-2 top-2', bl: 'left-2 bottom-2' } as const

/** `srcset` string for an image, or undefined for single-file images. */
export const srcSetOf = (image: ImageRef) => image.srcset?.map((s) => `${s.src} ${s.w}w`).join(', ')

/** The short source label shown on an image. Full credits are on the Photo credits page. */
export function imageLabel(image: ImageRef) {
  if (image.kind === 'illustration') return 'Illustration'
  if (image.kind === 'vehicle') return 'Representative vehicle photo'
  if (image.kind === 'photo' && image.credit) return `Photo: ${image.credit.author}`
  return 'Representative photo'
}

/**
 * Destination or vehicle image. Responsive sources pick a sharp file for the rendered size, a tiny blurred
 * preview fills the frame while it loads (no blank flash, no layout shift: the caller sets the aspect ratio),
 * and a quiet fallback replaces it if the file fails. Every image keeps an honest source label.
 */
export function Picture({
  image,
  className = '',
  imgClassName = '',
  label = true,
  labelAt = 'br',
  eager = false,
  sizes = '(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw',
}: {
  image: ImageRef
  className?: string
  imgClassName?: string
  label?: boolean
  labelAt?: keyof typeof LABEL_POS
  eager?: boolean
  sizes?: string
}) {
  const ref = useRef<HTMLImageElement>(null)
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>('loading')
  useEffect(() => {
    setState(ref.current?.complete && ref.current.naturalWidth ? 'ready' : 'loading')
  }, [image.src])

  // Callers that place the image themselves (a full-bleed hero) pass `absolute`; otherwise it anchors its label.
  const position = /\b(absolute|fixed)\b/.test(className) ? '' : 'relative'
  return (
    <div className={`${position} overflow-hidden bg-brand-100 ${className}`}>
      {image.lqip && state !== 'ready' && (
        <img src={image.lqip} alt="" aria-hidden className="absolute inset-0 size-full scale-110 object-cover blur-lg" style={{ objectPosition: image.focus }} />
      )}
      {state === 'failed' ? (
        <div className="absolute inset-0 grid place-items-center bg-gradient-to-br from-brand-600 to-brand-800 p-3 text-center text-white/85">
          <span className="flex flex-col items-center gap-1 text-xs">
            <ImageOff className="size-5" aria-hidden />
            <span className="sr-only">{image.alt}. </span>Photo unavailable
          </span>
        </div>
      ) : (
        <img
          ref={ref}
          src={image.src}
          srcSet={srcSetOf(image)}
          sizes={image.srcset ? sizes : undefined}
          alt={image.alt}
          loading={eager ? 'eager' : 'lazy'}
          fetchPriority={eager ? 'high' : undefined}
          decoding="async"
          onLoad={() => setState('ready')}
          onError={() => setState('failed')}
          style={{ objectPosition: image.focus }}
          className={`relative size-full object-cover transition-opacity duration-300 ${image.lqip && state !== 'ready' ? 'opacity-0' : 'opacity-100'} ${imgClassName}`}
        />
      )}
      {label && state !== 'failed' && (
        <span className={`absolute ${LABEL_POS[labelAt]} z-[1] max-w-[70%] truncate rounded-md bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white`}>
          {imageLabel(image)}
        </span>
      )}
    </div>
  )
}
