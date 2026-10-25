import { addDays, daysBetween, DEMO_TODAY, dateOf, overlaps } from '../lib/demoClock'
import type { Assignment, Block, Booking, Dataset, Departure, Driver, Payment, PaymentSummary, Service, Vehicle } from '../seed/types'

// Business rules R1–R14 from the spec. All functions are pure so screens, dashboard and reports agree.

export const DOWN_PAYMENT_RATE = 0.5
export const BALANCE_DUE_DAYS_BEFORE = 3
export const BOOKING_CUTOFF_DAYS = 2
export const VAN_RENTAL_MAX_PAX = 12

/** R7: 50% of the total, rounded up to the peso. */
export const downPayment = (total: number) => Math.ceil(total * DOWN_PAYMENT_RATE)
export const balanceDueDate = (startDate: string) => addDays(startDate, -BALANCE_DUE_DAYS_BEFORE)

/** R3: a promo applies when the booking is created on or before its book-by date. */
export function promoFor(dep: Departure | undefined, createdDate: string) {
  if (!dep?.promo) return 0
  return createdDate <= dep.promo.bookBy ? dep.promo.amountOff : 0
}

/** R2: price per person minus promo, times pax. */
export function tourTotal(service: Service, dep: Departure, pax: number, createdDate = DEMO_TODAY) {
  const promoOff = promoFor(dep, createdDate)
  return { unitPrice: service.price, promoOff, total: (service.price - promoOff) * pax }
}

/** R2: van rental is priced per day, inclusive of both dates. */
export const rentalDays = (start: string, end: string) => daysBetween(start, end) + 1
export const rentalTotal = (service: Service, start: string, end: string) => service.price * rentalDays(start, end)

/** R4/R5: seats held by Pending and Confirmed bookings, and seats used by Completed ones. */
export function seatUse(depId: string, bookings: Booking[]) {
  let held = 0
  let confirmed = 0
  let pending = 0
  let completed = 0
  for (const b of bookings) {
    if (b.departureId !== depId) continue
    if (b.status === 'Confirmed') confirmed += b.pax
    if (b.status === 'Pending') pending += b.pax
    if (b.status === 'Completed') completed += b.pax
  }
  held = confirmed + pending
  return { held, confirmed, pending, completed }
}

export type DepartureState = 'open' | 'full' | 'closed' | 'past'

export function departureAvailability(dep: Departure, bookings: Booking[], today = DEMO_TODAY) {
  const use = seatUse(dep.id, bookings)
  const left = Math.max(0, dep.capacity - use.held - use.completed)
  let state: DepartureState = 'open'
  if (dep.startDate < today) state = 'past'
  else if (left === 0) state = 'full'
  else if (daysBetween(today, dep.startDate) <= BOOKING_CUTOFF_DAYS) state = 'closed' // R6
  return { ...use, left, state }
}

/** Only Verified payments count as paid (R8). */
export function amountPaid(bookingId: string, payments: Payment[]) {
  return payments.filter((p) => p.bookingId === bookingId && p.status === 'Verified').reduce((s, p) => s + p.amount, 0)
}

export function money(b: Booking, payments: Payment[]) {
  const paid = amountPaid(b.id, payments)
  const balance = b.status === 'Cancelled' ? 0 : Math.max(0, b.total - paid)
  const summary: PaymentSummary = paid >= b.total ? 'Fully paid' : paid > 0 ? 'Partially paid' : 'Unpaid'
  const submitted = payments.filter((p) => p.bookingId === b.id && p.status === 'Submitted')
  const lastRejected = payments.filter((p) => p.bookingId === b.id && p.status === 'Rejected').at(-1)
  return { paid, balance, summary, submitted, lastRejected, down: downPayment(b.total), dueDate: balanceDueDate(b.startDate) }
}

/** R9: confirm only a Pending booking whose verified payments reach the down payment. */
export function canConfirm(b: Booking, payments: Payment[]) {
  if (b.status !== 'Pending') return { ok: false, reason: `Booking is already ${b.status.toLowerCase()}.` }
  if (amountPaid(b.id, payments) < downPayment(b.total)) return { ok: false, reason: 'Unlocks when at least 50% is verified.' }
  return { ok: true, reason: '' }
}

/** R11: cancel Pending or Confirmed bookings before the travel date. */
export function canCancel(b: Booking, today = DEMO_TODAY) {
  if (b.status !== 'Pending' && b.status !== 'Confirmed') return { ok: false, reason: `A ${b.status.toLowerCase()} booking cannot be cancelled.` }
  if (b.startDate <= today) return { ok: false, reason: 'The trip has already started.' }
  return { ok: true, reason: '' }
}

/** Which payment amounts a customer may submit next (R7). */
export function payableOptions(b: Booking, payments: Payment[]) {
  const { paid, balance, submitted, down } = money(b, payments)
  if (b.status === 'Cancelled' || b.status === 'Completed' || balance === 0 || submitted.length > 0) return []
  if (paid === 0) return [
    { type: 'Down payment' as const, amount: down },
    { type: 'Full' as const, amount: b.total },
  ]
  return [{ type: 'Balance' as const, amount: balance }]
}

// ---------- Resources (R10) ----------

export interface AssignTarget {
  kind: 'departure' | 'booking'
  id: string
  from: string
  to: string
  pax: number
  label: string
}

/** Trips that can take a van and driver: departures with confirmed seats, and confirmed van rentals. */
export function assignableTargets(d: Dataset, today = DEMO_TODAY): (AssignTarget & { assignment?: Assignment })[] {
  const out: (AssignTarget & { assignment?: Assignment })[] = []
  for (const dep of d.departures) {
    if (dep.endDate < today) continue
    const use = seatUse(dep.id, d.bookings)
    if (use.confirmed === 0) continue
    const svc = d.services.find((s) => s.id === dep.serviceId)!
    out.push({
      kind: 'departure', id: dep.id, from: dep.startDate, to: dep.endDate, pax: use.held, label: svc.name,
      assignment: d.assignments.find((a) => a.target.kind === 'departure' && a.target.id === dep.id),
    })
  }
  for (const b of d.bookings) {
    if (b.departureId || b.status !== 'Confirmed' || b.endDate < today) continue
    out.push({
      kind: 'booking', id: b.id, from: b.startDate, to: b.endDate, pax: b.pax, label: b.serviceId === 'SVC-CUSTOM' ? `${b.label ?? 'Custom trip'} · ${b.contactName}` : `Van rental · ${b.contactName}`,
      assignment: d.assignments.find((a) => a.target.kind === 'booking' && a.target.id === b.id),
    })
  }
  return out.sort((a, b) => a.from.localeCompare(b.from))
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const shortDate = (s: string) => `${MON[+s.slice(5, 7) - 1]} ${+s.slice(8, 10)}`
/** 'Oct 17', 'Oct 17–18' or 'Oct 31–Nov 1'. */
export function shortRange(from: string, to: string) {
  if (from === to) return shortDate(from)
  return from.slice(0, 7) === to.slice(0, 7) ? `${shortDate(from)}\u2013${+to.slice(8, 10)}` : `${shortDate(from)}\u2013${shortDate(to)}`
}

/** Last day a block keeps a van out. Open maintenance runs on past its end date until staff confirm it is done. */
export const blockEnd = (b: Block, today = DEMO_TODAY) => (b.untilDone && b.to < today ? today : b.to)
export const blockOverlaps = (b: Block, from: string, to: string) => overlaps(b.from, blockEnd(b), from, to)

/** Why a van cannot take this trip, or null when it can. */
export function vehicleConflict(d: Dataset, v: Vehicle, t: AssignTarget): string | null {
  if (v.seats < t.pax) return `Only ${v.seats} seats for ${t.pax} passengers`
  for (const blk of v.blocks) {
    if (blockOverlaps(blk, t.from, t.to)) {
      return blk.kind === 'maintenance'
        ? blk.untilDone && blk.to < DEMO_TODAY ? 'Maintenance overdue, not yet confirmed done' : `In maintenance ${shortRange(blk.from, blk.to)}`
        : `Unavailable until ${shortDate(blk.to)}`
    }
  }
  const clash = d.assignments.find(
    (a) => a.vehicleId === v.id && !(a.target.kind === t.kind && a.target.id === t.id) && overlaps(a.from, a.to, t.from, t.to),
  )
  return clash ? `Assigned to ${clash.target.id} · ${shortRange(clash.from, clash.to)}` : null
}

/** Why a driver cannot take this trip, or null when they can. */
export function driverConflict(d: Dataset, dr: Driver, t: AssignTarget): string | null {
  for (const blk of dr.blocks) {
    if (overlaps(blk.from, blk.to, t.from, t.to)) return `${blk.note} ${shortRange(blk.from, blk.to)}`
  }
  const clash = d.assignments.find(
    (a) => a.driverId === dr.id && !(a.target.kind === t.kind && a.target.id === t.id) && overlaps(a.from, a.to, t.from, t.to),
  )
  return clash ? `Assigned to ${clash.target.id} · ${shortRange(clash.from, clash.to)}` : null
}

/** Current status of a van on a given day, for the fleet lists. */
export function vehicleStatusOn(d: Dataset, v: Vehicle, day = DEMO_TODAY) {
  const blk = v.blocks.find((b) => blockOverlaps(b, day, day))
  if (blk) return blk.kind === 'maintenance' ? 'Maintenance' : 'Unavailable'
  return d.assignments.some((a) => a.vehicleId === v.id && overlaps(a.from, a.to, day, day)) ? 'On a trip' : 'Available'
}

export function nextAssignment(d: Dataset, resource: { vehicleId?: string; driverId?: string }, day = DEMO_TODAY) {
  return d.assignments
    .filter((a) => (resource.vehicleId ? a.vehicleId === resource.vehicleId : a.driverId === resource.driverId) && a.to >= day)
    .sort((a, b) => a.from.localeCompare(b.from))[0]
}

export const createdDate = (b: Booking) => dateOf(b.createdAt)
