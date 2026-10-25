import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'

/**
 * Horizontal rail that loops in both directions. When the items overflow, the list is rendered three times and
 * the view quietly re-centres on the middle copy after each scroll, so crossing the end never shows a jump.
 * The extra copies are hidden from assistive tech and are `inert`, so keyboard users meet each card once.
 * Nothing moves on its own. When the items fit, they show as a plain row with no arrows.
 */
export function LoopCarousel<T>({
  items,
  itemKey,
  renderItem,
  label,
  itemClassName = 'w-[82%] sm:w-[46%] lg:w-[31.5%]',
}: {
  items: T[]
  itemKey: (item: T) => string
  renderItem: (item: T) => ReactNode
  label: string
  itemClassName?: string
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [loop, setLoop] = useState(false)
  const settle = useRef<number | undefined>(undefined)

  // Width of one full copy of the items, gaps included.
  const setWidth = useCallback(() => {
    const el = ref.current
    if (!el) return 0
    const kids = el.querySelectorAll<HTMLElement>('[data-loop-item]')
    if (!loop) return el.scrollWidth
    return kids[items.length].offsetLeft - kids[0].offsetLeft
  }, [loop, items.length])

  // Decide whether looping is needed: only when one copy is wider than the view.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const check = () => {
      const kids = el.querySelectorAll<HTMLElement>('[data-loop-item]')
      if (!kids.length) return
      const first = kids[0]
      const lastOfSet = kids[Math.min(kids.length, items.length) - 1]
      const one = lastOfSet.offsetLeft + lastOfSet.offsetWidth - first.offsetLeft
      setLoop(one > el.clientWidth + 8)
    }
    check()
    const ro = new ResizeObserver(check)
    ro.observe(el)
    return () => ro.disconnect()
  }, [items.length])

  // Start on the middle copy.
  useLayoutEffect(() => {
    const el = ref.current
    if (el && loop) el.scrollLeft = setWidth()
  }, [loop, setWidth])

  const recentre = useCallback(() => {
    const el = ref.current
    if (!el || !loop) return
    const w = setWidth()
    if (el.scrollLeft < w * 0.5) el.scrollLeft += w
    else if (el.scrollLeft > w * 1.5) el.scrollLeft -= w
  }, [loop, setWidth])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const onScroll = () => {
      window.clearTimeout(settle.current)
      settle.current = window.setTimeout(recentre, 140)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('scrollend', recentre)
    return () => {
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('scrollend', recentre)
      window.clearTimeout(settle.current)
    }
  }, [recentre])

  const step = (dir: 1 | -1) => {
    const el = ref.current
    if (!el) return
    const card = el.querySelector<HTMLElement>('[data-loop-item]')
    const gap = parseFloat(getComputedStyle(el).columnGap) || 16
    const per = card ? card.offsetWidth + gap : el.clientWidth
    const visible = Math.max(1, Math.floor((el.clientWidth + gap) / per))
    el.scrollBy({ left: dir * per * visible, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' })
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget) return
    if (e.key === 'ArrowRight') (e.preventDefault(), step(1))
    if (e.key === 'ArrowLeft') (e.preventDefault(), step(-1))
  }

  const copies = loop ? [0, 1, 2] : [1]
  const btn =
    'absolute top-1/2 z-10 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface/95 text-ink shadow-pop ring-1 ring-line backdrop-blur transition hover:bg-surface hover:text-brand-700 active:scale-95 md:size-11'

  return (
    <div className="relative">
      <div
        ref={ref}
        role="region"
        aria-roledescription="carousel"
        aria-label={label}
        tabIndex={loop ? 0 : undefined}
        onKeyDown={onKey}
        className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-4 pb-2 focus-visible:outline-offset-4 sm:-mx-6 sm:px-6 md:mx-0 md:px-0"
      >
        {copies.map((copy) =>
          items.map((item) => (
            <div
              key={`${copy}:${itemKey(item)}`}
              data-loop-item
              className={`shrink-0 snap-start ${itemClassName}`}
              aria-hidden={copy !== 1 || undefined}
              inert={copy !== 1}
            >
              {renderItem(item)}
            </div>
          )),
        )}
      </div>
      {loop && (
        <>
          <button type="button" onClick={() => step(-1)} aria-label={`Previous in ${label}`} className={`${btn} left-1 md:-left-5`}>
            <ChevronLeft className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => step(1)} aria-label={`Next in ${label}`} className={`${btn} right-1 md:-right-5`}>
            <ChevronRight className="size-5" aria-hidden />
          </button>
        </>
      )}
    </div>
  )
}
