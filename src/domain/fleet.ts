import { DEMO_TODAY, overlaps } from '../lib/demoClock'
import type { MaintenanceRecord } from '../seed/derive'
import type { Assignment, Block, Dataset, Driver, Vehicle } from '../seed/types'
import { blockOverlaps, shortRange } from './rules'

// Fleet rules shared by the Vehicles, Drivers and Maintenance screens and by assignment. Being active, assigned,
// in maintenance and unavailable are separate facts: a van can be active and still in the shop today.

export const isActive = (x: { active?: boolean }) => x.active !== false

export type MaintenanceView = 'Scheduled' | 'In Maintenance' | 'Overdue' | 'Completed' | 'Cancelled'

/** Overdue is worked out, never stored: open work whose planned end date has passed. */
export const isMaintenanceOverdue = (m: MaintenanceRecord, today = DEMO_TODAY) => (m.status === 'Scheduled' || m.status === 'In Maintenance') && m.to < today

export const maintenanceView = (m: MaintenanceRecord, today = DEMO_TODAY): MaintenanceView => (isMaintenanceOverdue(m, today) ? 'Overdue' : m.status)

export const isOpenMaintenance = (m: MaintenanceRecord) => m.status === 'Scheduled' || m.status === 'In Maintenance'

/** What a trip assignment is for, in words staff recognise. */
export function assignmentLabel(d: Dataset, a: Assignment) {
  if (a.target.kind === 'booking') {
    const b = d.bookings.find((x) => x.id === a.target.id)
    if (!b) return a.target.id
    return b.serviceId === 'SVC-CUSTOM' ? `${b.label ?? 'Custom trip'} · ${b.contactName}` : b.rental ? `Van rental · ${b.rental.destination ?? b.contactName}` : `${b.agreed?.title ?? b.id} · ${b.contactName}`
  }
  const dep = d.departures.find((x) => x.id === a.target.id)
  return d.services.find((s) => s.id === dep?.serviceId)?.name ?? a.target.id
}

/** Active bookings riding on an assignment. */
export function assignmentBookings(d: Dataset, a: Assignment) {
  return d.bookings.filter((b) => (a.target.kind === 'departure' ? b.departureId === a.target.id : b.id === a.target.id) && (b.status === 'Confirmed' || b.status === 'Pending'))
}

/** Upcoming trips a van or driver is assigned to between two dates. */
export function affectedTrips(d: Dataset, who: { vehicleId?: string; driverId?: string }, from: string, to: string) {
  return d.assignments
    .filter((a) => (who.vehicleId ? a.vehicleId === who.vehicleId : a.driverId === who.driverId) && a.to >= DEMO_TODAY && overlaps(a.from, a.to, from, to))
    .sort((a, b) => a.from.localeCompare(b.from))
}

const blockWords = (b: Block) => `${b.kind === 'maintenance' ? 'in maintenance' : b.note || 'unavailable'} ${shortRange(b.from, b.to)}`

/**
 * Why an upcoming assignment can no longer run as planned (the van or driver became unavailable or inactive after it
 * was made), or null. Such a trip shows "Needs reassignment" until staff pick another van or driver.
 */
export function assignmentIssue(d: Dataset, a: Assignment): string | null {
  if (a.to < DEMO_TODAY) return null
  const dr = d.drivers.find((x) => x.id === a.driverId)
  const v = d.vehicles.find((x) => x.id === a.vehicleId)
  const out: string[] = []
  if (!dr) out.push('Driver removed')
  else if (!isActive(dr)) out.push(`${dr.name} is inactive`)
  else {
    const blk = dr.blocks.find((b) => overlaps(b.from, b.to, a.from, a.to))
    if (blk) out.push(`${dr.name}: ${blockWords(blk)}`)
  }
  if (!v) out.push('Van removed')
  else if (!isActive(v)) out.push(`${v.name} is inactive`)
  else if (v.condition === 'Not roadworthy') out.push(`${v.name} is not roadworthy`)
  else {
    const blk = v.blocks.find((b) => blockOverlaps(b, a.from, a.to))
    if (blk) out.push(`${v.name}: ${blockWords(blk)}`)
  }
  return out.length ? out.join('; ') : null
}

export const tripsNeedingReassignment = (d: Dataset) => d.assignments.filter((a) => assignmentIssue(d, a))

export type DriverStatus = 'Inactive' | 'Unavailable' | 'Assigned' | 'Available'

/** A driver's status today. */
export function driverStatusOn(d: Dataset, dr: Driver, day = DEMO_TODAY): DriverStatus {
  if (!isActive(dr)) return 'Inactive'
  if (dr.blocks.some((b) => overlaps(b.from, b.to, day, day))) return 'Unavailable'
  if (d.assignments.some((a) => a.driverId === dr.id && overlaps(a.from, a.to, day, day))) return 'Assigned'
  return 'Available'
}

export interface MaintenanceConflict {
  kind: 'trip' | 'maintenance' | 'unavailable'
  text: string
}

/**
 * Everything that clashes with taking a van out of service on these dates: assigned trips (with the bookings on
 * them), other maintenance, and periods the van is already marked unavailable.
 */
export function maintenanceConflicts(d: Dataset, maintenance: MaintenanceRecord[], vehicleId: string, from: string, to: string, ignore?: string): MaintenanceConflict[] {
  const v = d.vehicles.find((x) => x.id === vehicleId)
  if (!v || !from || !to || to < from) return []
  const out: MaintenanceConflict[] = []
  for (const a of affectedTrips(d, { vehicleId }, from, to)) {
    const refs = assignmentBookings(d, a).map((b) => b.id)
    out.push({ kind: 'trip', text: `Assigned to ${assignmentLabel(d, a)}, ${shortRange(a.from, a.to)}${refs.length ? ` (${refs.join(', ')})` : ''}` })
  }
  for (const m of maintenance) {
    if (m.id === ignore || m.vehicleId !== vehicleId || !isOpenMaintenance(m)) continue
    const end = isMaintenanceOverdue(m) ? DEMO_TODAY : m.to
    if (overlaps(m.from, end, from, to)) out.push({ kind: 'maintenance', text: `${m.type}, ${shortRange(m.from, m.to)} (${m.id})` })
  }
  for (const b of v.blocks) {
    if (b.kind === 'maintenance' || !overlaps(b.from, b.to, from, to)) continue
    out.push({ kind: 'unavailable', text: `Marked unavailable ${shortRange(b.from, b.to)}: ${b.note}` })
  }
  return out
}

/** When a van is next free after its open maintenance, for the confirmation message. */
export function nextFreeNote(d: Dataset, v: Vehicle) {
  if (!isActive(v)) return `${v.name} is inactive, so it still takes no trips.`
  const blk = v.blocks.find((b) => blockOverlaps(b, DEMO_TODAY, DEMO_TODAY))
  if (blk) return `${v.name} is still out of service ${shortRange(blk.from, blk.to)} (${blk.note}).`
  const today = d.assignments.find((a) => a.vehicleId === v.id && overlaps(a.from, a.to, DEMO_TODAY, DEMO_TODAY))
  if (today) return `${v.name} is free for new trips after ${assignmentLabel(d, today)}.`
  return `${v.name} is available for trips from today.`
}
