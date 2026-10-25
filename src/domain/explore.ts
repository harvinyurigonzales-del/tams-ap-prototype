import type { Dataset, Interest } from '../seed/types'
import { departureInWindow, moodById } from './moods'
import { bookableDeparture, catalogTours, fromPrice } from './recommend'
import { ratingFor } from './reviews'
import { departureAvailability, promoFor } from './rules'
import { DEMO_TODAY } from '../lib/demoClock'

// Filters for the merged Explore page. Tours and destinations share one filter bar, so both read the same
// filter object; fields that only make sense for tours (price, open dates, date and travellers) are ignored
// for destinations.

export interface ExploreFilter {
  q: string
  /** Destination id, tours only. */
  dest: string
  price: 'any' | '2000' | '3000' | '5000'
  dur: 'any' | 'day' | 'short' | 'long'
  mood: string
  /** Older links used ?interest=…; still honoured. */
  interest: string
  open: boolean
  /** Earliest departure date (YYYY-MM-DD) from the home search. */
  from: string
  /** Travellers who need seats, from the home search. */
  pax: number
  /** Only departures with a promo running. */
  promo: boolean
  sort: SortKey
}

export const SORTS = { recommended: 'Recommended', rating: 'Top rated', soonest: 'Leaving soonest', 'price-asc': 'Price: low to high', 'price-desc': 'Price: high to low' } as const
export type SortKey = keyof typeof SORTS

export const EMPTY_FILTER: ExploreFilter = { q: '', dest: '', price: 'any', dur: 'any', mood: '', interest: '', open: false, from: '', pax: 0, promo: false, sort: 'recommended' }

export const DURATIONS = { any: 'Any length', day: 'Day trip', short: '2–3 days', long: '4+ days' } as const
export const PRICES = { any: 'Any price', '2000': 'Up to ₱2,000', '3000': 'Up to ₱3,000', '5000': 'Up to ₱5,000' } as const

const lengthOk = (days: number, dur: ExploreFilter['dur']) =>
  dur === 'any' || (dur === 'day' ? days === 1 : dur === 'short' ? days >= 2 && days <= 3 : days >= 4)

export function filterTours(d: Dataset, f: ExploreFilter) {
  const needle = f.q.trim().toLowerCase()
  const mood = moodById(f.mood)
  const windowed = !!f.from || f.pax > 0
  const list = catalogTours(d).filter((s) => {
    const dest = d.destinations.find((x) => x.id === s.destinationId)
    if (needle && !`${s.name} ${s.destination} ${dest?.name ?? ''} ${dest?.province ?? ''} ${(s.interests ?? []).join(' ')}`.toLowerCase().includes(needle)) return false
    if (f.dest && s.destinationId !== f.dest) return false
    if (f.price !== 'any' && fromPrice(d, s) > Number(f.price)) return false
    if (!lengthOk(s.days, f.dur)) return false
    if (mood && !mood.tour(s)) return false
    if (f.interest && !(s.interests ?? []).includes(f.interest as Interest)) return false
    if (f.open && !bookableDeparture(d, s.id)) return false
    if (windowed && !departureInWindow(d, s.id, { from: f.from, pax: f.pax })) return false
    if (f.promo && !hasPromo(d, s.id)) return false
    return true
  })
  const closed = (s: (typeof list)[number]) => Number(!bookableDeparture(d, s.id))
  const next = (s: (typeof list)[number]) => bookableDeparture(d, s.id)?.dep.startDate ?? '9999'
  const rating = (s: (typeof list)[number]) => ratingFor(d, s.id)
  // Bookable tours always come first, so unavailable tours never crowd out the ones you can book.
  return list.sort((a, b) => {
    const open = closed(a) - closed(b)
    if (open) return open
    switch (f.sort) {
      case 'rating':
        return rating(b).avg - rating(a).avg || rating(b).count - rating(a).count
      case 'soonest':
        return next(a).localeCompare(next(b))
      case 'price-desc':
        return fromPrice(d, b) - fromPrice(d, a)
      case 'price-asc':
        return fromPrice(d, a) - fromPrice(d, b)
      default:
        // Recommended: well-rated trips leaving soon, nudged by any promo.
        return score(d, b) - score(d, a)
    }
  })
}

/** A promo is running on a departure that can still be booked. */
export const hasPromo = (d: Dataset, serviceId: string) =>
  d.departures.some((x) => x.serviceId === serviceId && promoFor(x, DEMO_TODAY) > 0 && departureAvailability(x, d.bookings, DEMO_TODAY).state === 'open')

function score(d: Dataset, s: { id: string; price: number }) {
  const r = ratingFor(d, s.id)
  const dep = bookableDeparture(d, s.id)
  const days = dep ? (Date.parse(dep.dep.startDate) - Date.parse(DEMO_TODAY)) / 86_400_000 : 99
  return r.avg * 2 + Math.min(r.count, 8) * 0.1 - days * 0.03 + (dep && promoFor(dep.dep, DEMO_TODAY) > 0 ? 0.6 : 0)
}

export function filterDestinations(d: Dataset, f: ExploreFilter) {
  const needle = f.q.trim().toLowerCase()
  const mood = moodById(f.mood)
  return d.destinations.filter((x) => {
    if (needle && !`${x.name} ${x.province} ${x.summary} ${x.interests.join(' ')}`.toLowerCase().includes(needle)) return false
    if (f.dest && x.id !== f.dest) return false
    if (!lengthOk(x.suggestedDays, f.dur)) return false
    if (mood && !mood.destination(x)) return false
    if (f.interest && !x.interests.includes(f.interest as Interest)) return false
    return true
  })
}

/** Reads the filter from URL search params, ignoring values that are not valid options. */
export function filterFromParams(p: URLSearchParams): ExploreFilter {
  const price = p.get('price') ?? 'any'
  const dur = p.get('duration') ?? 'any'
  const pax = Number(p.get('pax') ?? 0)
  const from = p.get('from') ?? ''
  return {
    q: p.get('q') ?? '',
    dest: p.get('destination') ?? '',
    price: price in PRICES ? (price as ExploreFilter['price']) : 'any',
    dur: dur in DURATIONS ? (dur as ExploreFilter['dur']) : 'any',
    mood: moodById(p.get('mood')) ? p.get('mood')! : '',
    interest: p.get('interest') ?? '',
    open: p.get('open') === '1',
    from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : '',
    pax: Number.isInteger(pax) && pax > 0 && pax <= 12 ? pax : 0,
    promo: p.get('promo') === '1',
    sort: (p.get('sort') ?? '') in SORTS ? (p.get('sort') as SortKey) : 'recommended',
  }
}
