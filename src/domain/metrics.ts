import { addDays, dateOf, DEMO_TODAY, weekday } from '../lib/demoClock'
import type { BookingStatus, Dataset, PaymentMethod } from '../seed/types'
import { assignableTargets, money, seatUse } from './rules'

// Report metric definitions (spec section 9). Every figure is a sum over records; nothing is stored.

export interface Period {
  from: string
  to: string
  label: string
}

export const PERIODS: Period[] = [
  { from: '2026-10-01', to: '2026-10-31', label: 'October 2026' },
  { from: '2026-09-01', to: '2026-09-30', label: 'September 2026' },
]

const inPeriod = (day: string, p: Period) => day >= p.from && day <= p.to
const STATUSES: BookingStatus[] = ['Pending', 'Confirmed', 'Completed', 'Cancelled']

/** Booking report: bookings whose travel starts in the period. Booking value excludes cancelled bookings. */
export function bookingReport(d: Dataset, p: Period, serviceId?: string) {
  const rows = d.bookings.filter((b) => inPeriod(b.startDate, p) && (!serviceId || b.serviceId === serviceId))
  const counts = Object.fromEntries(STATUSES.map((s) => [s, rows.filter((b) => b.status === s).length])) as Record<BookingStatus, number>
  const active = rows.filter((b) => b.status !== 'Cancelled')
  const byService = d.services
    .map((s) => {
      const r = rows.filter((b) => b.serviceId === s.id)
      const act = r.filter((b) => b.status !== 'Cancelled')
      return {
        service: s,
        bookings: r.length,
        pax: act.reduce((n, b) => n + b.pax, 0),
        value: act.reduce((n, b) => n + b.total, 0),
        ...(Object.fromEntries(STATUSES.map((st) => [st, r.filter((b) => b.status === st).length])) as Record<BookingStatus, number>),
      }
    })
    .filter((r) => r.bookings > 0)
    .sort((a, b) => b.value - a.value)
  return {
    total: rows.length,
    counts,
    value: active.reduce((n, b) => n + b.total, 0),
    pax: active.reduce((n, b) => n + b.pax, 0),
    byService,
    rows,
  }
}

/** Revenue report: verified collections dated by review date in the period. */
export function revenueReport(d: Dataset, p: Period, serviceId?: string) {
  const svcOf = (bookingId: string) => d.bookings.find((b) => b.id === bookingId)?.serviceId
  const verified = d.payments.filter(
    (x) => x.status === 'Verified' && x.reviewedAt && inPeriod(dateOf(x.reviewedAt), p) && (!serviceId || svcOf(x.bookingId) === serviceId),
  )
  const methods: PaymentMethod[] = ['GCash', 'Bank transfer', 'Maya', 'Cash']
  const byMethod = methods
    .map((m) => ({ method: m, amount: verified.filter((x) => x.method === m).reduce((n, x) => n + x.amount, 0), count: verified.filter((x) => x.method === m).length }))
    .filter((r) => r.count > 0)
  const byService = d.services
    .map((s) => ({ service: s, amount: verified.filter((x) => svcOf(x.bookingId) === s.id).reduce((n, x) => n + x.amount, 0) }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => b.amount - a.amount)
  return { collections: verified.reduce((n, x) => n + x.amount, 0), count: verified.length, byMethod, byService, rows: verified }
}

/** Tour performance: seat utilisation of departures that start in the period. Pending seats are shown as held. */
export function performanceReport(d: Dataset, p: Period, serviceId?: string) {
  const rows = d.departures
    .filter((dep) => inPeriod(dep.startDate, p) && (!serviceId || dep.serviceId === serviceId))
    .map((dep) => {
      const use = seatUse(dep.id, d.bookings)
      const filled = use.confirmed + use.completed
      return { departure: dep, service: d.services.find((s) => s.id === dep.serviceId)!, capacity: dep.capacity, filled, held: use.pending, rate: filled / dep.capacity }
    })
  const capacity = rows.reduce((n, r) => n + r.capacity, 0)
  const filled = rows.reduce((n, r) => n + r.filled, 0)
  return { rows, capacity, filled, held: rows.reduce((n, r) => n + r.held, 0), rate: capacity ? filled / capacity : 0 }
}

/** Sum of balances of Pending and Confirmed bookings, as of the demo date (not period-filtered). */
export function outstandingBalance(d: Dataset) {
  return d.bookings
    .filter((b) => b.status === 'Pending' || b.status === 'Confirmed')
    .reduce((n, b) => n + money(b, d.payments).balance, 0)
}

export function dashboard(d: Dataset) {
  const month = PERIODS[0]
  const toVerify = d.payments.filter((p) => p.status === 'Submitted')
  return {
    collections: revenueReport(d, month).collections,
    bookings: bookingReport(d, month),
    toVerify: toVerify.length,
    toVerifyAmount: toVerify.reduce((n, p) => n + p.amount, 0),
    outstanding: outstandingBalance(d),
    needsAssignment: assignableTargets(d).filter((t) => !t.assignment).length,
  }
}

/** Bookings created per week (Monday start), from the first seeded week to the demo week. */
export function bookingsPerWeek(d: Dataset) {
  const first = d.bookings.map((b) => dateOf(b.createdAt)).sort()[0] ?? DEMO_TODAY
  let start = addDays(first, -((weekday(first) + 6) % 7))
  const weeks: { start: string; count: number }[] = []
  while (start <= DEMO_TODAY) {
    const end = addDays(start, 6)
    weeks.push({ start, count: d.bookings.filter((b) => dateOf(b.createdAt) >= start && dateOf(b.createdAt) <= end).length })
    start = addDays(start, 7)
  }
  return weeks
}

export function statusCounts(d: Dataset) {
  return Object.fromEntries(STATUSES.map((s) => [s, d.bookings.filter((b) => b.status === s).length])) as Record<BookingStatus, number>
}
