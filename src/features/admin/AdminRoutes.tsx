import { Bell, CalendarDays, CarFront, ClipboardList, CreditCard, Inbox, LayoutDashboard, LogOut, Menu, MessageSquare, PieChart, Settings as SettingsIcon, Star, UserRound, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { NotFound } from '../../app/NotFound'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate } from '../../lib/format'
import { needsReply } from '../../domain/reviews'
import { useAdmin } from '../../state/adminStore'
import type { Dataset } from '../../seed/types'
import { BrandMark } from '../../ui/BrandMark'
import { ConfirmDialog } from '../../ui/Dialog'
import { AdminLogin } from './AdminLogin'
import { Bookings } from './Bookings'
import { Calendar } from './Calendar'
import { Customers } from './Customers'
import { Dashboard } from './Dashboard'
import { Drivers, Vehicles } from './Fleet'
import { AdminInquiries } from './Inquiries'
import { AdminNotifications } from './Notifications'
import { Payments } from './Payments'
import { Reports } from './Reports'
import { AdminRequests } from './Requests'
import { AdminReviews } from './Reviews'
import { Settings } from './Settings'

export function AdminRoutes() {
  return (
    <Routes>
      <Route
        path="login"
        element={
          <div className="min-h-dvh">
            <AdminLogin />
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
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="inquiries" element={<AdminInquiries />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="reviews" element={<AdminReviews />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound home="/admin" homeLabel="Back to dashboard" />} />
        </Route>
      </Route>
    </Routes>
  )
}

/** Client-side guard that demonstrates the intended behaviour. It is not security. */
function RequireAdmin() {
  const loggedIn = useAdmin((s) => s.loggedIn)
  const loc = useLocation()
  if (!loggedIn) return <Navigate to={`/admin/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace state={{ guarded: true }} />
  return <Outlet />
}

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; end?: boolean; count?: (d: Dataset) => number }

// Grouped by the job staff are doing, with a count only where something is waiting on them.
const GROUPS: { title?: string; items: NavItem[] }[] = [
  {
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/bookings', label: 'Bookings', icon: ClipboardList },
      { to: '/admin/payments', label: 'Payments', icon: CreditCard, count: (d) => d.payments.filter((p) => p.status === 'Submitted').length },
      { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
    ],
  },
  {
    title: 'Customers',
    items: [
      { to: '/admin/customers', label: 'Customers', icon: Users },
      { to: '/admin/requests', label: 'Requests', icon: Inbox, count: (d) => [...d.customRequests, ...d.rentalRequests].filter((r) => r.status === 'Submitted').length },
      { to: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare, count: (d) => d.inquiries.filter((i) => i.status === 'Awaiting staff').length },
      { to: '/admin/reviews', label: 'Reviews', icon: Star, count: (d) => d.reviews.filter(needsReply).length },
    ],
  },
  {
    title: 'Business',
    items: [
      { to: '/admin/reports', label: 'Reports', icon: PieChart },
      { to: '/admin/vehicles', label: 'Vehicles', icon: CarFront },
      { to: '/admin/drivers', label: 'Drivers', icon: UserRound },
    ],
  },
  {
    title: 'System',
    items: [
      { to: '/admin/notifications', label: 'Notifications', icon: Bell, count: (d) => d.notifications.filter((n) => !n.read).length },
      { to: '/admin/settings', label: 'Settings', icon: SettingsIcon },
    ],
  },
]

function Shell() {
  const [drawer, setDrawer] = useState(false)
  const [out, setOut] = useState(false)
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const { data, logout } = useAdmin()
  const unread = data.notifications.filter((n) => !n.read).length
  useEffect(() => {
    setDrawer(false)
  }, [pathname])

  const link = (n: NavItem) => {
    const count = n.count?.(data) ?? 0
    return (
      <NavLink
        key={n.to}
        to={n.to}
        end={n.end}
        className={({ isActive }) =>
          `group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isActive ? 'bg-white/12 text-white' : 'text-white/75 hover:bg-white/6 hover:text-white'}`
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
    <div className="flex h-full flex-col p-4">
      <div className="mb-6 flex items-center justify-between px-1 pt-1">
        <Link to="/admin" aria-label="Dashboard">
          <BrandMark inverse className="h-10" />
        </Link>
        <button className="rounded-lg p-1 text-white/80 lg:hidden" onClick={() => setDrawer(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <nav aria-label="Admin" className="flex flex-col">
        {GROUPS.map((g, i) => (
          <div key={i} className={i ? 'mt-5' : ''}>
            {g.title && <p className="mb-1 px-3 text-[11px] font-semibold tracking-[0.12em] text-white/50 uppercase">{g.title}</p>}
            <div className="flex flex-col gap-0.5">{g.items.map(link)}</div>
          </div>
        ))}
      </nav>
      <div className="mt-auto space-y-0.5 border-t border-white/10 pt-4">
        <Link to="/" className="block rounded-lg px-3 py-2 text-xs font-medium text-white/65 hover:bg-white/6 hover:text-white">
          ← Demo start
        </Link>
        <button onClick={() => setOut(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/75 hover:bg-white/6 hover:text-white">
          <LogOut className="size-[18px]" aria-hidden /> Log out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh">
      <div className="lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="sticky top-0 hidden h-dvh overflow-y-auto bg-navy lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-brand-900/40" aria-label="Close menu" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-navy shadow-pop">{sidebar}</aside>
          </div>
        )}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
            <button className="rounded-lg p-2 text-ink-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <BrandMark compact className="h-8 lg:hidden" />
            <p className="hidden text-sm text-ink-2 sm:block">
              As of <span className="font-semibold text-ink">{fmtDate(DEMO_TODAY, { weekday: true })}, 9:30 AM</span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/admin/notifications" className="relative rounded-lg p-2 text-ink-2 hover:bg-brand-50" aria-label={`Notifications, ${unread} unread`}>
                <Bell className="size-5" />
                {unread > 0 && <span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-sili ring-2 ring-surface" />}
              </Link>
              <span className="mx-1 h-6 w-px bg-line" aria-hidden />
              <span className="grid size-9 place-items-center rounded-full bg-navy font-display text-sm font-bold text-white" aria-hidden>
                A
              </span>
              <span className="hidden text-sm leading-tight sm:block">
                <span className="block font-semibold text-ink">Demo admin</span>
                <span className="block text-xs text-ink-2">Operations</span>
              </span>
            </div>
          </header>
          <main className="mx-auto max-w-[1360px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            <Outlet />
          </main>
        </div>
      </div>
      <ConfirmDialog
        open={out}
        onClose={() => setOut(false)}
        title="Log out?"
        body="Changes made in the admin demo stay until you reset or reload."
        confirmLabel="Log out"
        onConfirm={() => {
          logout()
          navigate('/admin/login', { replace: true })
        }}
      />
    </div>
  )
}

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
