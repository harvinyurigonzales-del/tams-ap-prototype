import { Star } from 'lucide-react'

/** Five stars filled to the rating, with the number written beside them so the value never relies on the icons. */
export function Stars({ value, size = 'sm', className = '' }: { value: number; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const px = { xs: 'size-3', sm: 'size-3.5', md: 'size-4', lg: 'size-5' }[size]
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`} aria-hidden>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, value - i))
        return (
          <span key={i} className={`relative inline-block ${px}`}>
            <Star className={`absolute inset-0 ${px} text-star/35`} strokeWidth={0} fill="currentColor" />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star className={`${px} text-star`} strokeWidth={0} fill="currentColor" />
              </span>
            )}
          </span>
        )
      })}
    </span>
  )
}

/** Compact rating: ★ 4.8 (23 reviews). */
export function RatingBadge({ avg, count, className = '', tone = 'default' }: { avg: number; count: number; className?: string; tone?: 'default' | 'inverse' }) {
  if (!count) return <span className={`text-[13px] ${tone === 'inverse' ? 'text-white/80' : 'text-ink-3'} ${className}`}>New, no reviews yet</span>
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] ${className}`}>
      <Stars value={avg} size="sm" />
      <span className={`font-semibold tnum ${tone === 'inverse' ? 'text-white' : 'text-ink'}`}>{avg.toFixed(1)}</span>
      <span className={tone === 'inverse' ? 'text-white/80' : 'text-ink-2'}>
        ({count}
        <span className="sr-only"> reviews, rated {avg.toFixed(1)} out of 5</span>)
      </span>
    </span>
  )
}
