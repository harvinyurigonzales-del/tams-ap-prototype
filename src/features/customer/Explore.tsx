import { ArrowLeft, CalendarDays, Check, Clock, MapPin, Search, Tag, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { shortRange } from '../../domain/rules'
import { fmtDate, fmtTime, peso } from '../../lib/format'
import { useCustomer, useMe } from '../../state/customerStore'
import type { Service } from '../../seed/types'
import { SampleTag } from '../../ui/Badge'
import { LinkButton } from '../../ui/Button'
import { Card, PhotoPlaceholder, SectionTitle } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { departuresOf, nextOpen, priceUnit } from './select'

export function Home() {
  const me = useMe()
  const data = useCustomer((s) => s.data)
  const [q, setQ] = useState('')
  const promoDep = data.departures.find((d) => d.promo)
  const promoSvc = promoDep && data.services.find((s) => s.id === promoDep.serviceId)
  const results = filterServices(data.services, q, 'all')

  return (
    <div>
      <p className="text-sm text-ink-2">{me ? `Hello, ${me.name.split(' ')[0]}` : 'Hello, traveller'}</p>
      <h1 className="font-display text-[28px] leading-tight font-bold text-brand-900 md:text-[32px]">Where to next?</h1>

      <SearchBox value={q} onChange={setQ} />

      {!q && promoDep && promoSvc && (
        <Link
          to={`/app/services/${promoSvc.id}/dates?d=${promoDep.id}`}
          className="mt-5 block overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-card md:p-8"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            <Tag className="size-3.5" aria-hidden /> {promoDep.promo!.label}
          </span>
          <p className="mt-3 font-display text-2xl font-bold md:text-3xl">Save {peso(promoDep.promo!.amountOff)} per person</p>
          <p className="mt-1 text-sm text-brand-100">
            {promoSvc.name} · {shortRange(promoDep.startDate, promoDep.endDate)} departure. Book by {fmtDate(promoDep.promo!.bookBy, { year: false })}.
          </p>
          <span className="mt-4 inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-700">View dates</span>
        </Link>
      )}

      <div className="mt-8">
        <SectionTitle
          action={
            <Link to="/app/services" className="text-sm font-semibold text-brand-700 hover:underline">
              View all
            </Link>
          }
        >
          {q ? `Results for “${q}”` : 'Popular trips'}
        </SectionTitle>
        {results.length === 0 ? (
          <Card>
            <EmptyState title="No trips match your search" body="Try another destination, like Baguio or Tagaytay." />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((s) => (
              <TripCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="relative mt-4">
      <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
      <input
        type="search"
        aria-label="Search trips"
        placeholder="Search destinations"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border border-line bg-surface pr-10 pl-12 text-[15px] shadow-card placeholder:text-ink-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
      />
      {value && (
        <button onClick={() => onChange('')} className="absolute top-1/2 right-3 -translate-y-1/2 rounded p-1 text-ink-3" aria-label="Clear search">
          <X className="size-4" />
        </button>
      )}
    </div>
  )
}

function filterServices(services: Service[], q: string, type: 'all' | 'tour' | 'van') {
  const needle = q.trim().toLowerCase()
  return services.filter(
    (s) => (type === 'all' || s.type === type) && (!needle || `${s.name} ${s.destination}`.toLowerCase().includes(needle)),
  )
}

export function TripCard({ service: s }: { service: Service }) {
  const data = useCustomer((st) => st.data)
  const next = s.type === 'tour' ? nextOpen(data, s) : undefined
  return (
    <Link to={`/app/services/${s.id}`} className="group overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition hover:shadow-pop">
      <PhotoPlaceholder tint={s.tint} label={s.destination.split(',')[0]} className="h-36" />
      <div className="p-4">
        <p className="font-display text-base font-semibold text-ink group-hover:text-brand-700">{s.name}</p>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
          <MapPin className="size-3.5" aria-hidden /> {s.destination} · {s.duration}
        </p>
        <div className="mt-3 flex items-end justify-between gap-2">
          <p className="text-sm">
            <span className="font-display text-lg font-bold text-brand-700 tnum">{peso(s.price)}</span>
            <span className="text-ink-2">{priceUnit(s)}</span>
          </p>
          <p className="text-right text-xs font-medium text-ink-2">
            {s.type === 'van' ? 'Choose your dates' : next ? `${fmtDate(next.dep.startDate, { year: false })} · ${next.avail.left} slots remaining` : 'No open dates'}
          </p>
        </div>
      </div>
    </Link>
  )
}

export function ServiceList() {
  const data = useCustomer((s) => s.data)
  const [q, setQ] = useState('')
  const [type, setType] = useState<'all' | 'tour' | 'van'>('all')
  const results = useMemo(() => filterServices(data.services, q, type), [data.services, q, type])
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-900">All trips and services</h1>
      <SearchBox value={q} onChange={setQ} />
      <div className="mt-4 flex gap-2" role="group" aria-label="Filter by type">
        {(
          [
            ['all', 'All'],
            ['tour', 'Tour packages'],
            ['van', 'Van rental'],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            aria-pressed={type === k}
            onClick={() => setType(k)}
            className={`h-9 rounded-full px-4 text-sm font-semibold ${type === k ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-ink-2 hover:border-brand-300'}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {results.length === 0 ? (
          <Card>
            <EmptyState title="Nothing matches" body="Clear the search or choose another filter." />
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((s) => (
              <TripCard key={s.id} service={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

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

export function ServiceDetails() {
  const { serviceId } = useParams()
  const data = useCustomer((s) => s.data)
  const s = data.services.find((x) => x.id === serviceId)
  if (!s) return <EmptyState title="Trip not found" action={<LinkButton to="/app">Back to Explore</LinkButton>} />
  const deps = s.type === 'tour' ? departuresOf(data, s.id) : []
  const anyOpen = deps.some((d) => d.avail.state === 'open')
  const cta =
    s.type === 'van' ? (
      <LinkButton to="/app/rent" size="lg" full>
        Request a van
      </LinkButton>
    ) : anyOpen ? (
      <LinkButton to={`/app/services/${s.id}/dates`} size="lg" full>
        <CalendarDays className="size-5" aria-hidden /> View dates
      </LinkButton>
    ) : (
      <p className="rounded-xl bg-surface-muted px-4 py-3 text-center text-sm text-ink-2">No open departures right now. Check back soon.</p>
    )

  return (
    <div>
      <BackLink to="/app" label="Explore" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          <PhotoPlaceholder tint={s.tint} label={s.destination.split(',')[0]} className="h-52 rounded-3xl md:h-72" />
          <h1 className="mt-5 font-display text-[28px] leading-tight font-bold text-brand-900">{s.name}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {s.destination}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> {s.duration}
            </span>
          </p>
          <p className="mt-4 text-ink">{s.summary}</p>

          <h2 className="mt-6 font-display text-lg font-semibold text-brand-900">Itinerary</h2>
          <ul className="mt-2 space-y-2 text-sm text-ink">
            {s.itinerary.map((i) => (
              <li key={i} className="rounded-xl bg-surface px-4 py-3 shadow-card ring-1 ring-line">
                {i}
              </li>
            ))}
          </ul>
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div>
              <h2 className="font-display text-lg font-semibold text-brand-900">Inclusions</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {s.inclusions.map((i) => (
                  <li key={i} className="flex gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h2 className="font-display text-lg font-semibold text-brand-900">Not included</h2>
              <ul className="mt-2 space-y-1.5 text-sm">
                {s.exclusions.map((i) => (
                  <li key={i} className="flex gap-2">
                    <X className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /> {i}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <p>
              <span className="font-display text-2xl font-bold text-brand-700 tnum">{peso(s.price)}</span>
              <span className="text-sm text-ink-2">{priceUnit(s)}</span>
            </p>
            <p className="mt-2 text-sm text-ink-2">
              Pickup: {s.pickup}
              {s.type === 'tour' && `, ${fmtTime(s.pickupTime)}`}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              50% down payment holds your booking
              <SampleTag />
            </p>
            {s.type === 'tour' && deps.length > 0 && (
              <ul className="mt-4 space-y-1.5 text-sm">
                {deps.slice(0, 4).map(({ dep, avail }) => (
                  <li key={dep.id} className="flex justify-between">
                    <span>{fmtDate(dep.startDate, { weekday: true, year: false })}</span>
                    <span className={avail.state === 'open' ? 'font-medium text-ok' : 'text-ink-3'}>
                      {avail.state === 'open' ? `${avail.left} left` : avail.state === 'full' ? 'Full' : 'Closed'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5">{cta}</div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
