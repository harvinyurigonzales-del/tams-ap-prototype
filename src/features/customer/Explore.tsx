import { ArrowLeft, BusFront, ChevronRight, Compass, Map, PencilRuler } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export function BackLink({ to, label = 'Back' }: { to?: string; label?: string }) {
  const navigate = useNavigate()
  const cls = 'mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline'
  return to ? (
    <Link to={to} className={cls}>
      <ArrowLeft className="size-4" aria-hidden /> {label}
    </Link>
  ) : (
    <button onClick={() => navigate(-1)} className={cls}>
      <ArrowLeft className="size-4" aria-hidden /> {label}
    </button>
  )
}

/** Mobile Explore tab: one place that leads to tours, destinations, van rental and custom trips. */
export function ExploreHub() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-bold text-brand-900">Explore</h1>
      <p className="mt-1 text-sm text-ink-2">Join a scheduled tour, browse places to go, or plan your own trip.</p>
      <ul className="mt-5 space-y-3">
        <HubLink to="/app/tours" icon={<Compass className="size-6" aria-hidden />} title="Explore tours" body="Joiner tours with set dates, prices per person and open seats." />
        <HubLink to="/app/destinations" icon={<Map className="size-6" aria-hidden />} title="Destinations" body="Places we travel to in Luzon, what to see and the best months to go." />
        <HubLink to="/app/rental" icon={<BusFront className="size-6" aria-hidden />} title="Van rental" body="A private van with a driver for your own route. Get an estimate and request a quote." />
        <HubLink to="/app/custom/new" icon={<PencilRuler className="size-6" aria-hidden />} title="Plan a custom trip" body="Tell us where, when and your budget. Staff send a proposal you can accept or change." />
      </ul>
    </div>
  )
}

function HubLink({ to, icon, title, body }: { to: string; icon: ReactNode; title: string; body: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-4 shadow-card hover:border-brand-300">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</span>
        <span className="min-w-0 flex-1">
          <span className="block font-display font-semibold text-ink">{title}</span>
          <span className="block text-sm text-ink-2">{body}</span>
        </span>
        <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
      </Link>
    </li>
  )
}
