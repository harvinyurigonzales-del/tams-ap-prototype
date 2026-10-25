import { Bell, Bot, CalendarDays, ChevronDown, CarFront, ClipboardList, CreditCard, Inbox, LayoutDashboard, Lock, LogOut, Map as MapIcon, Menu, MessageSquare, PieChart, Settings as SettingsIcon, ShieldCheck, Star, UserRound, Users, Wrench, X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { NotFound } from '../../app/NotFound'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate } from '../../lib/format'
import { needsReply } from '../../domain/reviews'
import { staffNotifications, useAdmin, useIsAdmin, useMe } from '../../state/adminStore'
import { NotificationBell } from '../../ui/NotificationsPanel'
import { LinkButton } from '../../ui/Button'
import { Card } from '../../ui/Card'
import type { Dataset } from '../../seed/types'
import { BrandMark } from '../../ui/BrandMark'
import { ConfirmDialog } from '../../ui/Dialog'
import { Login } from '../customer/Auth'
import { useWorkspace } from '../../state/auth'
import { Bookings } from './Bookings'
import { Calendar } from './Calendar'
import { Customers } from './Customers'
import { Dashboard } from './Dashboard'
import { Drivers, Vehicles } from './Fleet'
import { Maintenance, overdueCount } from './Maintenance'
import { Packages } from './Packages'
import { StaffAccounts } from './Staff'
import { ManageChatbot } from './Chatbot'
import { AdminInquiries } from './Inquiries'
import { AdminNotifications } from './Notifications'
import { Payments } from './Payments'
import { Reports } from './Reports'
import { AdminRequests } from './Requests'
import { AdminReviews } from './Reviews'
import { justSignedOut } from '../../state/persist'
import { Settings } from './Settings'

export function AdminRoutes() {
  return (
    <Routes>
      <Route
        path="login"
        element={
          <div className="theme-tara min-h-dvh">
            <Login />
          </div>
        }
      />
      <Route element={<RequireAdmin />}>
        <Route element={<Shell />}>
          <Route index element={<Dashboard />} />
          <Route path="dashboard" element={<Navigate to="/admin" replace />} />
          <Route path="bookings" element={<Bookings />} />
          <Route path="payments" element={<Payments />} />
          <Route path="requests" element={<AdminRequests />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="customers" element={<Customers />} />
          <Route path="reports" element={<AdminOnly title="Reports"><Reports /></AdminOnly>} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="inquiries" element={<AdminInquiries />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="maintenance" element={<Maintenance />} />
          <Route path="packages" element={<AdminOnly title="Tour packages"><Packages /></AdminOnly>} />
          <Route path="staff" element={<AdminOnly title="Staff accounts"><StaffAccounts /></AdminOnly>} />
          <Route path="chatbot" element={<AdminOnly title="Manage chatbot"><ManageChatbot /></AdminOnly>} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound home="/admin" homeLabel="Back to dashboard" />} />
        </Route>
      </Route>
    </Routes>
  )
}

/** Admin-only module. Staff who open its link directly see why it is locked instead of the page. */
function AdminOnly({ title, children }: { title: string; children: React.ReactNode }) {
  const admin = useIsAdmin()
  if (admin) return <>{children}</>
  return (
    <div className="mx-auto max-w-md pt-6">
      <Card className="p-6 text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-brand-50 text-brand-700">
          <Lock className="size-6" aria-hidden />
        </span>
        <h1 className="mt-3 font-display text-xl font-bold text-charcoal">Admin only</h1>
        <p className="mt-1 text-sm text-ink-2">{title} is available to admin accounts. Ask an admin if you need something changed here.</p>
        <LinkButton to="/admin" className="mt-5">
          Back to dashboard
        </LinkButton>
      </Card>
    </div>
  )
}

/** Staff portal guard: customers go back to the customer site, guests log in first. Real access control belongs on a server. */
function RequireAdmin() {
  const workspace = useWorkspace()
  const loc = useLocation()
  if (workspace === 'customer') return <Navigate to="/app" replace />
  if (!workspace) return <Navigate to={justSignedOut() ? '/admin/login' : `/admin/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <Outlet />
}

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; count?: (d: Dataset) => number; adminOnly?: boolean }

// Grouped by the job staff are doing, with a count only where something is waiting on them.
const GROUPS: { title: string; items: NavItem[] }[] = [
  {
    title: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/notifications', label: 'Notifications', icon: Bell, count: (d) => staffNotifications(d).filter((n) => !n.read).length },
    ],
  },
  {
    title: 'Bookings and requests',
    items: [
      { to: '/admin/bookings', label: 'Bookings', icon: ClipboardList },
      { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
      { to: '/admin/requests', label: 'Requests', icon: Inbox, count: (d) => [...d.customRequests, ...d.rentalRequests].filter((r) => r.status === 'Submitted').length },
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare, count: (d) => d.inquiries.filter((i) => i.status === 'Awaiting staff').length },
      { to: '/admin/reviews', label: 'Reviews', icon: Star, count: (d) => d.reviews.filter(needsReply).length },
    ],
  },
  {
    title: 'Fleet and operations',
    items: [
      { to: '/admin/vehicles', label: 'Vehicles', icon: CarFront },
      { to: '/admin/drivers', label: 'Drivers', icon: UserRound },
      { to: '/admin/maintenance', label: 'Maintenance', icon: Wrench },
      { to: '/admin/packages', label: 'Tour packages', icon: MapIcon, adminOnly: true },
    ],
  },
  {
    title: 'Finance and reports',
    items: [
      { to: '/admin/payments', label: 'Payments', icon: CreditCard, count: (d) => d.payments.filter((p) => p.status === 'Submitted').length },
      { to: '/admin/reports', label: 'Reports', icon: PieChart, adminOnly: true },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/admin/staff', label: 'Staff accounts', icon: ShieldCheck, adminOnly: true },
      { to: '/admin/chatbot', label: 'Manage chatbot', icon: Bot, adminOnly: true },
      { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
]

const isActive = (n: NavItem, pathname: string) => (n.end ? pathname === n.to || pathname === `${n.to}/` : pathname.startsWith(n.to))

function Shell() {
  const [drawer, setDrawer] = useState(false)
  const [out, setOut] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data, logout, maintenance, markRead, markAllRead } = useAdmin()
  const me = useMe()
  const admin = me?.role === 'Admin'
  const notes = useMemo(() => staffNotifications(data).sort((a, b) => b.at.localeCompare(a.at)), [data])
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((n) => admin || !n.adminOnly) })).filter((g) => g.items.length)
  const activeGroup = groups.find((g) => g.items.some((n) => isActive(n, pathname)))?.title
  // Groups the person opened or closed by hand; the group of the page being shown is always open.
  const [toggled, setToggled] = useState<Record<string, boolean>>({})
  const isOpen = (title: string) => title === activeGroup || (toggled[title] ?? false)
  useEffect(() => {
    setDrawer(false)
  }, [pathname])

  const countOf = (n: NavItem) => (n.to === '/admin/maintenance' ? overdueCount(maintenance) : (n.count?.(data) ?? 0))

  const link = (n: NavItem) => {
    const count = countOf(n)
    return (
      <NavLink
        key={n.to}
        to={n.to}
        end={n.end}
        className={({ isActive }) =>
          `group relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/6 hover:text-white'}`
        }
      >
        {({ isActive }) => (
          <>
            {isActive && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-full bg-sili" aria-hidden />}
            <n.icon className="size-[18px]" aria-hidden />
            <span className="flex-1">{n.label}</span>
            {count > 0 && (
              <span className="min-w-5 rounded-full bg-white/15 px-1.5 text-center text-[11px] font-bold text-white tnum">
                {count}
                <span className="sr-only"> waiting</span>
              </span>
            )}
          </>
        )}
      </NavLink>
    )
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between px-5 pt-5 pb-4">
        <Link to="/admin" aria-label="Dashboard">
          <BrandMark inverse className="h-10" />
        </Link>
        <button className="grid size-10 place-items-center rounded-lg text-white/80 hover:bg-white/10 lg:hidden" onClick={() => setDrawer(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      {/* Scrolls when the window is short; the scrollbar itself is hidden. */}
      <nav aria-label="Admin" className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3">
        {groups.map((g) => {
          const open = isOpen(g.title)
          const waiting = g.items.reduce((n, i) => n + countOf(i), 0)
          const id = `nav-${g.title.replace(/\W+/g, '-').toLowerCase()}`
          return (
            <div key={g.title} className="mt-1 first:mt-0">
              <button
                type="button"
                onClick={() => setToggled((t) => ({ ...t, [g.title]: !open }))}
                aria-expanded={open}
                aria-controls={id}
                disabled={g.title === activeGroup}
                className="flex min-h-9 w-full items-center gap-2 rounded-lg px-3 text-left text-[11px] font-semibold tracking-[0.06em] whitespace-nowrap text-white/55 uppercase hover:text-white/85 disabled:cursor-default disabled:hover:text-white/55"
              >
                <span className="min-w-0 flex-1 truncate">{g.title}</span>
                {!open && waiting > 0 && (
                  <span className="rounded-full bg-sili px-1.5 text-[10px] font-bold tracking-normal text-white tnum">
                    {waiting}
                    <span className="sr-only"> waiting</span>
                  </span>
                )}
                <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''} ${g.title === activeGroup ? 'opacity-0' : ''}`} aria-hidden />
              </button>
              {open && (
                <div id={id} className="flex flex-col gap-0.5 pb-1">
                  {g.items.map(link)}
                </div>
              )}
            </div>
          )
        })}
      </nav>
      <div className="shrink-0 border-t border-white/10 p-3">
        <button onClick={() => setOut(true)} className="flex min-h-10 w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/6 hover:text-white">
          <LogOut className="size-[18px]" aria-hidden /> Log out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh">
      <div className="lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="sticky top-0 hidden h-dvh bg-navy lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <button className="absolute inset-0 bg-brand-900/40" aria-label="Close menu" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-navy shadow-pop">{sidebar}</aside>
          </div>
        )}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
            <button className="grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-brand-50 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <BrandMark compact className="h-8 lg:hidden" />
            <p className="hidden text-sm text-ink-2 sm:block">{fmtDate(DEMO_TODAY, { weekday: true, year: true })}</p>
            <div className="ml-auto flex items-center gap-2">
              <NotificationBell items={notes} onRead={markRead} onReadAll={markAllRead} viewAllTo="/admin/notifications" />
              <span className="mx-1 h-6 w-px bg-line" aria-hidden />
              <Link to="/admin/settings?tab=account" className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-brand-50" aria-label={`Account settings, ${me?.name ?? ''} (${me?.role ?? ''})`}>
                <span className="grid size-9 place-items-center rounded-full bg-navy font-display text-sm font-bold text-white" aria-hidden>
                  {initials(me?.name ?? '')}
                </span>
                <span className="hidden text-sm leading-tight sm:block" aria-hidden>
                  <span className="block font-semibold text-ink">{me?.name}</span>
                  <span className="block text-xs text-ink-2">{me?.role}</span>
                </span>
              </Link>
            </div>
          </header>
          <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <div key={pathname} className="page-in">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <ConfirmDialog
        open={out}
        onClose={() => setOut(false)}
        title="Log out?"
        body="You can log back in with your work email and password."
        confirmLabel="Log out"
        onConfirm={() => {
          navigate('/admin/login', { replace: true })
          logout()
        }}
      />
    </div>
  )
}

export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')

/** Page heading used on every admin screen. */
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-[26px] leading-tight font-bold text-charcoal">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
