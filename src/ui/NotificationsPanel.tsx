import { Bell, Check, X } from 'lucide-react'
import { useEffect, useId, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { fmtStamp } from '../lib/format'
import type { AppNotification } from '../seed/types'

interface Props {
  /** This person's notifications, newest first. */
  items: AppNotification[]
  onRead: (id: string) => void
  onReadAll: () => void
  viewAllTo: string
  /** Bell button look: on a photo (light icon) or on a plain header. */
  tone?: 'light' | 'plain'
  /** How many recent items the panel lists. */
  limit?: number
  /** Theme class for the panel, which renders outside the page's own wrapper. */
  themeClass?: string
}

/**
 * The notification bell and its panel. On larger screens the panel is anchored under the bell; on phones it is a
 * bottom sheet. Opening it marks nothing as read: an item is read when it is opened or marked, or with "Mark all
 * as read". Escape closes it and returns focus to the bell, arrow keys move between items, and focus stays inside
 * while it is open.
 */
export function NotificationBell({ items, onRead, onReadAll, viewAllTo, tone = 'plain', limit = 6, themeClass = '' }: Props) {
  const [open, setOpen] = useState(false)
  const [anchor, setAnchor] = useState<{ top: number; right: number } | null>(null)
  const button = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const navigate = useNavigate()
  const unread = items.filter((n) => !n.read).length
  const recent = items.slice(0, limit)

  const close = (refocus = true) => {
    setOpen(false)
    if (refocus) requestAnimationFrame(() => button.current?.focus())
  }

  // The panel is rendered at the end of the page (so a sticky, blurred header cannot clip it) and placed under the bell.
  useEffect(() => {
    if (!open) return
    const place = () => {
      const r = button.current?.getBoundingClientRect()
      if (r) setAnchor({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) })
    }
    place()
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      window.removeEventListener('resize', place)
      window.removeEventListener('scroll', place, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => panel.current?.querySelector<HTMLElement>('[data-item], [data-focus-first]')?.focus())
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panel.current?.contains(t) && !button.current?.contains(t)) close(false)
    }
    // Escape closes the panel even when focus has wandered outside it.
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !panel.current?.contains(document.activeElement)) close()
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
      return
    }
    const nodes = [...(panel.current?.querySelectorAll<HTMLElement>('button, a[href]') ?? [])].filter((x) => !x.hasAttribute('disabled'))
    const itemsEls = [...(panel.current?.querySelectorAll<HTMLElement>('[data-item]') ?? [])]
    const i = itemsEls.indexOf(document.activeElement as HTMLElement)
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && itemsEls.length) {
      e.preventDefault()
      const next = i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : -1) + itemsEls.length) % itemsEls.length
      itemsEls[next].focus()
    }
    if (e.key === 'Home' && itemsEls.length) {
      e.preventDefault()
      itemsEls[0].focus()
    }
    if (e.key === 'End' && itemsEls.length) {
      e.preventDefault()
      itemsEls.at(-1)!.focus()
    }
    if (e.key === 'Tab' && nodes.length) {
      const first = nodes[0]
      const last = nodes.at(-1)!
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
  }

  const go = (n: AppNotification) => {
    onRead(n.id)
    setOpen(false)
    navigate(n.link ?? viewAllTo)
  }

  const iconTone = tone === 'light' ? 'text-white hover:bg-white/15' : 'text-ink-2 hover:bg-brand-50 hover:text-ink'

  return (
    <div className="relative">
      <button
        ref={button}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}
        className={`relative grid size-11 place-items-center rounded-full transition-colors ${iconTone}`}
      >
        <Bell className="size-5" aria-hidden />
        {unread > 0 && (
          <span className="absolute top-1 right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-sili px-1 text-[11px] leading-none font-bold text-white tnum ring-2 ring-surface" aria-hidden>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open &&
        createPortal(
        <div className={themeClass}>
          <button type="button" tabIndex={-1} aria-hidden className="fixed inset-0 z-[60] bg-brand-900/40 sm:hidden" onClick={() => close(false)} />
          <div
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onKeyDown={onKey}
            style={anchor ? ({ '--np-top': `${anchor.top}px`, '--np-right': `${anchor.right}px` } as React.CSSProperties) : undefined}
            className="sheet-in fixed inset-x-0 bottom-0 z-[61] flex max-h-[min(80dvh,560px)] flex-col overflow-hidden rounded-t-3xl bg-surface text-ink shadow-pop ring-1 ring-line pb-[env(safe-area-inset-bottom)] sm:inset-x-auto sm:top-[var(--np-top,64px)] sm:right-[var(--np-right,16px)] sm:bottom-auto sm:max-h-[min(70dvh,560px)] sm:w-[380px] sm:rounded-2xl sm:pb-0"
          >
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line sm:hidden" aria-hidden />
            <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
              <div>
                <h2 id={titleId} className="font-display text-base font-semibold text-charcoal">
                  Notifications
                </h2>
                <p className="text-xs text-ink-2">{unread ? `${unread} unread` : 'All caught up'}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={onReadAll}
                  disabled={!unread}
                  className="min-h-9 rounded-lg px-2.5 text-xs font-semibold text-brand-700 hover:bg-brand-50 disabled:text-ink-3 disabled:hover:bg-transparent"
                >
                  Mark all as read
                </button>
                <button type="button" data-focus-first={recent.length ? undefined : true} onClick={() => close()} className="grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-surface-muted" aria-label="Close notifications">
                  <X className="size-5" aria-hidden />
                </button>
              </div>
            </div>

            {recent.length === 0 ? (
              <div className="px-6 py-10 text-center">
                <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
                  <Bell className="size-6" aria-hidden />
                </span>
                <p className="mt-3 font-semibold text-ink">No notifications yet</p>
                <p className="mt-1 text-sm text-ink-2">Updates about bookings, payments, requests and messages show up here.</p>
              </div>
            ) : (
              <ul className="min-h-0 flex-1 divide-y divide-line overflow-y-auto overscroll-contain" aria-label="Recent notifications">
                {recent.map((n) => (
                  <li key={n.id} className={`flex items-start gap-1 pr-2 ${n.read ? '' : 'bg-brand-50/60'}`}>
                    <button type="button" data-item onClick={() => go(n)} className="flex min-w-0 flex-1 gap-3 px-4 py-3 text-left hover:bg-surface-muted focus-visible:bg-surface-muted">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent ring-1 ring-line-strong' : 'bg-sili'}`} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className={`block text-sm ${n.read ? 'font-medium text-ink-2' : 'font-semibold text-ink'}`}>
                          {n.title}
                          {!n.read && <span className="sr-only"> (unread)</span>}
                        </span>
                        <span className="line-clamp-2 block text-sm text-ink-2">{n.body}</span>
                        <span className="mt-0.5 block text-xs text-ink-3">{fmtStamp(n.at)}</span>
                      </span>
                    </button>
                    {!n.read && (
                      <button
                        type="button"
                        onClick={() => onRead(n.id)}
                        className="mt-2 grid size-9 shrink-0 place-items-center rounded-lg text-ink-3 hover:bg-surface-muted hover:text-ink"
                        aria-label={`Mark “${n.title}” as read`}
                        title="Mark as read"
                      >
                        <Check className="size-4" aria-hidden />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            <div className="border-t border-line p-2">
              <Link to={viewAllTo} onClick={() => setOpen(false)} className="flex min-h-11 items-center justify-center rounded-xl text-sm font-semibold text-brand-700 hover:bg-brand-50">
                View all notifications
              </Link>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
