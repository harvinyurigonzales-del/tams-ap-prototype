import { Bell, CalendarDays, CarFront, ClipboardList, CreditCard, LayoutDashboard, LogOut, Menu, MessageSquare, PieChart, Settings as SettingsIcon, UserRound, Users, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { NotFound } from '../../app/NotFound'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import { BrandMark } from '../../ui/BrandMark'
import { ConfirmDialog } from '../../ui/Dialog'
import { DemoBanner } from '../../ui/DemoBanner'
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
import { Settings } from './Settings'

export function AdminRoutes() {
  return (
    <Routes>
      <Route
        path="login"
        element={
          <div className="min-h-dvh">
            <DemoBanner side="Admin demo" />
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
          <Route path="calendar" element={<Calendar />} />
          <Route path="customers" element={<Customers />} />
          <Route path="reports" element={<Reports />} />
          <Route path="notifications" element={<AdminNotifications />} />
          <Route path="inquiries" element={<AdminInquiries />} />
          <Route path="vehicles" element={<Vehicles />} />
          <Route path="drivers" element={<Drivers />} />
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

const NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/bookings', label: 'Bookings', icon: ClipboardList },
  { to: '/admin/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/admin/reports', label: 'Reports', icon: PieChart },
  { to: '/admin/notifications', label: 'Notifications', icon: Bell },
  { to: '/admin/inquiries', label: 'Inquiries', icon: MessageSquare },
]
const FLEET = [
  { to: '/admin/vehicles', label: 'Vehicles', icon: CarFront },
  { to: '/admin/drivers', label: 'Drivers', icon: UserRound },
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

  const link = (n: (typeof NAV)[number]) => (
    <NavLink
      key={n.to}
      to={n.to}
      end={n.end}
      className={({ isActive }) =>
        `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:bg-surface-muted hover:text-ink'}`
      }
    >
      <n.icon className="size-[18px]" aria-hidden />
      <span className="flex-1">{n.label}</span>
      {n.label === 'Notifications' && unread > 0 && <span className="rounded-full bg-brand-600 px-1.5 text-[11px] font-bold text-white">{unread}</span>}
    </NavLink>
  )

  const sidebar = (
    <div className="flex h-full flex-col gap-1 p-4">
      <div className="mb-5 flex items-center justify-between px-1">
        <BrandMark />
        <button className="rounded-lg p-1 text-ink-2 lg:hidden" onClick={() => setDrawer(false)} aria-label="Close menu">
          <X className="size-5" />
        </button>
      </div>
      <nav aria-label="Admin" className="flex flex-col gap-0.5">
        {NAV.map(link)}
        <p className="mt-4 mb-1 px-3 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">Fleet</p>
        {FLEET.map(link)}
        <p className="mt-4 mb-1 px-3 text-[11px] font-semibold tracking-wide text-ink-3 uppercase">System</p>
        {link({ to: '/admin/settings', label: 'Settings', icon: SettingsIcon })}
      </nav>
      <div className="mt-auto space-y-1 pt-4">
        <Link to="/" className="block rounded-lg px-3 py-2 text-xs font-medium text-ink-2 hover:bg-surface-muted">
          ← Demo start
        </Link>
        <button onClick={() => setOut(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-ink-2 hover:bg-surface-muted hover:text-ink">
          <LogOut className="size-[18px]" aria-hidden /> Log out
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh">
      <DemoBanner side="Admin demo" />
      <div className="lg:grid lg:grid-cols-[248px_1fr]">
        <aside className="sticky top-0 hidden h-dvh border-r border-line bg-surface lg:block">{sidebar}</aside>
        {drawer && (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button className="absolute inset-0 bg-brand-900/40" aria-label="Close menu" onClick={() => setDrawer(false)} />
            <aside className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-surface shadow-pop">{sidebar}</aside>
          </div>
        )}
        <div className="min-w-0">
          <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-line bg-surface/95 px-4 backdrop-blur sm:px-6">
            <button className="rounded-lg p-2 text-ink-2 lg:hidden" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Menu className="size-5" />
            </button>
            <p className="text-sm text-ink-2">
              As of <span className="font-semibold text-ink">{fmtDate(DEMO_TODAY, { weekday: true })}, 9:30 AM</span>
            </p>
            <div className="ml-auto flex items-center gap-2">
              <Link to="/admin/notifications" className="relative rounded-lg p-2 text-ink-2 hover:bg-brand-50" aria-label={`Notifications, ${unread} unread`}>
                <Bell className="size-5" />
                {unread > 0 && <span className="absolute top-1 right-1 size-2 rounded-full bg-brand-600" />}
              </Link>
              <span className="grid size-9 place-items-center rounded-full bg-brand-100 text-sm font-bold text-brand-700" aria-hidden>
                A
              </span>
              <span className="hidden text-sm font-medium sm:block">Demo admin</span>
            </div>
          </header>
          <main className="px-4 py-6 sm:px-6 lg:px-8">
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
        <h1 className="font-display text-2xl font-bold text-brand-900">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-ink-2">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}
