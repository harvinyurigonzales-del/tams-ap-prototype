import { BusFront, CalendarDays, Clock, Heart, MapPin, Tag } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { catalogTours } from '../../domain/recommend'
import { departureInWindow, type TripWindow } from '../../domain/moods'
import { promoFor } from '../../domain/rules'
import { ratingFor } from '../../domain/reviews'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtTime, peso } from '../../lib/format'
import { useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import type { Dataset, Destination, SavedItem, Service } from '../../seed/types'
import { Picture } from '../../ui/Picture'
import { RatingBadge } from '../../ui/Stars'

export const destinationOf = (d: Dataset, s: Service) => d.destinations.find((x) => x.id === s.destinationId)

/** Short pickup label: "SM North EDSA" from "SM North EDSA, Quezon City". */
export const pickupPlace = (s: Service) => s.pickup.split(',')[0]

/** Heart toggle. Guests are sent to log in, and the save is applied when they come back. */
export function SaveButton({ item, name, className = '', withLabel = false }: { item: SavedItem; name: string; className?: string; withLabel?: boolean }) {
  const { customerId, data, toggleSaved, setPendingSave } = useCustomer()
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const loc = useLocation()
  const saved = !!customerId && (data.saved[customerId] ?? []).some((x) => x.kind === item.kind && x.id === item.id)
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!customerId) {
      setPendingSave(item)
      navigate(`/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}`)
      return
    }
    const r = toggleSaved(item)
    if (r.ok) toast(r.value ? `Saved ${name}.` : `Removed ${name} from Saved.`)
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={saved}
      aria-label={withLabel ? undefined : saved ? `Remove ${name} from Saved` : `Save ${name}`}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold transition-colors ${withLabel ? 'h-11 border border-line-strong bg-surface px-4 text-sm text-ink hover:bg-sand' : 'size-10 justify-center bg-white/90 text-ink shadow-card backdrop-blur hover:bg-white'} ${className}`}
    >
      <Heart className={`size-[18px] ${saved ? 'fill-sili text-sili' : ''}`} aria-hidden />
      {withLabel && (saved ? 'Saved' : 'Save')}
    </button>
  )
}

/** Why a card was suggested, marked with the route dot so it reads as a note, not a tag. */
export function Reason({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 flex items-start gap-2 text-[13px] leading-snug text-ink-2">
      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-sili" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

/** Price with its unit always spelled out, and the original price struck through when a promo applies. */
export function PriceTag({ price, was, unit = 'person', size = 'md' }: { price: number; was?: number; unit?: 'person' | 'day' | 'group'; size?: 'md' | 'lg' }) {
  return (
    <p className="leading-none">
      {was && was > price && (
        <span className="mr-1.5 text-sm text-ink-3 line-through tnum">
          <span className="sr-only">was </span>
          {peso(was)}
        </span>
      )}
      <span className={`type-head text-charcoal tnum ${size === 'lg' ? 'text-[30px]' : 'text-[22px]'}`}>{peso(price)}</span>
      <span className="ml-1 text-sm text-ink-2">per {unit}</span>
    </p>
  )
}

/**
 * Tour card. Everything on it comes from the package and its departures: where you are picked up, the next
 * date that still has seats (or the one that fits a search), the per-person price after any promo, and the
 * rating from travellers who completed the trip.
 */
export function TourCard({ service: s, reason, footer, window: w }: { service: Service; reason?: string; footer?: React.ReactNode; window?: TripWindow }) {
  const data = useCustomer((st) => st.data)
  const dest = destinationOf(data, s)
  const next = departureInWindow(data, s.id, w ?? {})
  const off = next ? promoFor(next.dep, DEMO_TODAY) : 0
  const rating = ratingFor(data, s.id)
  const pax = w?.pax && w.pax > 1 ? w.pax : 0
  const datesLink = next ? `/app/tours/${s.id}/dates?d=${next.dep.id}` : `/app/tours/${s.id}`
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[20px] bg-surface ring-1 ring-line transition-shadow hover:shadow-pop">
      <div className="relative">
        {dest ? <Picture image={dest.image} className="aspect-[16/11]" labelAt="bl" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" /> : <div className="aspect-[16/11] bg-sand" />}
        <span className="absolute top-3 left-3 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-charcoal shadow-card">Joiner tour · {s.duration.split(' / ')[0]}</span>
        <SaveButton item={{ kind: 'tour', id: s.id }} name={s.name} className="absolute top-2.5 right-2.5 z-10" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
          <MapPin className="size-3.5 shrink-0" aria-hidden /> {s.destination}
        </p>
        <h3 className="mt-1 type-head text-[20px] text-charcoal">
          <Link to={`/app/tours/${s.id}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">
            {s.name}
          </Link>
        </h3>
        <RatingBadge avg={rating.avg} count={rating.count} className="mt-1.5" />
        {reason && <Reason>{reason}</Reason>}
        <dl className="mt-4 grid gap-2 text-[13px] text-ink">
          <div className="flex items-center gap-2">
            <dt className="sr-only">Length</dt>
            <Clock className="size-4 shrink-0 text-ink-3" aria-hidden />
            <dd>{s.duration}</dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">Pickup</dt>
            <BusFront className="size-4 shrink-0 text-ink-3" aria-hidden />
            <dd>
              Pickup at {pickupPlace(s)}, {fmtTime(s.pickupTime)}
            </dd>
          </div>
          <div className="flex items-center gap-2">
            <dt className="sr-only">{w?.from || w?.pax ? 'Matching departure' : 'Next departure'}</dt>
            <CalendarDays className="size-4 shrink-0 text-ink-3" aria-hidden />
            <dd className={next ? '' : 'text-ink-3'}>
              {next ? (
                <>
                  {fmtDate(next.dep.startDate, { weekday: true, year: false })}
                  <span className={`ml-2 font-semibold ${next.avail.left <= 4 ? 'text-sili' : 'text-palay'}`}>{next.avail.left} seats left</span>
                </>
              ) : w?.from || w?.pax ? (
                'No departure fits your dates'
              ) : (
                'No open dates'
              )}
            </dd>
          </div>
        </dl>
        {off > 0 && (
          <p className="mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-sili-50 px-2.5 py-1 text-xs font-semibold text-sili-600">
            <Tag className="size-3.5" aria-hidden /> {next!.dep.promo!.label}: save {peso(off)}
          </p>
        )}
        <div className="min-h-5 flex-1" aria-hidden />
        <div className="flex items-end justify-between gap-3 border-t border-line pt-4">
          <div>
            <PriceTag price={s.price - off} was={off ? s.price : undefined} unit={s.unit === 'person' ? 'person' : 'day'} />
            {pax > 0 && next && <p className="mt-1 text-xs text-ink-2 tnum">Total for {pax}: {peso((s.price - off) * pax)}</p>}
          </div>
          {next && (
            <Link
              to={datesLink}
              className="relative z-10 inline-flex h-10 shrink-0 items-center rounded-full bg-sili px-5 text-sm font-semibold text-white hover:bg-sili-600"
              aria-label={`Book ${s.name}, ${fmtDate(next.dep.startDate, { year: false })}`}
            >
              Book
            </Link>
          )}
        </div>
        {footer && <div className="relative z-10 mt-4 border-t border-line pt-3">{footer}</div>}
      </div>
    </article>
  )
}

/** Destination card: the place leads, with an honest note on whether a joiner tour runs there. */
export function DestinationCard({ dest, reason, footer }: { dest: Destination; reason?: string; footer?: React.ReactNode }) {
  const data = useCustomer((st) => st.data)
  const tourCount = catalogTours(data).filter((s) => s.destinationId === dest.id).length
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-[22px] bg-surface ring-1 ring-line transition-shadow hover:shadow-pop">
      <div className="relative">
        <Picture image={dest.image} className="aspect-[5/4]" labelAt="tl" imgClassName="transition-transform duration-500 group-hover:scale-[1.03]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/70 via-black/25 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white">
          <h3 className="type-head text-[28px]">
            <Link to={`/app/destinations/${dest.id}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">
              {dest.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-white/85">{dest.province}</p>
        </div>
        <SaveButton item={{ kind: 'destination', id: dest.id }} name={dest.name} className="absolute top-2.5 right-2.5 z-10" />
      </div>
      <div className="flex flex-1 flex-col p-5">
        <p className="text-sm text-ink">{dest.summary}</p>
        {reason && <Reason>{reason}</Reason>}
        <p className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-[13px] text-ink-2">
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden /> {dest.travelTime} by van
          </span>
          <span className={`font-semibold ${tourCount ? 'text-palay' : 'text-ink-2'}`}>{tourCount ? `${tourCount} joiner ${tourCount === 1 ? 'tour' : 'tours'}` : 'Custom trip only'}</span>
        </p>
        {footer && <div className="relative z-10 mt-4 border-t border-line pt-3">{footer}</div>}
      </div>
    </article>
  )
}
