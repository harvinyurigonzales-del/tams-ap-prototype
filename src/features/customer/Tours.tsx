import { CalendarDays, Check, Clock, MapPin, MessageCircleQuestion, Search, X } from 'lucide-react'
import { useEffect } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { bookableDeparture, catalogTours, fromPrice } from '../../domain/recommend'
import { fmtDate, fmtTime, peso } from '../../lib/format'
import { useAssistant } from '../../state/assistant'
import { useCustomer } from '../../state/customerStore'
import { INTERESTS, type Dataset, type Interest } from '../../seed/types'
import { SampleTag } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { FilterSelect } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { destinationOf, SaveButton, TourCard } from './Cards'
import { BackLink } from './Explore'
import { departuresOf } from './select'

const DURATIONS = { any: 'Any length', day: 'Day trip', short: '2–3 days', long: '4+ days' } as const
const PRICES = { any: 'Any price', '2000': 'Up to ₱2,000', '3000': 'Up to ₱3,000', '5000': 'Up to ₱5,000' } as const

export function filterTours(d: Dataset, f: { q: string; dest: string; price: string; dur: string; interest: string; open: boolean }) {
  const needle = f.q.trim().toLowerCase()
  return catalogTours(d).filter((s) => {
    const dest = destinationOf(d, s)
    if (needle && !`${s.name} ${s.destination} ${dest?.name ?? ''} ${(s.interests ?? []).join(' ')}`.toLowerCase().includes(needle)) return false
    if (f.dest && s.destinationId !== f.dest) return false
    if (f.price !== 'any' && fromPrice(d, s) > Number(f.price)) return false
    if (f.dur === 'day' && s.days !== 1) return false
    if (f.dur === 'short' && (s.days < 2 || s.days > 3)) return false
    if (f.dur === 'long' && s.days < 4) return false
    if (f.interest && !(s.interests ?? []).includes(f.interest as Interest)) return false
    if (f.open && !bookableDeparture(d, s.id)) return false
    return true
  })
}

export function TourCatalog() {
  const data = useCustomer((s) => s.data)
  const [params, setParams] = useSearchParams()
  const f = {
    q: params.get('q') ?? '',
    dest: params.get('destination') ?? '',
    price: params.get('price') ?? 'any',
    dur: params.get('duration') ?? 'any',
    interest: params.get('interest') ?? '',
    open: params.get('open') === '1',
  }
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'any') next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  const results = filterTours(data, f)
  // Bookable tours first, then by price, so unavailable tours never crowd out the ones you can book.
  results.sort((a, b) => Number(!bookableDeparture(data, a.id)) - Number(!bookableDeparture(data, b.id)) || fromPrice(data, a) - fromPrice(data, b))
  const filtered = params.toString().length > 0

  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-900">Explore tours</h1>
      <p className="mt-1 text-sm text-ink-2">Joiner tours with set dates. Prices are per person.</p>
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          aria-label="Search tours"
          placeholder="Search tours, places or interests"
          value={f.q}
          onChange={(e) => set('q', e.target.value)}
          className="h-12 w-full rounded-2xl border border-line bg-surface pr-4 pl-12 text-[15px] shadow-card placeholder:text-ink-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2" aria-label="Filters">
        <FilterSelect label="Destination" value={f.dest} onChange={(e) => set('destination', e.target.value)}>
          <option value="">All destinations</option>
          {data.destinations
            .filter((x) => catalogTours(data).some((s) => s.destinationId === x.id))
            .map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}
              </option>
            ))}
        </FilterSelect>
        <FilterSelect label="Price" value={f.price} onChange={(e) => set('price', e.target.value)}>
          {Object.entries(PRICES).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Length" value={f.dur} onChange={(e) => set('duration', e.target.value)}>
          {Object.entries(DURATIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Interest" value={f.interest} onChange={(e) => set('interest', e.target.value)}>
          <option value="">Any interest</option>
          {INTERESTS.map((i) => (
            <option key={i}>{i}</option>
          ))}
        </FilterSelect>
        <label className="inline-flex items-center gap-2 text-sm text-ink-2">
          <input type="checkbox" checked={f.open} onChange={(e) => set('open', e.target.checked ? '1' : '')} className="size-4 accent-brand-600" />
          Open dates only
        </label>
        {filtered && (
          <button onClick={() => setParams({}, { replace: true })} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            <X className="size-4" aria-hidden /> Clear filters
          </button>
        )}
      </div>
      <p className="mt-4 text-sm text-ink-2" aria-live="polite">
        {results.length} {results.length === 1 ? 'tour' : 'tours'}
      </p>
      <div className="mt-3">
        {results.length === 0 ? (
          <Card>
            <EmptyState
              title="No tours match these filters"
              body="Clear a filter, or plan a custom trip and staff will put one together for you."
              action={<LinkButton to="/app/custom/new">Plan a custom trip</LinkButton>}
            />
          </Card>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((s) => (
              <li key={s.id}>
                <TourCard service={s} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function TourDetails() {
  const { serviceId } = useParams()
  const data = useCustomer((s) => s.data)
  const markViewed = useCustomer((s) => s.markViewed)
  const openWith = useAssistant((s) => s.openWith)
  const s = data.services.find((x) => x.id === serviceId && x.type === 'tour')
  useEffect(() => {
    if (s) markViewed('tour', s.id)
  }, [s, markViewed])
  if (!s) return <EmptyState title="Tour not found" action={<LinkButton to="/app/tours">Explore tours</LinkButton>} />
  const dest = destinationOf(data, s)
  const deps = departuresOf(data, s.id)
  const anyOpen = deps.some((d) => d.avail.state === 'open')

  return (
    <div>
      <BackLink to="/app/tours" label="Explore tours" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div>
          {dest && <Picture image={dest.image} className="h-52 rounded-3xl md:h-72" />}
          <div className="mt-5 flex items-start justify-between gap-3">
            <h1 className="font-display text-[28px] leading-tight font-bold text-brand-900">{s.name}</h1>
            <SaveButton item={{ kind: 'tour', id: s.id }} name={s.name} withLabel className="shrink-0" />
          </div>
          <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {s.destination}
            </span>
            <span className="inline-flex items-center gap-1">
              <Clock className="size-4" aria-hidden /> {s.duration}
            </span>
            {dest && (
              <Link to={`/app/destinations/${dest.id}`} className="font-semibold text-brand-700 hover:underline">
                About {dest.name}
              </Link>
            )}
          </p>
          {s.interests && (
            <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Good for">
              {s.interests.map((i) => (
                <li key={i} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-2">
                  {i}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-4 text-ink">{s.summary}</p>

          <h2 className="mt-6 font-display text-lg font-semibold text-brand-900">Itinerary</h2>
          <ol className="mt-2 space-y-2 text-sm text-ink">
            {s.itinerary.map((i) => (
              <li key={i} className="rounded-xl bg-surface px-4 py-3 shadow-card ring-1 ring-line">
                {i}
              </li>
            ))}
          </ol>
          <Inclusions inclusions={s.inclusions} exclusions={s.exclusions} />
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <p>
              <span className="font-display text-2xl font-bold text-brand-700 tnum">{peso(anyOpen ? fromPrice(data, s) : s.price)}</span>
              <span className="text-sm text-ink-2">/person</span>
            </p>
            <p className="mt-2 text-sm text-ink-2">
              Pickup: {s.pickup}, {fmtTime(s.pickupTime)}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              50% down payment holds your booking
              <SampleTag />
            </p>
            {deps.length > 0 && (
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
            <div className="mt-5 grid gap-2">
              {anyOpen ? (
                <LinkButton to={`/app/tours/${s.id}/dates`} size="lg" full>
                  <CalendarDays className="size-5" aria-hidden /> View dates
                </LinkButton>
              ) : (
                <>
                  <p className="rounded-xl bg-surface-muted px-4 py-3 text-center text-sm text-ink-2">No open departures right now, so this tour can’t be booked online.</p>
                  {dest && (
                    <LinkButton to={`/app/custom/new?destination=${dest.id}`} variant="secondary" size="lg" full>
                      Plan a custom trip to {dest.name}
                    </LinkButton>
                  )}
                </>
              )}
              <Button variant="ghost" full icon={<MessageCircleQuestion className="size-4" aria-hidden />} onClick={() => openWith({ kind: 'tour', id: s.id })}>
                Ask about this tour
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}

export function Inclusions({ inclusions, exclusions }: { inclusions: string[]; exclusions: string[] }) {
  return (
    <div className="mt-6 grid gap-4 sm:grid-cols-2">
      <div>
        <h2 className="font-display text-lg font-semibold text-brand-900">Inclusions</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {inclusions.map((i) => (
            <li key={i} className="flex gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> {i}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="font-display text-lg font-semibold text-brand-900">Not included</h2>
        <ul className="mt-2 space-y-1.5 text-sm">
          {exclusions.map((i) => (
            <li key={i} className="flex gap-2">
              <X className="mt-0.5 size-4 shrink-0 text-ink-3" aria-hidden /> {i}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
