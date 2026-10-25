import { ArrowRight, LayoutDashboard, Smartphone } from 'lucide-react'
import { Link } from 'react-router-dom'
import { fmtDate } from '../lib/format'
import { DEMO_TODAY } from '../lib/demoClock'
import { InstallButton } from '../pwa/InstallHelp'
import { BrandMark } from '../ui/BrandMark'
import { ResetDemoButton, useResetOnArrival } from './ResetDemo'

/** Presenter hub: two demos that do not share data, plus Reset and Install. */
export function Start() {
  useResetOnArrival()
  return (
    <div className="min-h-dvh">
      <main className="mx-auto max-w-4xl px-4 py-10 sm:py-16">
        <BrandMark />
        <h1 className="mt-8 font-display text-3xl leading-tight font-bold text-brand-900 sm:text-4xl">Booking Management System</h1>
        <p className="mt-3 max-w-2xl text-ink-2">
          A clickable prototype for TAMS AP Travel and Tours. Everything here is fictional sample data, and the clock is fixed at{' '}
          <strong className="text-ink">{fmtDate(DEMO_TODAY, { weekday: true })}, 9:30 AM</strong> (Manila time).
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <DemoCard
            to="/app"
            icon={<Smartphone className="size-6" aria-hidden />}
            title="Customer demo"
            body="Browse trips, book seats, and submit a sample payment as Maria Santos."
            step="Step 1"
          />
          <DemoCard
            to="/admin"
            icon={<LayoutDashboard className="size-6" aria-hidden />}
            title="Admin demo"
            body="Verify payments, confirm bookings, assign vans, and read the reports."
            step="Step 2"
          />
        </div>

        <p className="mt-6 rounded-xl bg-info-bg px-4 py-3 text-sm text-info">
          The two demos do not share data. The admin demo starts from a prepared copy of the same booking the customer demo creates. In the real
          system both would use one database.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <ResetDemoButton />
          <InstallButton />
        </div>

        <p className="mt-10 text-xs text-ink-3">
          Version {__APP_VERSION__} · build {__COMMIT__} · No data leaves this device and nothing is saved after the page is closed.
        </p>
      </main>
    </div>
  )
}

function DemoCard({ to, icon, title, body, step }: { to: string; icon: React.ReactNode; title: string; body: string; step: string }) {
  return (
    <Link
      to={to}
      className="group flex flex-col rounded-2xl border border-line bg-surface p-6 shadow-card transition hover:border-brand-300 hover:shadow-pop"
    >
      <span className="flex items-center justify-between">
        <span className="grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span>
        <span className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{step}</span>
      </span>
      <span className="mt-4 font-display text-xl font-semibold text-brand-900">{title}</span>
      <span className="mt-1 text-sm text-ink-2">{body}</span>
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-brand-700">
        Open <ArrowRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
      </span>
    </Link>
  )
}
