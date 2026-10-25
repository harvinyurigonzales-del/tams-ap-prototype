import {
  ArrowLeft, BusFront, CalendarDays, CalendarRange, Landmark, LayoutGrid, MapPin, Mountain, PencilRuler, Search, SlidersHorizontal, Sun, Tag, Tent, Umbrella,
  Users, X, type LucideIcon,
} from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { DURATIONS, filterDestinations, filterFromParams, filterTours, hasPromo, PRICES, SORTS, type ExploreFilter } from '../../domain/explore'
import { availableMoods, MOODS, type MoodId } from '../../domain/moods'
import { catalogTours } from '../../domain/recommend'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate } from '../../lib/format'
import { useCustomer } from '../../state/customerStore'
import { LinkButton } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Picture } from '../../ui/Picture'
import { DestinationCard, TourCard } from './Cards'

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

type View = 'tours' | 'destinations'

const MOOD_ICON: Record<MoodId, LucideIcon> = {
  family: Users,
  beach: Umbrella,
  mountain: Mountain,
  adventure: Tent,
  heritage: Landmark,
  daytrip: Sun,
  weekend: CalendarRange,
}

/** Three places for the header collage: the photographed ones first, then illustrations. */
const COLLAGE = ['DST-BAGUIO', 'DST-HUNDRED', 'DST-VIGAN']

/**
 * One Explore page for tours and destinations. A search bar (where, when, how many) sits over a branded
 * header, then icon filter chips, sort and the results. Every filter lives in the URL so results can be shared.
 */
export function ExplorePage({ defaultView = 'tours' }: { defaultView?: View }) {
  const data = useCustomer((s) => s.data)
  const [params, setParams] = useSearchParams()
  const [more, setMore] = useState(false)
  const view: View = params.get('view') === 'destinations' ? 'destinations' : params.get('view') === 'tours' ? 'tours' : defaultView
  const f = filterFromParams(params)
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value || value === 'any' || (key === 'sort' && value === 'recommended')) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
  }
  const setView = (v: View) => {
    const next = new URLSearchParams(params)
    next.set('view', v)
    setParams(next, { replace: true })
  }
  const clear = () => setParams(view === defaultView ? {} : { view }, { replace: true })

  const tours = filterTours(data, f)
  const dests = filterDestinations(data, f)
  const isTours = view === 'tours'
  const active = (['q', 'dest', 'mood', 'interest', 'from'] as const).filter((k) => f[k]).length + (f.price !== 'any' ? 1 : 0) + (f.dur !== 'any' ? 1 : 0) + (f.pax ? 1 : 0) + (f.open ? 1 : 0) + (f.promo ? 1 : 0)
  const moods = availableMoods(data)
  const destName = data.destinations.find((x) => x.id === f.dest)?.name
  const promoCount = catalogTours(data).filter((s) => hasPromo(data, s.id)).length
  const extra = (f.price !== 'any' ? 1 : 0) + (f.dur !== 'any' ? 1 : 0) + (f.q ? 1 : 0)

  return (
    <div>
      <ExploreHeader f={f} set={set} />

      {/* Filter chips and sort, one row above the results. */}
      <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="-mx-4 flex min-w-0 gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-1 sm:flex-wrap sm:px-0" role="group" aria-label="Filters">
          <Chip active={more || extra > 0} onClick={() => setMore(!more)} icon={SlidersHorizontal} expanded={more}>
            All filters{extra > 0 && <span className="ml-0.5 tnum">({extra})</span>}
          </Chip>
          {moods.map(({ mood }) => (
            <Chip key={mood.id} active={f.mood === mood.id} onClick={() => set('mood', f.mood === mood.id ? '' : mood.id)} icon={MOOD_ICON[mood.id]}>
              {mood.label}
            </Chip>
          ))}
          {isTours && promoCount > 0 && (
            <Chip active={f.promo} onClick={() => set('promo', f.promo ? '' : '1')} icon={Tag} tone="promo">
              Promos
            </Chip>
          )}
          {isTours && (
            <Chip active={f.open} onClick={() => set('open', f.open ? '' : '1')} icon={CalendarDays}>
              Open dates
            </Chip>
          )}
        </div>
        {isTours && (
          <label className="flex shrink-0 items-center gap-2 self-start rounded-full bg-surface py-1.5 pr-3 pl-4 text-sm font-semibold text-ink-2 ring-1 ring-line">
            Sort
            <select value={f.sort} onChange={(e) => set('sort', e.target.value)} className="bg-transparent py-1 text-sm font-semibold text-ink focus:outline-none">
              {Object.entries(SORTS).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>

      {more && <MoreFilters f={f} set={set} isTours={isTours} />}

      {(f.from || f.pax > 0) && isTours && (
        <ul className="mt-4 flex flex-wrap gap-2" aria-label="From your search">
          {f.from && <ActiveChip onRemove={() => set('from', '')} label={`Leaving on or after ${fmtDate(f.from, { year: false })}`} />}
          {f.pax > 0 && <ActiveChip onRemove={() => set('pax', '')} label={`${f.pax} ${f.pax === 1 ? 'traveler' : 'travelers'}`} />}
        </ul>
      )}

      <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="type-head text-[24px] text-charcoal md:text-[28px]" aria-live="polite">
            {isTours
              ? `${tours.length} joiner ${tours.length === 1 ? 'tour' : 'tours'}${destName ? ` to ${destName}` : ' in Luzon'}`
              : `${dests.length} ${dests.length === 1 ? 'destination' : 'destinations'}`}
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            {isTours ? 'Set dates, shared van, priced per person. Pickup at SM North EDSA.' : 'Places we travel to. Book a joiner tour or plan your own trip.'}
            {f.mood && ` Showing ${MOODS.find((m) => m.id === f.mood)!.label.toLowerCase()}.`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {active > 0 && (
            <button onClick={clear} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              <X className="size-4" aria-hidden /> Clear filters
            </button>
          )}
          <div className="inline-flex rounded-xl bg-surface p-1 ring-1 ring-line" role="group" aria-label="Show">
            <ViewButton active={isTours} onClick={() => setView('tours')} label="Tours" count={tours.length} icon={LayoutGrid} />
            <ViewButton active={!isTours} onClick={() => setView('destinations')} label="Destinations" count={dests.length} icon={MapPin} />
          </div>
        </div>
      </div>

      <div className="mt-5">
        {isTours ? (
          tours.length === 0 ? (
            <div className="rounded-[20px] bg-surface ring-1 ring-line">
              <EmptyState
                title={destName ? `No joiner tour to ${destName} fits this search` : 'No tours match these filters'}
                body={
                  destName && !catalogTours(data).some((s) => s.destinationId === f.dest)
                    ? `We don’t run a scheduled tour to ${destName} yet. Plan a custom trip and staff will send you a proposal.`
                    : 'Try a later date, fewer travelers or another filter. You can also plan a custom trip and staff will put one together.'
                }
                action={
                  <LinkButton to={`/app/custom/new${f.dest ? `?destination=${f.dest}` : ''}`}>{destName ? `Plan a custom trip to ${destName}` : 'Plan a custom trip'}</LinkButton>
                }
              />
            </div>
          ) : (
            <ul key={JSON.stringify(f)} className="fade-in grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {tours.map((s) => (
                <li key={s.id}>
                  <TourCard service={s} window={{ from: f.from, pax: f.pax }} />
                </li>
              ))}
            </ul>
          )
        ) : dests.length === 0 ? (
          <div className="rounded-[20px] bg-surface ring-1 ring-line">
            <EmptyState title="No destinations match these filters" body="Clear a filter to see every place we travel to in Luzon." />
          </div>
        ) : (
          <ul key={JSON.stringify(f)} className="fade-in grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {dests.map((x) => (
              <li key={x.id}>
                <DestinationCard dest={x} />
              </li>
            ))}
          </ul>
        )}
      </div>

      <section className="mt-14" aria-labelledby="other-ways">
        <p className="type-eyebrow text-sili">Private trips</p>
        <h2 id="other-ways" className="mt-1 type-head text-[26px] text-charcoal">
          Para sa buong barkada
        </h2>
        <p className="mt-1 text-sm text-ink-2">Prefer your own schedule? Two ways to travel privately with your group.</p>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          <WayCard
            to="/app/rental"
            icon={<BusFront className="size-6" aria-hidden />}
            title="Van rental with driver"
            body="A private van and driver for your own route. See an estimate, then staff send a quote."
          />
          <WayCard
            to="/app/custom/new"
            icon={<PencilRuler className="size-6" aria-hidden />}
            title="Plan a custom trip"
            body="Tell us where, when and your budget. Staff send a proposal you can accept or change."
          />
        </ul>
      </section>
    </div>
  )
}

/** Branded header band with a photo collage and the search bar floating over its lower edge. */
function ExploreHeader({ f, set }: { f: ExploreFilter; set: (k: string, v: string) => void }) {
  const data = useCustomer((s) => s.data)
  const pics = COLLAGE.map((id) => data.destinations.find((d) => d.id === id)).filter((d) => !!d)
  const tourCount = catalogTours(data).length
  const placeCount = new Set(catalogTours(data).map((s) => s.destinationId)).size
  return (
    <section className="relative" aria-labelledby="explore-title">
      <div className="relative overflow-hidden rounded-[28px] bg-navy px-6 pt-8 pb-24 text-white sm:px-10 sm:pt-12 md:pb-28">
        {/* The road line motif, drawn faintly across the band. */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full text-white/12" viewBox="0 0 1200 400" preserveAspectRatio="none" aria-hidden>
          <path d="M-20,330 C220,250 380,360 600,280 S960,120 1220,170" fill="none" stroke="currentColor" strokeWidth="3" strokeDasharray="14 12" />
        </svg>
        <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_440px]">
          <div>
            <p className="type-eyebrow text-[#F6B4B6]">Explore Luzon with TAMS AP</p>
            <h1 id="explore-title" className="mt-3 type-hero text-[40px] sm:text-[56px]">
              Saan tayo next?
            </h1>
            <p className="mt-3 max-w-lg text-[15px] text-white/85 sm:text-base">
              {tourCount} joiner tours to {placeCount} places, with set dates, a shared van and per-person prices. Or browse every place we go and plan a trip your way.
            </p>
          </div>
          <div className="relative hidden h-[220px] lg:block" aria-hidden>
            {pics.map((d, i) => (
              <div
                key={d.id}
                className={`absolute w-[200px] overflow-hidden rounded-2xl shadow-pop ring-4 ring-white/90 ${['top-2 left-0 -rotate-6', 'top-0 left-[120px] z-10 rotate-2', 'top-8 left-[240px] rotate-6'][i]}`}
              >
                <Picture image={d.image} label={false} className="aspect-[4/3]" />
                <p className="bg-white px-3 py-1.5 text-xs font-semibold text-charcoal">{d.name}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
      <SearchBar f={f} set={set} />
      <span id="explore-results" className="block scroll-mt-24" aria-hidden />
    </section>
  )
}

const seg = 'flex min-w-0 flex-col gap-0.5 px-5 py-3 text-xs font-semibold text-ink-2'
const ctl = 'w-full min-w-0 bg-transparent text-[15px] font-medium text-ink focus:outline-none'

function SearchBar({ f, set }: { f: ExploreFilter; set: (k: string, v: string) => void }) {
  const data = useCustomer((s) => s.data)
  return (
    <div
      role="search"
      aria-label="Search trips"
      className="relative z-10 mx-3 -mt-16 grid rounded-[22px] bg-surface shadow-pop ring-1 ring-line sm:mx-6 md:-mt-12 md:grid-cols-[1.4fr_1fr_0.9fr_auto] md:items-stretch md:divide-x md:divide-line md:rounded-full"
    >
      <label className={`${seg} border-b border-line md:border-b-0`}>
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden /> Where to?
        </span>
        <select value={f.dest} onChange={(e) => set('destination', e.target.value)} className={ctl}>
          <option value="">Anywhere in Luzon</option>
          {data.destinations.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}, {x.province}
            </option>
          ))}
        </select>
      </label>
      <label className={`${seg} border-b border-line md:border-b-0`}>
        <span className="flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden /> Leaving on or after
        </span>
        <input type="date" value={f.from} min={DEMO_TODAY} onChange={(e) => set('from', e.target.value)} className={ctl} />
      </label>
      <label className={`${seg} border-b border-line md:border-b-0`}>
        <span className="flex items-center gap-1.5">
          <Users className="size-3.5" aria-hidden /> Travelers
        </span>
        <select value={f.pax || ''} onChange={(e) => set('pax', e.target.value)} className={ctl}>
          <option value="">Any group size</option>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'traveler' : 'travelers'}
            </option>
          ))}
        </select>
      </label>
      <div className="flex items-center p-2 md:pl-2">
        {/* Filters apply as you choose them; the button takes you down to the results. */}
        <button
          type="button"
          onClick={() => document.getElementById('explore-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-sili px-6 text-[15px] font-semibold text-white hover:bg-sili-600 md:w-auto"
        >
          <Search className="size-4" aria-hidden /> Search
        </button>
      </div>
    </div>
  )
}

function MoreFilters({ f, set, isTours }: { f: ExploreFilter; set: (k: string, v: string) => void; isTours: boolean }) {
  return (
    <div className="mt-3 grid gap-3 rounded-[20px] bg-surface p-4 ring-1 ring-line sm:grid-cols-3">
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        Keyword
        <span className="flex items-center gap-2 rounded-xl border border-line px-3">
          <Search className="size-4 shrink-0 text-ink-3" aria-hidden />
          <input type="search" value={f.q} onChange={(e) => set('q', e.target.value)} placeholder="Place, tour or interest" className="h-11 w-full min-w-0 bg-transparent text-[15px] font-medium text-ink placeholder:text-ink-3 focus:outline-none" />
        </span>
      </label>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        Length
        <select value={f.dur} onChange={(e) => set('duration', e.target.value)} className="h-11 rounded-xl border border-line bg-transparent px-3 text-[15px] font-medium text-ink focus:outline-none">
          {Object.entries(DURATIONS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </label>
      {isTours && (
        <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
          Price per person
          <select value={f.price} onChange={(e) => set('price', e.target.value)} className="h-11 rounded-xl border border-line bg-transparent px-3 text-[15px] font-medium text-ink focus:outline-none">
            {Object.entries(PRICES).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
      )}
    </div>
  )
}

function ViewButton({ active, onClick, label, count, icon: Icon }: { active: boolean; onClick: () => void; label: string; count: number; icon: LucideIcon }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition-colors ${active ? 'bg-brand-600 text-white' : 'text-ink-2 hover:text-ink'}`}
    >
      <Icon className="size-4" aria-hidden />
      {label}
      <span className={`tnum text-xs ${active ? 'text-white/75' : 'text-ink-3'}`}>{count}</span>
    </button>
  )
}

function Chip({
  active, onClick, children, icon: Icon, tone, expanded,
}: { active: boolean; onClick: () => void; children: ReactNode; icon: LucideIcon; tone?: 'promo'; expanded?: boolean }) {
  const on = tone === 'promo' ? 'bg-sili text-white ring-sili' : 'bg-brand-50 text-brand-700 ring-brand-300'
  return (
    <button
      onClick={onClick}
      aria-pressed={expanded === undefined ? active : undefined}
      aria-expanded={expanded}
      className={`inline-flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 transition-colors ${active ? on : 'bg-surface text-ink-2 ring-line hover:text-ink hover:ring-line-strong'}`}
    >
      <Icon className="size-4" aria-hidden />
      {children}
    </button>
  )
}

function ActiveChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <li>
      <button onClick={onRemove} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 pr-3 pl-3.5 text-sm font-semibold text-brand-800 hover:bg-brand-100">
        {label}
        <X className="size-4" aria-hidden />
        <span className="sr-only">, remove</span>
      </button>
    </li>
  )
}

function WayCard({ to, icon, title, body }: { to: string; icon: ReactNode; title: string; body: string }) {
  return (
    <li>
      <Link to={to} className="flex h-full items-start gap-4 rounded-[20px] bg-surface p-5 ring-1 ring-line transition-shadow hover:shadow-pop">
        <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-50 text-brand-700">{icon}</span>
        <span className="min-w-0">
          <span className="block type-head text-lg text-charcoal">{title}</span>
          <span className="mt-1 block text-sm text-ink-2">{body}</span>
        </span>
      </Link>
    </li>
  )
}
