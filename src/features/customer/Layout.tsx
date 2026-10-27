import { Bus, ChevronDown, Compass, Heart, Home, LogOut, Menu, MessageCircle, MessageCircleQuestion, Star, Ticket, UserRound } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAssistant } from '../../state/assistant'
import { useCustomer, useMe } from '../../state/customerStore'
import { BrandMark } from '../../ui/BrandMark'
import { ConfirmDialog, Dialog } from '../../ui/Dialog'
import { NotificationBell } from '../../ui/NotificationsPanel'
import { AssistantMount, routeContext } from './Assistant'

/** Paths that belong to the Explore tab on mobile. */
const EXPLORE_PATHS = ['/app/explore', '/app/tours', '/app/destinations', '/app/rental', '/app/custom/new', '/app/custom/form', '/app/book']
/** On desktop, van rental has its own tab, so Explore covers tours and destinations. */
const DESKTOP_EXPLORE = ['/app/explore', '/app/tours', '/app/destinations', '/app/book']

/** Booking, payment and request steps: the bottom navigation steps aside so the step's own actions have the room. */
const STEP_PATHS = [/^\/app\/book\//, /^\/app\/booked\//, /^\/app\/trips\/[^/]+\/pay/, /^\/app\/tours\/[^/]+\/dates/, /^\/app\/custom\/(new|form)/, /^\/app\/rental\/request/]

/** True while a text field has focus on a phone, when the on-screen keyboard is likely open. */
function useTyping() {
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const isField = (el: EventTarget | null) => el instanceof HTMLElement && (el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select') || el.isContentEditable)
    const on = (e: FocusEvent) => isField(e.target) && setTyping(true)
    const off = () => requestAnimationFrame(() => setTyping(isField(document.activeElement)))
    document.addEventListener('focusin', on)
    document.addEventListener('focusout', off)
    return () => {
      document.removeEventListener('focusin', on)
      document.removeEventListener('focusout', off)
    }
  }, [])
  return typing
}

export function Shell() {
  const { customerId, data, markRead, markAllRead } = useCustomer()
  const { pathname } = useLocation()
  const assistantOpen = useAssistant((s) => s.open)
  const closeAssistant = useAssistant((s) => s.close)
  const openAssistant = useAssistant((s) => s.openWith)
  const clearContext = useAssistant((s) => s.clearContext)
  const typing = useTyping()
  // Newest first, in the order they arrived (new notices are added to the front).
  const mine = customerId ? data.notifications.filter((n) => n.customerId === customerId) : []
  const replies = customerId ? data.inquiries.filter((q) => q.customerId === customerId && q.status === 'Staff replied').length : 0

  // The assistant's "asking about" context belongs to the page it was opened from.
  useEffect(() => {
    clearContext()
  }, [pathname, clearContext])
  useEffect(() => {
    closeAssistant()
  }, [customerId, closeAssistant])

  const exploreActive = EXPLORE_PATHS.some((p) => pathname.startsWith(p))
  const home = pathname === '/app' || pathname === '/app/'
  const tripsActive = pathname.startsWith('/app/trips') || pathname.startsWith('/app/custom/CR') || pathname.startsWith('/app/rentals')
  const step = STEP_PATHS.some((r) => r.test(pathname))
  const showTabs = !step && !typing
  const desktopNav = [
    { to: '/app', label: 'Home', active: home },
    { to: '/app/explore', label: 'Explore', active: DESKTOP_EXPLORE.some((p) => pathname.startsWith(p)) },
    { to: '/app/rental', label: 'Van Rental', active: pathname.startsWith('/app/rental') },
    { to: '/app/reviews', label: 'Reviews', active: pathname.startsWith('/app/reviews') },
    { to: '/app/trips', label: 'My Trips', active: tripsActive },
  ]
  const tabs = [
    { to: '/app', label: 'Home', icon: Home, active: home },
    { to: '/app/explore', label: 'Explore', icon: Compass, active: exploreActive },
    { to: '/app/trips', label: 'My Trips', icon: Ticket, active: tripsActive },
    { to: '/app/account', label: 'Profile', icon: UserRound, active: ['/app/account', '/app/preferences'].some((p) => pathname.startsWith(p)) },
  ]

  // On Home the header sits over the hero photograph; everywhere else it is a calm ivory bar.
  const tone = home ? 'overlay' : 'solid'
  const navCls = (active: boolean) =>
    home
      ? `rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${active ? 'bg-white/18 text-white' : 'text-white/85 hover:text-white'}`
      : `rounded-full px-3.5 py-2 text-sm font-semibold whitespace-nowrap transition-colors ${active ? 'bg-brand-600 text-white' : 'text-ink-2 hover:text-ink'}`

  const tab = (t: (typeof tabs)[number]) => (
    <Link
      key={t.to}
      to={t.to}
      aria-current={t.active ? 'page' : undefined}
      className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-colors ${t.active ? 'text-brand-700' : 'text-ink-3 hover:text-ink'}`}
    >
      <t.icon className={`size-5 ${t.active ? 'stroke-[2.4]' : ''}`} aria-hidden />
      {t.label}
    </Link>
  )

  return (
    <div className={`theme-tara min-h-dvh ${showTabs ? 'pb-[calc(env(safe-area-inset-bottom)+96px)]' : 'pb-[calc(env(safe-area-inset-bottom)+24px)]'} md:pb-24`}>
      <div className="relative">
        <header className={home ? 'absolute inset-x-0 top-0 z-30' : 'sticky top-0 z-30 border-b border-line bg-ivory/95 backdrop-blur'}>
          <div className={`mx-auto flex items-center gap-4 px-4 sm:px-6 ${home ? 'h-20 max-w-[1280px]' : 'h-16 max-w-[1180px]'}`}>
            <Link to="/app" aria-label="TAMS AP home" className="shrink-0 rounded-xl">
              <BrandMark inverse={home} className="h-8 min-[380px]:h-9 sm:h-11" />
            </Link>
            <nav className="ml-4 hidden gap-1 lg:flex" aria-label="Main">
              {desktopNav.map((t) => (
                <Link key={t.to} to={t.to} aria-current={t.active ? 'page' : undefined} className={navCls(t.active)}>
                  {t.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto flex items-center gap-0.5 sm:gap-1">
              <span className="hidden items-center gap-0.5 sm:gap-1 md:flex">
                <IconLink tone={tone} to="/app/saved" label="Saved" icon={<Heart className="size-5" />} />
                <IconLink tone={tone} to="/app/messages" label={`Messages${replies ? `, ${replies} new replies` : ''}`} icon={<MessageCircle className="size-5" />} count={replies} />
              </span>
              {customerId && <NotificationBell items={mine} onRead={markRead} onReadAll={markAllRead} viewAllTo="/app/notifications" tone={home ? 'light' : 'plain'} themeClass="theme-tara" />}
              <MoreMenu tone={tone} replies={replies} />
              {customerId ? (
                <AccountMenu tone={tone} />
              ) : (
                <Link
                  to="/app/login"
                  className={`ml-1 shrink-0 rounded-full px-3.5 py-2 text-sm sm:px-4 font-semibold whitespace-nowrap ${home ? 'bg-white text-charcoal hover:bg-ivory' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
                >
                  Log in
                </Link>
              )}
            </div>
          </div>
          {/* Tablet: the main tabs still fit as a second row. */}
          <nav className={`mx-auto hidden gap-1 overflow-x-auto px-4 pb-2 sm:px-6 md:flex lg:hidden ${home ? 'max-w-[1280px]' : 'max-w-[1180px]'}`} aria-label="Main">
            {desktopNav.map((t) => (
              <Link key={t.to} to={t.to} aria-current={t.active ? 'page' : undefined} className={navCls(t.active)}>
                {t.label}
              </Link>
            ))}
          </nav>
        </header>
        <main className={home ? '' : 'mx-auto max-w-[1180px] px-4 py-6 sm:px-6 md:py-10'}>
          {/* A short fade on each new page; same-page changes (filters, tabs) keep their own place. */}
          <div key={pathname} className="page-in">
            <Outlet />
          </div>
        </main>
        <footer className="mx-auto max-w-[1180px] px-4 pt-2 pb-8 text-xs text-ink-3 sm:px-6">
          <p className="border-t border-line pt-4">
            TAMS AP Travel and Tours. Photos are mostly from Wikimedia Commons, credited on the{' '}
            <Link to="/app/credits" className="font-semibold text-ink-2 underline underline-offset-2 hover:text-ink">
              Photo credits
            </Link>{' '}
            page.
          </p>
        </footer>
      </div>
      <AssistantMount />
      {showTabs && !assistantOpen && (
        <nav
          aria-label="Main"
          className="fixed inset-x-3 bottom-[calc(10px+env(safe-area-inset-bottom))] z-30 mx-auto max-w-[460px] rounded-full border border-line bg-surface/95 px-2 shadow-[0_14px_36px_-14px_rgba(14,29,61,0.45)] backdrop-blur md:hidden"
        >
          <div className="flex items-center">
            {tabs.slice(0, 2).map(tab)}
            <div className="flex flex-1 justify-center">
              <button
                type="button"
                onClick={() => openAssistant(routeContext(pathname))}
                aria-haspopup="dialog"
                aria-expanded={assistantOpen}
                className="-mt-6 flex size-[60px] flex-col items-center justify-center rounded-full bg-navy text-white shadow-[0_10px_24px_-8px_rgba(14,29,61,0.7)] ring-4 ring-ivory transition-transform active:scale-95"
              >
                <MessageCircleQuestion className="size-6" aria-hidden />
                <span className="text-[10px] leading-tight font-semibold">Ask TAMS</span>
              </button>
            </div>
            {tabs.slice(2).map(tab)}
          </div>
        </nav>
      )}
    </div>
  )
}

/** Pages that are not main tabs on phones: van rental, reviews, saved trips, messages and photo credits. */
function MoreMenu({ tone, replies }: { tone: Tone; replies: number }) {
  const [open, setOpen] = useState(false)
  const { pathname } = useLocation()
  useEffect(() => setOpen(false), [pathname])
  const items = [
    { to: '/app/rental', label: 'Van Rental', icon: Bus },
    { to: '/app/reviews', label: 'Reviews', icon: Star },
    { to: '/app/saved', label: 'Saved', icon: Heart },
    { to: '/app/messages', label: replies ? `Messages (${replies} new)` : 'Messages', icon: MessageCircle },
  ]
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-label="More pages"
        className={`relative grid size-11 place-items-center rounded-full ${tone === 'overlay' ? 'text-white hover:bg-white/15' : 'text-ink-2 hover:bg-sand'}`}
      >
        <Menu className="size-5" aria-hidden />
        {replies > 0 && <span className="absolute top-2 right-2 size-2 rounded-full bg-sili ring-2 ring-surface" aria-hidden />}
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title="More">
        <ul className="-mx-2 grid gap-1">
          {items.map((i) => (
            <li key={i.to}>
              <Link to={i.to} onClick={() => setOpen(false)} className="flex min-h-12 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold text-ink hover:bg-sand">
                <i.icon className="size-5 text-brand-700" aria-hidden /> {i.label}
              </Link>
            </li>
          ))}
        </ul>
      </Dialog>
    </div>
  )
}

type Tone = 'overlay' | 'solid'

function IconLink({ to, label, icon, count = 0, tone }: { to: string; label: string; icon: React.ReactNode; count?: number; tone: Tone }) {
  return (
    <NavLink
      to={to}
      aria-label={label}
      title={label.split(',')[0]}
      className={({ isActive }) =>
        `relative inline-flex rounded-full p-2 transition-colors sm:p-2.5 ${
          tone === 'overlay' ? 'text-white hover:bg-white/15' : isActive ? 'bg-sand text-brand-700' : 'text-ink-2 hover:bg-sand'
        }`
      }
    >
      {icon}
      {count > 0 && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-sili text-[10px] font-bold text-white">{count}</span>}
    </NavLink>
  )
}

function AccountMenu({ tone }: { tone: Tone }) {
  const me = useMe()
  const logout = useCustomer((s) => s.logout)
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [out, setOut] = useState(false)
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
  // Saved, Messages and Notifications already have their own buttons in the header, so they are not repeated here.
  const items = [
    { to: '/app/account', label: 'Account' },
    { to: '/app/preferences', label: 'Travel preferences' },
  ]
  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`ml-1 inline-flex items-center gap-1.5 rounded-full py-1.5 pr-2.5 pl-1.5 text-sm font-semibold ${tone === 'overlay' ? 'text-white hover:bg-white/15' : 'text-ink hover:bg-sand'}`}
      >
        <span className="grid size-7 place-items-center rounded-full bg-sili text-xs font-bold text-white" aria-hidden>
          {me.name.charAt(0)}
        </span>
        <span className="sr-only">Account menu for </span>
        {me.name.split(' ')[0]}
        <ChevronDown className={`size-4 ${tone === 'overlay' ? 'text-white/80' : 'text-ink-3'}`} aria-hidden />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-line bg-surface py-2 shadow-pop">
          <p className="px-4 pb-2 text-xs text-ink-2">
            Signed in as <span className="font-semibold text-ink">{me.email}</span>
          </p>
          <ul>
            {items.map((i) => (
              <li key={i.to}>
                <Link to={i.to} className="block px-4 py-2 text-sm text-ink hover:bg-sand">
                  {i.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-1 border-t border-line pt-1">
            <button
              onClick={() => {
                setOpen(false)
                setOut(true)
              }}
              className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-semibold text-sili hover:bg-sand"
            >
              <LogOut className="size-4" aria-hidden /> Log out
            </button>
          </div>
        </div>
      )}
      <ConfirmDialog
        open={out}
        onClose={() => setOut(false)}
        title="Log out?"
        body="You can log back in any time to see your trips."
        confirmLabel="Log out"
        onConfirm={() => {
          logout()
          navigate('/app', { replace: true })
        }}
      />
    </div>
  )
}
