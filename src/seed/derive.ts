import { buildPlan, requestDates, sampleAnswers, toPlannedTrip } from '../domain/planner/engine'
import { draftCustomProposal } from '../domain/requests'
import { driverConflict, seatUse, vehicleConflict, type AssignTarget } from '../domain/rules'
import { addDays, DEMO_TODAY, SEED_SHIFT_DAYS, SEED_SHIFT_MONTHS } from '../lib/demoClock'
import { normalize } from '../state/migrate'
import { canonical } from './canonical'
import { addSeasonal } from './seasonal'
import { expandDataset } from './expand'
import { shiftDataset } from './shift'
import type { CustomRequest, Dataset, Driver, Vehicle } from './types'

/** The sample customer whose journey is played live. She starts with a profile and nothing else. */
export const MARIA_ID = 'CUS-0001'

export interface MaintenanceRecord {
  id: string
  vehicleId: string
  type: string
  from: string
  to: string
  note: string
  status: MaintenanceStatus
  /** Workshop or person doing the work. */
  provider?: string
  /** Estimated cost while open; the actual cost once completed. */
  cost?: number
  startedAt?: string
  /** When staff confirmed the work was finished, and the day it actually finished. */
  doneAt?: string
  completedOn?: string
  doneNote?: string
  cancelledAt?: string
  cancelReason?: string
}

/** Overdue is not a status: it is worked out from the dates (domain/fleet.ts). */
export type MaintenanceStatus = 'Scheduled' | 'In Maintenance' | 'Completed' | 'Cancelled'

const VAN_EXTRAS: Record<string, Pick<Vehicle, 'color' | 'odometer'>> = {
  'VAN-01': { color: 'White', odometer: 38450 }, 'VAN-02': { color: 'Silver', odometer: 52120 }, 'VAN-03': { color: 'Black', odometer: 29870 },
  'VAN-04': { color: 'White', odometer: 61300 }, 'VAN-05': { color: 'White', odometer: 74880 }, 'VAN-06': { color: 'Gray', odometer: 45210 },
}
const DRIVER_EXTRAS: Record<string, Pick<Driver, 'license' | 'licenseExpiry' | 'since'>> = {
  'DRV-01': { license: 'N01-18-004521', licenseExpiry: '2028-04-12', since: '2019-02-01' },
  'DRV-02': { license: 'N03-17-112094', licenseExpiry: '2027-08-30', since: '2020-07-15' },
  'DRV-03': { license: 'N02-20-087713', licenseExpiry: '2026-12-05', since: '2021-03-10' },
  'DRV-04': { license: 'N01-19-230118', licenseExpiry: '2029-01-22', since: '2022-05-01' },
  'DRV-05': { license: 'N04-21-045067', licenseExpiry: '2027-11-18', since: '2023-09-04' },
}

/**
 * Removes one customer's activity and everything that hangs off it: bookings with their payments and van
 * assignments, requests, reviews, conversations, notifications, saved items and preferences. The profile stays.
 */
export function removeCustomerRecords(d: Dataset, customerId: string) {
  const bookingIds = new Set(d.bookings.filter((b) => b.customerId === customerId).map((b) => b.id))
  const requestIds = new Set([...d.customRequests, ...d.rentalRequests].filter((r) => r.customerId === customerId).map((r) => r.id))
  d.bookings = d.bookings.filter((b) => !bookingIds.has(b.id))
  d.payments = d.payments.filter((p) => !bookingIds.has(p.bookingId))
  d.refunds = (d.refunds ?? []).filter((r) => !bookingIds.has(r.bookingId))
  d.previews = (d.previews ?? []).filter((p) => !bookingIds.has(p.bookingId))
  d.drafts = (d.drafts ?? []).filter((x) => x.customerId !== customerId)
  d.customRequests = d.customRequests.filter((r) => r.customerId !== customerId)
  d.rentalRequests = d.rentalRequests.filter((r) => r.customerId !== customerId)
  d.reviews = d.reviews.filter((r) => r.customerId !== customerId && !(r.bookingId && bookingIds.has(r.bookingId)))
  d.inquiries = d.inquiries.filter((q) => q.customerId !== customerId)
  const mentions = (text?: string) => !!text && [...bookingIds, ...requestIds].some((id) => text.includes(id))
  d.notifications = d.notifications.filter((n) => n.customerId !== customerId && n.about !== customerId && !n.scenario && !mentions(n.link))
  // A rental's own van goes with it; a departure keeps its van only while someone else is still on it.
  d.assignments = d.assignments.filter((a) => {
    if (a.target.kind === 'booking') return !bookingIds.has(a.target.id)
    const use = seatUse(a.target.id, d.bookings)
    return use.confirmed + use.pending + use.completed > 0
  })
  const { [customerId]: _saved, ...saved } = d.saved
  const { [customerId]: _prefs, ...preferences } = d.preferences
  d.saved = saved
  d.preferences = preferences
}

/** Gives a van and driver to the generated trips that have none, without double-booking anyone. */
function assignGenerated(d: Dataset, generated: Set<string>) {
  const targets: AssignTarget[] = []
  for (const dep of d.departures) {
    const list = d.bookings.filter((b) => b.departureId === dep.id && (b.status === 'Confirmed' || b.status === 'Completed' || b.status === 'Pending'))
    if (!list.length || !list.every((b) => generated.has(b.id)) || !list.some((b) => b.status !== 'Pending')) continue
    if (d.assignments.some((a) => a.target.kind === 'departure' && a.target.id === dep.id)) continue
    targets.push({ kind: 'departure', id: dep.id, from: dep.startDate, to: dep.endDate, pax: list.reduce((n, b) => n + b.pax, 0), label: dep.serviceId })
  }
  for (const b of d.bookings) {
    if (b.departureId || !generated.has(b.id) || (b.status !== 'Confirmed' && b.status !== 'Completed')) continue
    targets.push({ kind: 'booking', id: b.id, from: b.startDate, to: b.endDate, pax: b.pax, label: b.label ?? b.id })
  }
  targets.sort((a, b) => a.from.localeCompare(b.from))
  let upcoming = 0
  let turn = 0
  for (const t of targets) {
    // Leave every fourth upcoming trip for staff to assign, so the "needs a van" queue is realistic.
    if (t.from >= DEMO_TODAY && upcoming++ % 4 === 3) continue
    const vans = d.vehicles.filter((v) => !vehicleConflict(d, v, t))
    const drivers = d.drivers.filter((x) => !driverConflict(d, x, t))
    if (!vans.length || !drivers.length) continue
    turn += 1
    const v = vans[turn % vans.length]
    const dr = drivers[(turn * 2) % drivers.length]
    d.assignments.push({ id: `ASG-${String(d.next.assignment).padStart(2, '0')}`, target: { kind: t.kind, id: t.id }, from: t.from, to: t.to, vehicleId: v.id, driverId: dr.id, origin: 'seed' })
    d.next.assignment += 1
  }
}

/**
 * The one starting dataset that customers, staff and admins share: the canonical records plus the generated
 * ones, moved to the current date, with Maria's account cleared. Fleet details, the maintenance schedule and
 * one trip-planner request are added on top.
 */
export function sharedSeed(): { data: Dataset; maintenance: MaintenanceRecord[] } {
  const generatedFrom = expandDataset(canonical)
  const canonicalBookings = new Set(canonical.bookings.map((b) => b.id))
  const generated = new Set(generatedFrom.bookings.filter((b) => !canonicalBookings.has(b.id)).map((b) => b.id))
  removeCustomerRecords(generatedFrom, MARIA_ID)
  const data = shiftDataset(generatedFrom, SEED_SHIFT_DAYS, SEED_SHIFT_MONTHS)
  data.vehicles.forEach((v) => Object.assign(v, VAN_EXTRAS[v.id]))
  data.drivers.forEach((x) => Object.assign(x, DRIVER_EXTRAS[x.id]))

  const maintenance: MaintenanceRecord[] = []
  const add = (vehicleId: string, type: string, from: string, to: string, note: string, done?: string, extra: Partial<MaintenanceRecord> = {}) => {
    const id = `MNT-${String(maintenance.length + 1).padStart(2, '0')}`
    maintenance.push({ id, vehicleId, type, from, to, note, status: done ? 'Completed' : 'Scheduled', ...(done ? { doneAt: done, completedOn: done.slice(0, 10), doneNote: 'Completed as scheduled.' } : {}), ...extra })
    const v = data.vehicles.find((x) => x.id === vehicleId)!
    if (!done) {
      const existing = v.blocks.find((b) => b.kind === 'maintenance' && b.from === from)
      if (existing) Object.assign(existing, { ref: id, untilDone: true, note: type })
      else v.blocks.push({ from, to, kind: 'maintenance', note: type, ref: id, untilDone: true })
    }
  }
  add('VAN-04', 'Preventive maintenance (60,000 km)', addDays(DEMO_TODAY, -30), addDays(DEMO_TODAY, -29), 'Oil, filters and brake pads.', `${addDays(DEMO_TODAY, -29)}T16:00:00+08:00`, { provider: 'Toyota Malolos service center', cost: 8450 })
  const van3 = data.vehicles.find((v) => v.id === 'VAN-03')!.blocks.find((b) => b.kind === 'maintenance')
  if (van3) add('VAN-03', 'Scheduled maintenance', van3.from, van3.to, 'Aircon cleaning and tire rotation.', undefined, { status: 'In Maintenance', startedAt: `${van3.from}T08:00:00+08:00`, provider: 'Hyundai Calumpit', cost: 6200 })
  add('VAN-05', 'Oil change and brake check', addDays(DEMO_TODAY, -3), addDays(DEMO_TODAY, -2), 'Due at 75,000 km.', undefined, { provider: 'Malolos Auto Care', cost: 3800 })
  add('VAN-02', 'Tire rotation and alignment', addDays(DEMO_TODAY, 18), addDays(DEMO_TODAY, 18), '')
  add('VAN-01', 'Preventive maintenance (40,000 km)', addDays(DEMO_TODAY, 37), addDays(DEMO_TODAY, 38), 'Book the casa service bay.')
  add('VAN-14', 'Timing belt replacement', addDays(DEMO_TODAY, 9), addDays(DEMO_TODAY, 10), 'Due at 70,000 km.')

  assignGenerated(data, generated)

  // A request sent from the TAMS Trip Planner, where the customer has asked for changes to the first proposal.
  const a = sampleAnswers()
  const dest = data.destinations.find((x) => x.id === a.destination.id)!
  const plan = toPlannedTrip(buildPlan(a, dest), a)
  const { startDate, endDate } = requestDates(a)
  const stamp = (days: number, hhmm: string) => `${addDays(DEMO_TODAY, days)}T${hhmm}:00+08:00`
  const r: CustomRequest = {
    id: `CR-2026-${String(data.next.customRequest).padStart(4, '0')}`, customerId: 'CUS-0003', destinationId: dest.id, startDate, endDate, flexibility: 'Flexible dates',
    groupSize: a.group.size, pickup: 'Malolos Cathedral', budgetMin: 0, budgetMax: a.budget.amount ?? plan.perPerson, interests: ['Beach', 'Food'],
    requests: a.prefs.notes, contactName: 'Angelica Reyes', contactMobile: '0900 555 0103', planMode: 'suggested',
    stops: plan.stops.map((x) => x.name), pace: plan.pace, plan, status: 'Under review', createdAt: stamp(-4, '20:15'), origin: 'seed',
    events: [
      { at: stamp(-4, '20:15'), status: 'Submitted', note: 'Trip request sent from the TAMS Trip Planner.' },
      { at: stamp(-3, '09:10'), status: 'Under review', note: 'Staff are checking rooms near the beach.' },
      { at: stamp(-3, '15:40'), status: 'Proposal ready', note: 'Proposal sent.' },
      { at: stamp(-1, '21:05'), status: 'Under review', note: 'Customer asked for changes: “Can we add a beginner surf lesson and keep it under ₱6,000 each?”' },
    ],
  }
  data.next.customRequest += 1
  r.proposal = { ...draftCustomProposal(r, dest, stamp(-3, '15:40')), startDate, endDate, datesSet: true }
  data.customRequests.push(r)
  addSeasonal(data)
  normalize(data)
  return { data, maintenance }
}
