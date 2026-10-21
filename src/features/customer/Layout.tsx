import { Bell, ChevronDown, Compass, Heart, Home, MessageCircle, Ticket, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAssistant } from '../../state/assistant'
import { useCustomer, useMe } from '../../state/customerStore'
import { BrandMark } from '../../ui/BrandMark'
import { DemoBanner } from '../../ui/DemoBanner'
import { AssistantLauncher } from './Assistant'

const DESKTOP_NAV = [
  { to: '/app', label: 'Home', end: true },
  { to: '/app/tours', label: 'Explore Tours' },
  { to: '/app/destinations', label: 'Destinations' },
  { to: '/app/rental', label: 'Van Rental' },
  { to: '/app/trips', label: 'My Trips' },
]

/** Paths that belong to the Explore tab on mobile. */
const EXPLORE_PATHS = ['/app/explore', '/app/tours', '/app/destinations', '/app/rental', '/app/custom/new', '/app/book']

export function Shell() {
  const { customerId, data } = useCustomer()
  const { pathname } = useLocation()
  const closeAssistant = useAssistant((s) => s.close)
  const clearContext = useAssistant((s) => s.clearContext)
  const unread = customerId ? data.notifications.filter((n) => n.customerId === customerId && !n.read).length : 0
  const replies = customerId ? data.inquiries.filter((q) => q.customerId === customerId && q.status === 'Staff replied').length : 0

  // The assistant's "asking about" context belongs to the page it was opened from.
  useEffect(() => {
    clearContext()
  }, [pathname, clearContext])
  useEffect(() => {
    closeAssistant()
  }, [customerId, closeAssistant])

  const exploreActive = EXPLORE_PATHS.some((p) => pathname.startsWith(p))
  const tabs = [
    { to: '/app', label: 'Home', icon: Home, active: pathname === '/app' || pathname === '/app/' },
    { to: '/app/explore', label: 'Explore', icon: Compass, active: exploreActive },
    { to: '/app/trips', label: 'My Trips', icon: Ticket, active: pathname.startsWith('/app/trips') || pathname.startsWith('/app/custom/CR') || pathname.startsWith('/app/rentals') },
    { to: '/app/account', label: 'Account', icon: UserRound, active: ['/app/account', '/app/preferences', '/app/saved', '/app/messages', '/app/notifications'].some((p) => pathname.startsWith(p)) },
  ]

  return (
    <div className="min-h-dvh pb-[calc(env(safe-area-inset-bottom)+140px)] md:pb-24">
      <DemoBanner side="Customer demo" />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-4 px-4 sm:px-5">
          <Link to="/app" aria-label="TAMS AP home">
            <BrandMark />
          </Link>
          <nav className="ml-2 hidden gap-0.5 lg:flex" aria-label="Main">
            {DESKTOP_NAV.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `rounded-xl px-3 py-2 text-sm font-semibold whitespace-nowrap ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:text-ink'}`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-1">
            <IconLink to="/app/saved" label="Saved" icon={<Heart className="size-5" />} />
            <IconLink to="/app/messages" label={`Messages${replies ? `, ${replies} new replies` : ''}`} icon={<MessageCircle className="size-5" />} count={replies} />
            <IconLink to="/app/notifications" label={`Notifications${unread ? `, ${unread} unread` : ''}`} icon={<Bell className="size-5" />} count={unread} />
            {customerId ? (
              <AccountMenu />
            ) : (
              <Link to={`/app/login?next=${encodeURIComponent(pathname)}`} className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                Log in
              </Link>
            )}
          </div>
        </div>
        {/* Tablet: the five destinations still fit as a second row. */}
        <nav className="mx-auto hidden max-w-[1120px] gap-1 overflow-x-auto px-4 pb-2 md:flex lg:hidden" aria-label="Main">
          {DESKTOP_NAV.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `rounded-xl px-3 py-1.5 text-sm font-semibold whitespace-nowrap ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2'}`}
            >
              {t.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="mx-auto max-w-[1120px] px-4 py-5 sm:px-5 md:py-8">
        <Outlet />
      </main>
      <AssistantLauncher />
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-4">
          {tabs.map((t) => (
            <Link
              key={t.to}
              to={t.to}
              aria-current={t.active ? 'page' : undefined}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${t.active ? 'text-brand-600' : 'text-ink-3'}`}
            >
              <t.icon className="size-5" aria-hidden />
              {t.label}
            </Link>
          ))}
        </div>
      </nav>
    </div>
  )
}

function IconLink({ to, label, icon, count = 0, className = '' }: { to: string; label: string; icon: React.ReactNode; count?: number; className?: string }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      title={label.split(',')[0]}
      className={({ isActive }) => `relative inline-flex rounded-xl p-2 ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-brand-50'} ${className}`}
    >
      {icon}
      {count > 0 && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{count}</span>}
    </NavLink>
  )
}

function AccountMenu() {
  const me = useMe()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { pathname } = useLocation()
  useEffect(() => {
    setOpen(false)
  }, [pathname])
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  if (!me) return null
  const items = [
    { to: '/app/account', label: 'Account' },
    { to: '/app/preferences', label: 'Travel preferences' },
    { to: '/app/saved', label: 'Saved' },
    { to: '/app/messages', label: 'Messages' },
    { to: '/', label: 'Demo start' },
  ]
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className="ml-1 inline-flex items-center gap-1.5 rounded-xl py-1.5 pr-2 pl-1.5 text-sm font-semibold text-ink hover:bg-brand-50"
      >
        <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white" aria-hidden>
          {me.name.charAt(0)}
        </span>
        <span className="sr-only">Account menu for </span>
        {me.name.split(' ')[0]}
        <ChevronDown className="size-4 text-ink-3" aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-surface py-2 shadow-pop">
          <p className="px-4 pb-2 text-xs text-ink-2">
            Signed in as <span className="font-semibold text-ink">{me.email}</span>
          </p>
          <ul>
            {items.map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="block px-4 py-2 text-sm text-ink hover:bg-brand-50">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
