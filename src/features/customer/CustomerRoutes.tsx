import { Bell, Compass, MessageCircle, Ticket, UserRound } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, Navigate, NavLink, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { NotFound } from '../../app/NotFound'
import { useCustomer } from '../../state/customerStore'
import { BrandMark } from '../../ui/BrandMark'
import { DemoBanner } from '../../ui/DemoBanner'
import { Account, Inquiries, Notifications } from './Account'
import { Login, Signup } from './Auth'
import { BookingForm, BookingReceived } from './Book'
import { ChooseDate } from './ChooseDate'
import { Home, ServiceDetails, ServiceList } from './Explore'
import { Pay } from './Pay'
import { TripDetails, Trips } from './Trips'
import { VanRental } from './VanRental'

export function CustomerRoutes() {
  return (
    <Routes>
      <Route path="login" element={<Bare><Login /></Bare>} />
      <Route path="signup" element={<Bare><Signup /></Bare>} />
      <Route element={<Shell />}>
        <Route index element={<Home />} />
        <Route path="services" element={<ServiceList />} />
        <Route path="services/:serviceId" element={<ServiceDetails />} />
        <Route path="services/:serviceId/dates" element={<ChooseDate />} />
        <Route path="inquiries" element={<Inquiries />} />
        <Route element={<RequireCustomer />}>
          <Route path="book/:departureId" element={<BookingForm />} />
          <Route path="rent" element={<VanRental />} />
          <Route path="booked/:bookingId" element={<BookingReceived />} />
          <Route path="trips" element={<Trips />} />
          <Route path="trips/:bookingId" element={<TripDetails />} />
          <Route path="trips/:bookingId/pay" element={<Pay />} />
          <Route path="account" element={<Account />} />
          <Route path="notifications" element={<Notifications />} />
        </Route>
        <Route path="*" element={<NotFound home="/app" homeLabel="Back to Explore" />} />
      </Route>
    </Routes>
  )
}

/** Route guard for the demo. It shows intended behaviour only; it is not security. */
function RequireCustomer() {
  const loggedIn = useCustomer((s) => !!s.customerId)
  const loc = useLocation()
  if (!loggedIn) return <Navigate to={`/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />
  return <Outlet />
}

function Bare({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <DemoBanner side="Customer demo" />
      {children}
    </div>
  )
}

const TABS = [
  { to: '/app', label: 'Explore', icon: Compass, end: true },
  { to: '/app/trips', label: 'My trips', icon: Ticket },
  { to: '/app/inquiries', label: 'Inquiries', icon: MessageCircle },
  { to: '/app/account', label: 'Account', icon: UserRound },
]

function Shell() {
  const { customerId, data } = useCustomer()
  const unread = customerId ? data.notifications.filter((n) => n.customerId === customerId && !n.read).length : 0
  return (
    <div className="min-h-dvh pb-20 md:pb-0">
      <DemoBanner side="Customer demo" />
      <header className="sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1120px] items-center gap-6 px-5">
          <Link to="/app" aria-label="Explore">
            <BrandMark />
          </Link>
          <nav className="ml-4 hidden gap-1 md:flex" aria-label="Main">
            {TABS.map((t) => (
              <NavLink
                key={t.to}
                to={t.to}
                end={t.end}
                className={({ isActive }) =>
                  `rounded-xl px-3.5 py-2 text-sm font-semibold ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-2 hover:text-ink'}`
                }
              >
                {t.label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/" className="hidden text-xs font-medium text-ink-2 hover:text-brand-700 sm:block">
              Demo start
            </Link>
            {customerId ? (
              <Link to="/app/notifications" className="relative rounded-xl p-2 text-ink-2 hover:bg-brand-50" aria-label={`Notifications, ${unread} unread`}>
                <Bell className="size-5" />
                {unread > 0 && <span className="absolute top-1 right-1 grid size-4 place-items-center rounded-full bg-brand-600 text-[10px] font-bold text-white">{unread}</span>}
              </Link>
            ) : (
              <Link to="/app/login" className="rounded-xl px-3 py-2 text-sm font-semibold text-brand-700 hover:bg-brand-50">
                Log in
              </Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1120px] px-5 py-5 md:py-8">
        <Outlet />
      </main>
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="grid grid-cols-4">
          {TABS.map((t) => (
            <NavLink
              key={t.to}
              to={t.to}
              end={t.end}
              className={({ isActive }) => `flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold ${isActive ? 'text-brand-600' : 'text-ink-3'}`}
            >
              <t.icon className="size-5" aria-hidden />
              {t.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}
