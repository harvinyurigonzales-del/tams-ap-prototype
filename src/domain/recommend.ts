import { DEMO_TODAY } from '../lib/demoClock'
import { peso } from '../lib/format'
import type { Dataset, Destination, Interest, SavedItem, Service, TravelPreferences } from '../seed/types'
import { isOffered } from './packages'
import { departureAvailability, promoFor } from './rules'

// Simulated recommendations: deterministic, content-based scoring over the sample catalog. No machine
// learning and no data leaves the browser. Every item carries the reason it was picked, and history-based
// rows only appear when the active customer really has that history in the demo data.

export type RecKind = 'tour' | 'destination'
export interface RecItem {
  kind: RecKind
  id: string
  reason: string
}
export interface RecRow {
  id: 'continue' | 'history' | 'interests' | 'budget' | 'departures' | 'destinations'
  title: string
  items: RecItem[]
}

export interface RecContext {
  customerId: string | null
  prefs?: TravelPreferences
  saved: SavedItem[]
  /** Keys like 'tour:SVC-BAG' viewed in this session, most recent first. */
  viewed: string[]
  /** Keys dismissed with "Not interested" in this session. */
  dismissed: string[]
}

export const recKey = (kind: RecKind, id: string) => `${kind}:${id}`
const MAX_PER_ROW = 6

/** The soonest departure of a tour that can be booked online today, if any. */
export function bookableDeparture(d: Dataset, serviceId: string, today = DEMO_TODAY) {
  return d.departures
    .filter((x) => x.serviceId === serviceId)
    .map((dep) => ({ dep, avail: departureAvailability(dep, d.bookings, today) }))
    .filter((x) => x.avail.state === 'open')
    .sort((a, b) => a.dep.startDate.localeCompare(b.dep.startDate))[0]
}

/** Active tours, the ones customers can find. Recommendations only offer the ones with an open departure. */
export const catalogTours = (d: Dataset) => d.services.filter(isOffered)

const durationOk = (days: number, pref: TravelPreferences['duration']) =>
  pref === 'Any' || (pref === 'Day trip' ? days === 1 : pref === 'Weekend (2–3 days)' ? days >= 2 && days <= 3 : days >= 4)

const listAnd = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`)

/** Lowest per-person price on the next bookable departure, after any promo. */
export function fromPrice(d: Dataset, s: Service, today = DEMO_TODAY) {
  const dep = bookableDeparture(d, s.id, today)
  return s.price - (dep ? promoFor(dep.dep, today) : 0)
}

export interface Score {
  score: number
  matched: Interest[]
  withinBudget: boolean
  durationMatch: boolean
}

/** Content score of a tour against preferences: shared interests count most, then budget and length. */
export function scoreTour(d: Dataset, s: Service, prefs: TravelPreferences, today = DEMO_TODAY): Score {
  const matched = (s.interests ?? []).filter((i) => prefs.interests.includes(i))
  const price = fromPrice(d, s, today)
  const withinBudget = prefs.budgetMax > 0 && price <= prefs.budgetMax
  const durationMatch = prefs.duration !== 'Any' && durationOk(s.days, prefs.duration)
  let score = matched.length * 3 + (withinBudget ? 2 : 0) + (durationMatch ? 2 : 0)
  if (prefs.style === 'Joiner tour') score += 1
  if (prefs.budgetMax > 0 && !withinBudget) score -= 2
  if (prefs.duration !== 'Any' && !durationMatch) score -= 1
  return { score, matched, withinBudget, durationMatch }
}

export function scoreDestination(dest: Destination, prefs: TravelPreferences): Score {
  const matched = dest.interests.filter((i) => prefs.interests.includes(i))
  const durationMatch = prefs.duration !== 'Any' && durationOk(dest.suggestedDays, prefs.duration)
  let score = matched.length * 3 + (durationMatch ? 1 : 0)
  if (prefs.style === 'Private or custom') score += 1
  return { score, matched, withinBudget: false, durationMatch }
}

function tourReason(sc: Score, prefs: TravelPreferences) {
  const parts: string[] = []
  if (sc.matched.length) parts.push(`Matches ${listAnd(sc.matched)}`)
  if (sc.withinBudget) parts.push(`within your ${peso(prefs.budgetMax)} budget`)
  if (sc.durationMatch) parts.push(prefs.duration === 'Day trip' ? 'a day trip' : `fits a ${prefs.duration.toLowerCase().replace(/ \(.*\)/, '')}`)
  return parts.length ? parts.join(' · ') : 'Open seats on an upcoming date'
}

const stable = <T extends { id: string }>(a: T & { s: number }, b: T & { s: number }) => b.s - a.s || a.id.localeCompare(b.id)

/**
 * Builds the recommendation rows for the home screen. Pure function of the dataset and context, so the
 * same inputs always give the same rows. Items never repeat across rows and dismissed items are skipped.
 */
export function recommendationRows(d: Dataset, ctx: RecContext, today = DEMO_TODAY): RecRow[] {
  const used = new Set(ctx.dismissed)
  const rows: RecRow[] = []
  const take = (row: RecRow) => {
    const items = row.items.filter((i) => !used.has(recKey(i.kind, i.id))).slice(0, MAX_PER_ROW)
    items.forEach((i) => used.add(recKey(i.kind, i.id)))
    if (items.length) rows.push({ ...row, items })
  }
  const tourOk = (id: string) => catalogTours(d).some((s) => s.id === id) && !!bookableDeparture(d, id, today)
  const destOk = (id: string) => d.destinations.some((x) => x.id === id)

  // 1. Continue planning: what the customer saved or opened in this session.
  if (ctx.customerId || ctx.viewed.length) {
    const items: RecItem[] = []
    for (const s of ctx.saved) {
      if (s.kind === 'tour' ? tourOk(s.id) : destOk(s.id)) items.push({ kind: s.kind, id: s.id, reason: 'You saved this' })
    }
    for (const key of ctx.viewed) {
      const [kind, id] = key.split(':') as [RecKind, string]
      if (items.some((i) => i.kind === kind && i.id === id)) continue
      if (kind === 'tour' ? tourOk(id) : destOk(id)) items.push({ kind, id, reason: 'You viewed this earlier' })
    }
    take({ id: 'continue', title: 'Pick up where you left off', items })
  }

  // 2. Based on a completed trip. Only real completed bookings of the active customer count.
  const lastTrip = ctx.customerId
    ? d.bookings
        .filter((b) => b.customerId === ctx.customerId && b.status === 'Completed')
        .sort((a, b) => b.endDate.localeCompare(a.endDate))
        .map((b) => d.services.find((s) => s.id === b.serviceId))
        .find((s) => s?.destinationId)
    : undefined
  if (lastTrip) {
    const from = d.destinations.find((x) => x.id === lastTrip.destinationId)!
    const items = catalogTours(d)
      .filter((s) => s.destinationId !== from.id && tourOk(s.id))
      .map((s) => ({ s, shared: (s.interests ?? []).filter((i) => from.interests.includes(i)) }))
      .filter((x) => x.shared.length > 0)
      .map((x) => ({ id: x.s.id, s: x.shared.length, shared: x.shared }))
      .sort(stable)
      .map<RecItem>((x) => ({ kind: 'tour', id: x.id, reason: `Like your ${from.name} trip: ${listAnd(x.shared.slice(0, 2))}` }))
    take({ id: 'history', title: `Because you went to ${from.name}`, items })
  }

  // 3. Preferences. Only shown when the customer has set at least one preference.
  const prefs = ctx.prefs
  const hasPrefs = !!prefs && (prefs.interests.length > 0 || prefs.budgetMax > 0 || prefs.duration !== 'Any' || prefs.style !== 'Any')
  if (prefs && hasPrefs) {
    const tours = catalogTours(d)
      .filter((s) => tourOk(s.id))
      .map((s) => ({ id: s.id, svc: s, sc: scoreTour(d, s, prefs, today) }))
      .map((x) => ({ ...x, s: x.sc.score }))
    const dests = d.destinations.map((x) => ({ id: x.id, dest: x, sc: scoreDestination(x, prefs) })).map((x) => ({ ...x, s: x.sc.score }))
    const matchItems: RecItem[] = [
      ...tours
        .filter((x) => x.sc.matched.length > 0)
        .sort(stable)
        .map<RecItem>((x) => ({ kind: 'tour', id: x.id, reason: tourReason(x.sc, prefs) })),
      ...dests
        .filter((x) => x.sc.matched.length > 0)
        .sort(stable)
        .map<RecItem>((x) => ({
          kind: 'destination',
          id: x.id,
          reason: `Matches ${listAnd(x.sc.matched)}${prefs.style === 'Private or custom' ? ' · plan it as a custom trip' : ''}`,
        })),
    ]
    // Tours first when the customer prefers joiner tours, destinations first for private or custom trips.
    if (prefs.style === 'Private or custom') matchItems.sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'destination' ? -1 : 1))
    take({ id: 'interests', title: prefs.interests.length ? `Because you like ${listAnd(prefs.interests.slice(0, 3).map((i) => i.toLowerCase()))}` : 'Matches your preferences', items: matchItems })
    if (prefs.budgetMax > 0) {
      const items = tours
        .filter((x) => x.sc.withinBudget)
        .sort((a, b) => fromPrice(d, a.svc, today) - fromPrice(d, b.svc, today) || a.id.localeCompare(b.id))
        .map<RecItem>((x) => ({ kind: 'tour', id: x.id, reason: `From ${peso(fromPrice(d, x.svc, today))} per person` }))
      take({ id: 'budget', title: `Within your ${peso(prefs.budgetMax)} budget`, items })
    }
  }

  // 4. Fallbacks everyone sees: soonest open departures, then destinations to explore.
  const departures = catalogTours(d)
    .map((s) => ({ s, next: bookableDeparture(d, s.id, today) }))
    .filter((x) => x.next)
    .sort((a, b) => a.next!.dep.startDate.localeCompare(b.next!.dep.startDate) || a.s.id.localeCompare(b.s.id))
    .map<RecItem>((x) => ({ kind: 'tour', id: x.s.id, reason: `Next departure ${shortDay(x.next!.dep.startDate)} · ${x.next!.avail.left} seats left` }))
  take({ id: 'departures', title: 'Leaving soon, with seats left', items: departures })
  const destinations = d.destinations.map<RecItem>((x) => ({
    kind: 'destination',
    id: x.id,
    reason: catalogTours(d).some((s) => s.destinationId === x.id && tourOk(s.id)) ? 'Tours with open dates' : 'Plan it as a custom trip',
  }))
  take({ id: 'destinations', title: 'Places worth planning for', items: destinations })
  return rows
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDay = (s: string) => `${MON[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`

export interface PersonalPicks {
  /** Active tours with an open date only, best match first. */
  items: RecItem[]
  /** Why these trips, in one sentence. */
  basis: string
  /** True when the picks follow the customer's own preferences or trips, not just what leaves soon. */
  personal: boolean
}

/**
 * "Mga trip na bagay sa'yo": the tours that fit this customer best, shown first on Home. Preferences decide when
 * they are set; otherwise saved and viewed trips and the last completed trip; otherwise what is leaving soon.
 */
export function personalPicks(d: Dataset, ctx: RecContext, today = DEMO_TODAY): PersonalPicks {
  const hidden = new Set(ctx.dismissed)
  const open = catalogTours(d).filter((s) => !!bookableDeparture(d, s.id, today) && !hidden.has(recKey('tour', s.id)))
  const prefs = ctx.prefs
  const hasPrefs = !!prefs && (prefs.interests.length > 0 || prefs.budgetMax > 0 || prefs.duration !== 'Any' || prefs.style !== 'Any')
  if (prefs && hasPrefs) {
    const items = open
      .map((s) => ({ id: s.id, sc: scoreTour(d, s, prefs, today) }))
      .map((x) => ({ ...x, s: x.sc.score }))
      .filter((x) => x.sc.matched.length > 0 || x.sc.withinBudget || x.sc.durationMatch)
      .sort(stable)
      .slice(0, MAX_PER_ROW)
      .map<RecItem>((x) => ({ kind: 'tour', id: x.id, reason: tourReason(x.sc, prefs) }))
    const parts = [
      prefs.interests.length ? `you like ${listAnd(prefs.interests.slice(0, 3).map((i) => i.toLowerCase()))}` : '',
      prefs.budgetMax > 0 ? `your budget is up to ${peso(prefs.budgetMax)} per person` : '',
      prefs.duration !== 'Any' ? `you prefer ${prefs.duration.toLowerCase().replace(/ \(.*\)/, '')} trips` : '',
    ].filter(Boolean)
    if (items.length) return { items, basis: `Picked because ${listAnd(parts)}.`, personal: true }
  }
  // Interests of what the customer saved, viewed or travelled on.
  const signals = [
    ...ctx.saved.filter((s) => s.kind === 'tour').map((s) => s.id),
    ...ctx.viewed.filter((k) => k.startsWith('tour:')).map((k) => k.slice(5)),
    ...d.bookings.filter((b) => ctx.customerId && b.customerId === ctx.customerId && b.status === 'Completed').map((b) => b.serviceId),
  ]
  const liked = new Set(signals.flatMap((id) => d.services.find((s) => s.id === id)?.interests ?? []))
  if (liked.size) {
    const items = open
      .filter((s) => !signals.includes(s.id))
      .map((s) => ({ id: s.id, shared: (s.interests ?? []).filter((i) => liked.has(i)) }))
      .filter((x) => x.shared.length > 0)
      .map((x) => ({ ...x, s: x.shared.length }))
      .sort(stable)
      .slice(0, MAX_PER_ROW)
      .map<RecItem>((x) => ({ kind: 'tour', id: x.id, reason: `Like trips you looked at: ${listAnd(x.shared.slice(0, 2))}` }))
    if (items.length) return { items, basis: 'Picked from the trips you saved, viewed or took. Set your preferences to sharpen these.', personal: true }
  }
  const items = open
    .map((s) => ({ s, next: bookableDeparture(d, s.id, today)! }))
    .sort((a, b) => a.next.dep.startDate.localeCompare(b.next.dep.startDate) || a.s.id.localeCompare(b.s.id))
    .slice(0, MAX_PER_ROW)
    .map<RecItem>((x) => ({ kind: 'tour', id: x.s.id, reason: `Next departure ${shortDay(x.next.dep.startDate)} · ${x.next.avail.left} seats left` }))
  return { items, basis: 'Trips leaving soon with seats left. Tell us what you like and these will follow your answers.', personal: false }
}
