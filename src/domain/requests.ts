import { addDays, daysBetween, DEMO_TODAY, overlaps } from '../lib/demoClock'
import type { CustomRequest, Dataset, Destination, PlannedTrip, PriceLine, Proposal, RentalEstimate, RentalRequest, RentalTripType, RequestStatus, TripPace, VehicleCategory } from '../seed/types'
import { fmtDate } from '../lib/format'
import { blockOverlaps, BOOKING_CUTOFF_DAYS } from './rules'

// Custom-trip and van-rental requests (customer revision). These are not bookings: they never hold seats,
// never count as booking value or revenue, and only become a Pending booking when the customer accepts
// a proposal or quote.

/** Allowed request transitions. Accepted and Closed are final; the linked booking carries on from Accepted. */
export const REQUEST_TRANSITIONS: Record<RequestStatus, RequestStatus[]> = {
  Submitted: ['Under review', 'Closed'],
  'Under review': ['Proposal ready', 'Closed'],
  'Proposal ready': ['Accepted', 'Under review', 'Closed'],
  Accepted: [],
  Closed: [],
}
export const canTransition = (from: RequestStatus, to: RequestStatus) => REQUEST_TRANSITIONS[from].includes(to)

/** Customer-facing label: rentals receive a quote, custom trips a proposal. */
export const requestStatusLabel = (s: RequestStatus, kind: 'custom' | 'rental') => (kind === 'rental' && s === 'Proposal ready' ? 'Quote ready' : s)

const line = (label: string, unitPrice: number, qty: number, unit: string): PriceLine => ({ label, unitPrice, qty, unit, amount: unitPrice * qty })

// ---------- Van rental (with driver only) ----------

/** Pickup areas the agency serves (sample policy). */
export const PICKUP_AREAS = ['Metro Manila', 'Bulacan', 'Pampanga', 'Rizal', 'Cavite', 'Laguna']
/** Destination provinces within the Luzon service area (sample policy). */
export const DESTINATION_AREAS = [
  'Metro Manila', 'Bulacan', 'Pampanga', 'Rizal', 'Cavite', 'Laguna', 'Batangas', 'Quezon', 'Bataan', 'Zambales', 'Tarlac', 'Nueva Ecija',
  'Pangasinan', 'La Union', 'Benguet', 'Ifugao', 'Mountain Province', 'Ilocos Sur', 'Ilocos Norte', 'Nueva Vizcaya', 'Aurora', 'Isabela',
]
export const OUTSIDE_AREA = 'Outside Luzon'
export const DRIVER_OVERNIGHT_ALLOWANCE = 1000
export const SERVICE_HOURS_PER_DAY = 12
export const OVERTIME_PER_HOUR = 500
export const MAX_RENTAL_DAYS = 7

const minutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export interface RentalTiming {
  tripType: RentalTripType
  startDate: string
  startTime: string
  endDate: string
  endTime: string
}

/** End date implied by the trip type: one-way and same-day trips end on the start date. */
export const rentalEndDate = (t: RentalTiming) => (t.tripType === 'Multi-day' ? t.endDate : t.startDate)

/**
 * Estimate in whole service days. Every calendar day the van is out counts as one service day of up to 12 hours
 * (no partial-day discount). Multi-day trips add the driver's overnight allowance. Same-day trips longer than
 * 12 hours add estimated overtime. Tolls, parking and fees are excluded. Staff confirm the final quote.
 */
export function rentalEstimate(category: VehicleCategory, t: RentalTiming): RentalEstimate {
  const end = rentalEndDate(t)
  const serviceDays = Math.max(1, daysBetween(t.startDate, end) + 1)
  const lines: PriceLine[] = [line(`${category.name} with driver and fuel`, category.ratePerDay, serviceDays, 'service day')]
  const notes = ['Tolls, parking and entrance fees are not included.', 'Route-dependent: staff confirm the final quote after reviewing your route and stops.']
  if (serviceDays > 1) lines.push(line('Driver overnight allowance (meals and lodging)', DRIVER_OVERNIGHT_ALLOWANCE, serviceDays - 1, 'night'))
  if (t.tripType === 'Round trip (same day)' && t.endTime && t.startTime) {
    const hours = (minutes(t.endTime) - minutes(t.startTime)) / 60
    if (hours > SERVICE_HOURS_PER_DAY) lines.push(line('Estimated overtime beyond 12 hours', OVERTIME_PER_HOUR, Math.ceil(hours - SERVICE_HOURS_PER_DAY), 'hour'))
  }
  if (t.tripType === 'One-way') notes.unshift('One-way trips are billed as a full service day because the van returns empty.')
  return { lines, total: lines.reduce((n, l) => n + l.amount, 0), serviceDays, notes }
}

/** Vans of a category that are free for the whole date range (calendar-day resolution, like admin assignment). */
export function freeVehicles(d: Dataset, categoryId: string, from: string, to: string) {
  return d.vehicles.filter(
    (v) =>
      v.categoryId === categoryId &&
      !v.blocks.some((b) => blockOverlaps(b, from, to)) &&
      !d.assignments.some((a) => a.vehicleId === v.id && overlaps(a.from, a.to, from, to)),
  )
}

export interface RentalInput extends RentalTiming {
  categoryId: string
  pickupArea: string
  pickup: string
  dropoff: string
  destinationArea: string
  passengers: number
}

export function validateRental(d: Dataset, f: RentalInput, today = DEMO_TODAY): Record<string, string> {
  const e: Record<string, string> = {}
  const cat = d.vehicleCategories.find((c) => c.id === f.categoryId)
  if (!cat) e.categoryId = 'Choose a vehicle type.'
  if (!PICKUP_AREAS.includes(f.pickupArea)) e.pickupArea = 'Choose a pickup area we serve.'
  if (f.pickup.trim().length < 3) e.pickup = 'Enter the pickup address or landmark.'
  if (f.dropoff.trim().length < 3) e.dropoff = 'Enter where the trip ends or the main destination.'
  if (f.destinationArea === OUTSIDE_AREA) e.destinationArea = 'Trips outside Luzon are outside our service area.'
  else if (!DESTINATION_AREAS.includes(f.destinationArea)) e.destinationArea = 'Choose the destination province.'
  const earliest = addDays(today, BOOKING_CUTOFF_DAYS + 1)
  if (!f.startDate) e.startDate = 'Choose a departure date.'
  else if (f.startDate < earliest) e.startDate = `Requests close ${BOOKING_CUTOFF_DAYS} days before travel. The earliest date is ${fmtDate(earliest, { weekday: true })}.`
  if (!f.startTime) e.startTime = 'Choose a departure time.'
  if (f.tripType === 'Round trip (same day)') {
    if (!f.endTime) e.endTime = 'Choose a return time.'
    else if (f.startTime && minutes(f.endTime) <= minutes(f.startTime)) e.endTime = 'The return time must be after the departure time.'
  }
  if (f.tripType === 'Multi-day') {
    if (!f.endDate) e.endDate = 'Choose a return date.'
    else if (f.startDate && f.endDate <= f.startDate) e.endDate = 'For a multi-day trip, the return date must be after the departure date.'
    else if (f.startDate && daysBetween(f.startDate, f.endDate) + 1 > MAX_RENTAL_DAYS) e.endDate = `Online requests are up to ${MAX_RENTAL_DAYS} days.`
    if (!f.endTime) e.endTime = 'Choose a return time.'
  }
  if (!Number.isInteger(f.passengers) || f.passengers < 1) e.passengers = 'Enter the number of passengers.'
  else if (cat && f.passengers > cat.seats) e.passengers = `A ${cat.name.toLowerCase()} seats up to ${cat.seats} passengers. Choose a larger vehicle or split the group.`
  if (cat && !e.startDate && !e.endDate && f.startDate) {
    const end = rentalEndDate(f)
    if (freeVehicles(d, cat.id, f.startDate, end).length === 0)
      e.availability = `No ${cat.name.toLowerCase()} is free on these dates in the current schedule. Try other dates or another vehicle type.`
  }
  return e
}

// ---------- Custom trips ----------

export const CUSTOM_VAN_RATE = 6500
export const CUSTOM_ROOM_RATE = 2200
export const CUSTOM_GUIDE_FEE = 650
export const PROPOSAL_VALID_DAYS = 7

/**
 * Sample proposal the simulated staff prepare for a custom request: private van with driver per day, rooms
 * (two guests per room) per night, and a local guide and fees per person. Used for seeded proposals and the
 * "simulate staff proposal" demo control so every amount follows the same rule.
 */
/** Stops a day holds at each pace, used to lay out the requested stops across the trip days. */
export const STOPS_PER_DAY: Record<TripPace, number> = { Relaxed: 2, Balanced: 3, Packed: 4 }

/** Splits ordered stops into days at the chosen pace; extra stops share the last day (staff trim them). */
export function stopsByDay(stops: string[], days: number, pace: TripPace = 'Balanced'): string[][] {
  const per = STOPS_PER_DAY[pace]
  const out = Array.from({ length: Math.max(1, days) }, (_, i) => stops.slice(i * per, (i + 1) * per))
  const rest = stops.slice(out.length * per)
  if (rest.length) out[out.length - 1].push(...rest)
  return out
}

/** More stops than the trip's days can hold at the chosen pace. */
export const tooManyStops = (stops: number, days: number, pace: TripPace = 'Balanced') => stops > Math.max(1, days) * STOPS_PER_DAY[pace]

/**
 * The destination of a custom request. A place the customer typed (not in our catalog) gets a plain stand-in so
 * every screen can show it; staff confirm whether the agency can serve it.
 */
export function requestDestination(d: Dataset, r: Pick<CustomRequest, 'destinationId' | 'destinationName'>): Destination {
  const found = d.destinations.find((x) => x.id === r.destinationId)
  if (found) return found
  const name = r.destinationName?.trim() || 'Custom destination'
  return {
    id: '', name, province: 'Location to be confirmed', summary: 'A place you suggested. Staff confirm whether we can take you there.', overview: '',
    highlights: [], interests: [], bestMonths: '', travelTime: 'travel time to be confirmed', suggestedDays: 1,
    image: { src: '/images/destinations/custom-place.svg', alt: `${name}, a place you suggested`, kind: 'illustration' },
  }
}

/**
 * Sample proposal the simulated staff prepare for a custom request: private van with driver per day, rooms
 * (two guests per room) per night, and a local guide and fees per person. Used for seeded proposals and the
 * "simulate staff proposal" demo control so every amount follows the same rule. The itinerary follows the
 * customer's chosen stops when they gave some, otherwise the destination's highlights.
 */
export function draftCustomProposal(r: Pick<CustomRequest, 'startDate' | 'endDate' | 'groupSize' | 'pickup' | 'stops' | 'pace' | 'plan'>, dest: Destination, sentAt: string): Proposal {
  if (r.plan) return proposalFromPlan(r as typeof r & { plan: PlannedTrip }, dest, sentAt)
  const days = daysBetween(r.startDate, r.endDate) + 1
  const nights = days - 1
  const vans = Math.ceil(r.groupSize / 12)
  const rooms = Math.ceil(r.groupSize / 2)
  const lines = [line(`Private van with driver and fuel${vans > 1 ? ` (${vans} vans)` : ''}`, CUSTOM_VAN_RATE * vans, days, 'day')]
  if (nights > 0) lines.push(line(`Hotel, ${rooms} ${rooms === 1 ? 'room' : 'rooms'} (twin sharing)`, CUSTOM_ROOM_RATE * rooms, nights, 'night'))
  lines.push(line('Local guide, environmental and entrance fees', CUSTOM_GUIDE_FEE, r.groupSize, 'person'))
  const travel = dest.id ? `${dest.name} (${dest.travelTime})` : dest.name
  const planned = r.stops?.length ? stopsByDay(r.stops, days, r.pace) : undefined
  const itinerary = planned
    ? planned.map((stops, i) => {
        const what = stops.length ? stops.join(', ') : 'Free time'
        if (days === 1) return `Day 1: Pickup at ${r.pickup}, travel to ${travel}, ${what}, return trip in the afternoon`
        if (i === 0) return `Day 1: Pickup at ${r.pickup}, travel to ${travel}, ${what}`
        return i === days - 1 ? `Day ${i + 1}: ${what}, return trip in the afternoon` : `Day ${i + 1}: ${what}`
      })
    : Array.from({ length: days }, (_, i) => {
        const h = dest.highlights[Math.min(i, dest.highlights.length - 1)] ?? 'Sightseeing with your local guide'
        return i === 0
          ? `Day 1: Pickup at ${r.pickup}, travel to ${travel}, ${h}`
          : i === days - 1
            ? `Day ${i + 1}: ${h}, return trip in the afternoon`
            : `Day ${i + 1}: ${h} with your local guide`
      })
  return {
    title: `${dest.name} custom trip`,
    startDate: r.startDate,
    endDate: r.endDate,
    groupSize: r.groupSize,
    itinerary,
    inclusions: ['Private van with driver and fuel', ...(nights > 0 ? ['Hotel, twin sharing'] : []), 'Local guide', 'Environmental and entrance fees listed in the itinerary'],
    exclusions: ['Meals', 'Tolls and parking', 'Personal expenses'],
    lines,
    total: lines.reduce((n, l) => n + l.amount, 0),
    validUntil: addDays(sentAt.slice(0, 10), PROPOSAL_VALID_DAYS),
    sentAt,
  }
}

/** A proposal that follows a planner itinerary: the same included lines as the estimate, so amounts never change between screens. */
function proposalFromPlan(r: Pick<CustomRequest, 'startDate' | 'endDate' | 'groupSize' | 'plan'> & { plan: PlannedTrip }, dest: Destination, sentAt: string): Proposal {
  const p = r.plan
  const lines = p.estimate
    .filter((l) => (l.group === 'shared' || l.group === 'person') && l.amount)
    .map((l) => line(l.label, l.unitPrice ?? l.amount!, l.qty ?? 1, l.unit ?? 'trip'))
  const itinerary = p.itinerary.map((d) => {
    const stops = d.items.filter((i) => i.kind === 'stop').map((i) => i.title)
    return `Day ${d.day}: ${stops.length ? stops.join(', ') : d.label}`
  })
  return {
    title: `${dest.name} custom trip`,
    startDate: r.startDate,
    endDate: r.endDate,
    groupSize: r.groupSize,
    itinerary,
    inclusions: p.estimate.filter((l) => (l.group === 'shared' || l.group === 'person') && l.amount).map((l) => l.label),
    exclusions: [...p.estimate.filter((l) => l.group === 'optional' || l.group === 'quote').map((l) => l.label), 'Personal expenses'],
    lines,
    total: lines.reduce((n, l) => n + l.amount, 0),
    validUntil: addDays(sentAt.slice(0, 10), PROPOSAL_VALID_DAYS),
    sentAt,
  }
}

export const proposalExpired = (validUntil: string, today = DEMO_TODAY) => validUntil < today

/** Where a sent proposal or quote stands with the customer, for staff follow-up. */
export type ProposalTrack = 'Draft' | 'Sent' | 'Changes requested' | 'Revising' | 'Accepted' | 'Expired'

export function proposalTrack(r: CustomRequest | RentalRequest, today = DEMO_TODAY): ProposalTrack | null {
  const sent = 'categoryId' in r ? r.quote : r.proposal
  if (r.status === 'Accepted') return 'Accepted'
  if (r.status === 'Proposal ready' && sent) return proposalExpired(sent.validUntil, today) ? 'Expired' : 'Sent'
  if (r.status === 'Under review') {
    if (sent) return /asked for changes/i.test(r.events.at(-1)?.note ?? '') ? 'Changes requested' : 'Revising'
    if ('draftProposal' in r && r.draftProposal) return 'Draft'
  }
  return null
}

/** The customer's words from their latest change request, without the event prefix. */
export const changeRequestText = (r: CustomRequest | RentalRequest) => {
  const e = [...r.events].reverse().find((x) => /asked for changes/i.test(x.note))
  return e?.note.replace(/^.*?asked for changes:\s*/i, '')
}

export interface CustomInput {
  destinationId: string
  destinationName?: string
  startDate: string
  endDate: string
  groupSize: number
  pickup: string
  budgetMin: number
  budgetMax: number
  contactName: string
  contactMobile: string
}

export const MAX_GROUP = 24

export function validateCustom(f: CustomInput, today = DEMO_TODAY): Record<string, string> {
  const e: Record<string, string> = {}
  if (!f.destinationId && (f.destinationName ?? '').trim().length < 3) e.destinationId = 'Choose a destination or type the place you want to visit.'
  const earliest = addDays(today, 7)
  if (!f.startDate) e.startDate = 'Choose a start date.'
  else if (f.startDate < earliest) e.startDate = `Custom trips need at least a week to plan. The earliest start date is ${fmtDate(earliest, { weekday: true })}.`
  if (!f.endDate) e.endDate = 'Choose an end date.'
  else if (f.startDate && f.endDate < f.startDate) e.endDate = 'The end date must be on or after the start date.'
  else if (f.startDate && daysBetween(f.startDate, f.endDate) + 1 > 10) e.endDate = 'Online custom requests are up to 10 days.'
  if (!Number.isInteger(f.groupSize) || f.groupSize < 1) e.groupSize = 'Enter the group size.'
  else if (f.groupSize > MAX_GROUP) e.groupSize = `For groups over ${MAX_GROUP}, please message our staff.`
  if (f.pickup.trim().length < 3) e.pickup = 'Enter a pickup city or landmark.'
  if (!Number.isFinite(f.budgetMin) || !Number.isFinite(f.budgetMax) || f.budgetMin < 0) e.budget = 'Enter a budget range in pesos per person.'
  else if (f.budgetMax < 500) e.budget = 'Set the maximum to at least ₱500 per person.'
  else if (f.budgetMin > f.budgetMax) e.budget = 'The minimum cannot be higher than the maximum.'
  if (f.contactName.trim().length < 2) e.contactName = 'Enter a contact name.'
  if (!/^(09|\+639)\d{9}$/.test(f.contactMobile.replace(/[\s-]/g, ''))) e.contactMobile = 'Use the format 09XX XXX XXXX.'
  return e
}
