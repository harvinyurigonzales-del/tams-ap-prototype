import { create } from 'zustand'
import { addDays, DEMO_TODAY, demoNowStamp } from '../lib/demoClock'
import { peso } from '../lib/format'
import { canTransition, draftCustomProposal, PROPOSAL_VALID_DAYS, requestDestination } from '../domain/requests'
import { assignableTargets, canCancel, canConfirm, driverConflict, money, shortRange, vehicleConflict } from '../domain/rules'
import type { MaintenanceRecord } from '../seed/derive'
import type { AppNotification, CustomRequest, Dataset, Driver, PackageStatus, Proposal, RentalRequest, Service, Vehicle } from '../seed/types'
import { changesOf, logActivity } from '../domain/activity'
import { packageStatus, priceBasisOf, setStatus } from '../domain/packages'
import { departureAvailability } from '../domain/rules'
import { nextId } from './ids'
import { freshState, markSignedOut, readSession, startingState, writeSession } from './persist'

// Staff portal state. The business records (`data`) are the same saved records the customer site uses
// (see persist.ts and sync.ts), so a booking Maria makes shows up here and a staff update reaches her.

export type { MaintenanceRecord }

export const DEMO_ADMIN = { email: 'admin@tamsap.example.com', password: 'Admin2026!', name: 'Admin' }
export const DEMO_STAFF = { email: 'staff@tamsap.example.com', password: 'Staff2026!', name: 'Liza Manalo' }
export const MAX_ATTEMPTS = 5
export const LOCKOUT_MS = 30_000

type Result = { ok: true; id?: string } | { ok: false; error: string }

/** Admin can do everything; Staff run day-to-day operations without the admin-only modules. */
export type Role = 'Admin' | 'Staff'

export interface StaffAccount {
  id: string
  name: string
  email: string
  password: string
  role: Role
  title: string
  mobile: string
  active: boolean
  createdAt: string
}

export interface BusinessSettings {
  businessName: string
  email: string
  mobile: string
  address: string
  hours: string
}

export type StaffInput = Pick<StaffAccount, 'name' | 'email' | 'role' | 'title' | 'mobile'> & { password?: string }
export type VehicleInput = Pick<Vehicle, 'name' | 'model' | 'plate' | 'seats' | 'categoryId'> & Pick<Vehicle, 'color' | 'odometer'>
export type DriverInput = Pick<Driver, 'name' | 'mobile' | 'license' | 'licenseExpiry' | 'since'>
export type PackageInput = Pick<Service, 'name' | 'destinationId' | 'duration' | 'days' | 'price' | 'pickup' | 'pickupTime' | 'summary' | 'itinerary' | 'inclusions' | 'exclusions'> &
  Partial<Pick<Service, 'priceBasis' | 'capacity' | 'season' | 'image' | 'description'>> & {
    /** The full departure schedule after the edit; leave out to keep departures as they are. */
    departures?: DepartureInput[]
    /** The admin checked the departure dates of a copied package. */
    datesReviewed?: boolean
    /** A new package is saved as a Draft unless it is published straight away. */
    publish?: boolean
  }
export interface DepartureInput {
  /** Missing for a new departure. */
  id?: string
  startDate: string
  capacity: number
}
export type MaintenanceInput = Pick<MaintenanceRecord, 'vehicleId' | 'type' | 'from' | 'to' | 'note'>

interface AdminState {
  data: Dataset
  loggedIn: boolean
  /** Signed-in staff account. */
  userId: string | null
  accounts: StaffAccount[]
  maintenance: MaintenanceRecord[]
  settings: BusinessSettings
  failedAttempts: number
  lockedUntil: number | null
  login: (email: string, password: string) => Result
  logout: () => void
  updateProfile: (input: { name: string; mobile: string }) => Result
  changePassword: (current: string, next: string) => Result
  saveSettings: (s: BusinessSettings) => Result
  saveStaff: (id: string | null, input: StaffInput) => Result
  setStaffActive: (id: string, active: boolean) => Result
  deleteStaff: (id: string) => Result
  saveVehicle: (id: string | null, input: VehicleInput) => Result
  deleteVehicle: (id: string) => Result
  saveDriver: (id: string | null, input: DriverInput) => Result
  deleteDriver: (id: string) => Result
  scheduleMaintenance: (input: MaintenanceInput) => Result
  rescheduleMaintenance: (id: string, from: string, to: string) => Result
  completeMaintenance: (id: string, note: string) => Result
  cancelMaintenance: (id: string) => Result
  savePackage: (id: string | null, input: PackageInput) => Result
  setPackageActive: (id: string, active: boolean) => Result
  setPackageStatus: (id: string, status: PackageStatus) => Result
  duplicatePackage: (id: string) => Result
  deletePackage: (id: string) => Result
  saveDraftProposal: (id: string, p: Proposal) => Result
  reviseProposal: (id: string) => Result
  verifyPayment: (paymentId: string) => Result
  rejectPayment: (paymentId: string, reason: string) => Result
  confirmBooking: (bookingId: string) => Result
  cancelBooking: (bookingId: string, reason: string) => Result
  declineCancellation: (bookingId: string) => Result
  /** Marks a confirmed, fully paid trip as completed, which lets the customer rate it. */
  completeBooking: (bookingId: string) => Result
  sendReminder: (bookingId: string) => Result
  assign: (target: { kind: 'departure' | 'booking'; id: string }, vehicleId: string, driverId: string) => Result
  markRead: (id: string) => void
  markAllRead: () => void
  replyInquiry: (inquiryId: string, text: string) => Result
  replyReview: (reviewId: string, text: string) => Result
  resolveInquiry: (inquiryId: string) => Result
  startReview: (kind: 'custom' | 'rental', id: string) => Result
  sendProposal: (kind: 'custom' | 'rental', id: string) => Result
  closeRequest: (kind: 'custom' | 'rental', id: string, reason: string) => Result
  reset: () => void
}

const SEED_STAFF: StaffAccount[] = [
  { id: 'STF-01', ...DEMO_ADMIN, role: 'Admin', title: 'Owner and operations head', mobile: '0900 555 0301', active: true, createdAt: '2024-03-01' },
  { id: 'STF-02', ...DEMO_STAFF, role: 'Staff', title: 'Booking and payments', mobile: '0900 555 0302', active: true, createdAt: '2025-01-15' },
  { id: 'STF-03', name: 'Paolo Garcia', email: 'paolo.garcia@tamsap.example.com', password: 'Paolo2026!', role: 'Staff', title: 'Fleet coordinator', mobile: '0900 555 0303', active: true, createdAt: '2025-06-02' },
  { id: 'STF-04', name: 'Grace Lim', email: 'grace.lim@tamsap.example.com', password: 'Grace2026!', role: 'Staff', title: 'Customer service (seasonal)', mobile: '0900 555 0304', active: false, createdAt: '2025-11-20' },
]

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: 'TAMS AP Travel and Tours',
  email: 'hello@tamsap.example.com',
  mobile: '0900 555 0300',
  address: 'Malolos, Bulacan',
  hours: 'Mon–Sat, 8:00 AM to 6:00 PM',
}

const signedIn = (accounts: StaffAccount[]) => {
  const id = readSession().staffId
  return id && accounts.some((a) => a.id === id && a.active) ? id : null
}

const initial = (fresh = false) => {
  const s = fresh ? freshState() : startingState()
  const accounts = (s.staffAccounts as StaffAccount[] | undefined) ?? structuredClone(SEED_STAFF)
  const userId = fresh ? null : signedIn(accounts)
  return {
    data: s.data,
    maintenance: s.maintenance,
    loggedIn: !!userId,
    userId,
    accounts,
    settings: (s.settings as BusinessSettings | undefined) ?? { ...DEFAULT_SETTINGS },
    failedAttempts: 0,
    lockedUntil: null as number | null,
  }
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MOBILE = /^(09|\+639)\d{9}$/
const mobileOk = (m: string) => MOBILE.test(m.replace(/[\s-]/g, ''))
const fail = (error: string): Result => ({ ok: false, error })
const OK: Result = { ok: true }
const ADMIN_ONLY = 'Only an admin can do this.'

/** Signed-in account and its role. */
export const useMe = () => useAdmin((s) => s.accounts.find((a) => a.id === s.userId))
export const useIsAdmin = () => useAdmin((s) => s.accounts.find((a) => a.id === s.userId)?.role === 'Admin')

/** Adds a staff activity entry. Staff actions are already seen, so they are created as read. */
function activity(d: Dataset, at: string, n: Omit<AppNotification, 'id' | 'at' | 'read' | 'origin'>) {
  d.notifications.unshift({ id: nextId(d, 'notification'), at, read: true, origin: 'local', ...n })
}

/** Tells the customer about a staff update. It shows in their bell and Notifications page. */
function tell(d: Dataset, customerId: string, at: string, n: Pick<AppNotification, 'category' | 'title' | 'body' | 'link'>) {
  d.notifications.unshift({ id: nextId(d, 'notification'), at, read: false, customerId, origin: 'local', ...n })
}

/** Staff notifications only; customer notifications share the same list. */
export const staffNotifications = (d: Dataset) => d.notifications.filter((n) => !n.customerId)

const tripTitle = (d: Dataset, b: { serviceId: string; label?: string }) => b.label ?? d.services.find((x) => x.id === b.serviceId)?.name ?? 'your trip'

const findRequest = (d: Dataset, kind: 'custom' | 'rental', id: string): CustomRequest | RentalRequest | undefined =>
  kind === 'custom' ? d.customRequests.find((x) => x.id === id) : d.rentalRequests.find((x) => x.id === id)

const customerName = (d: Dataset, customerId: string) => d.customers.find((c) => c.id === customerId)?.name ?? customerId

export const useAdmin = create<AdminState>((set, get) => ({
  ...initial(),

  login: (email, password) => {
    const s = get()
    // Lockout is measured on the real clock because it is a UI behaviour, not business data.
    if (s.lockedUntil && Date.now() < s.lockedUntil) {
      return { ok: false, error: `Too many attempts. Try again in ${Math.ceil((s.lockedUntil - Date.now()) / 1000)} seconds.` }
    }
    const acct = s.accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password)
    if (acct && !acct.active) return { ok: false, error: 'This account is deactivated. Ask an admin to turn it back on.' }
    if (!acct) {
      const failedAttempts = s.failedAttempts + 1
      if (failedAttempts >= MAX_ATTEMPTS) {
        set({ failedAttempts: 0, lockedUntil: Date.now() + LOCKOUT_MS })
        return { ok: false, error: 'Too many attempts. Login is locked for 30 seconds.' }
      }
      set({ failedAttempts, lockedUntil: null })
      return { ok: false, error: `Email or password is incorrect. ${MAX_ATTEMPTS - failedAttempts} attempts left.` }
    }
    set({ loggedIn: true, userId: acct.id, failedAttempts: 0, lockedUntil: null })
    writeSession({ staffId: acct.id })
    return { ok: true }
  },

  logout: () => {
    markSignedOut()
    set({ loggedIn: false, userId: null })
    writeSession({ staffId: null })
  },

  verifyPayment: (paymentId) => {
    const data = structuredClone(get().data)
    const p = data.payments.find((x) => x.id === paymentId)
    if (!p || p.status !== 'Submitted') return { ok: false, error: 'Only a submitted payment can be verified.' }
    const b = data.bookings.find((x) => x.id === p.bookingId)!
    const at = demoNowStamp()
    p.status = 'Verified'
    p.reviewedAt = at
    activity(data, at, {
      category: 'Payments', title: 'Payment verified',
      body: `${b.id} (${customerName(data, b.customerId)}) ${p.type.toLowerCase()} of ${peso(p.amount)}.`, link: `/admin/bookings?id=${b.id}`,
    })
    const m = money(b, data.payments)
    tell(data, b.customerId, at, { category: 'Payments', title: 'Payment verified', body: `${peso(p.amount)} for ${b.id}. ${m.balance > 0 ? `Balance ${peso(m.balance)}.` : 'Fully paid.'}`, link: `/app/trips/${b.id}` })
    set({ data })
    return { ok: true }
  },

  rejectPayment: (paymentId, reason) => {
    if (!reason.trim()) return { ok: false, error: 'Enter a reason so the customer knows what to fix.' }
    const data = structuredClone(get().data)
    const p = data.payments.find((x) => x.id === paymentId)
    if (!p || p.status !== 'Submitted') return { ok: false, error: 'Only a submitted payment can be rejected.' }
    const b = data.bookings.find((x) => x.id === p.bookingId)!
    const at = demoNowStamp()
    p.status = 'Rejected'
    p.reviewedAt = at
    p.rejectReason = reason.trim()
    activity(data, at, {
      category: 'Payments', title: 'Payment rejected', body: `${b.id} (${customerName(data, b.customerId)}): ${p.rejectReason}`, link: `/admin/bookings?id=${b.id}`,
    })
    tell(data, b.customerId, at, { category: 'Payments', title: 'Payment needs a new proof', body: `${b.id}: ${p.rejectReason}`, link: `/app/trips/${b.id}` })
    set({ data })
    return { ok: true }
  },

  confirmBooking: (bookingId) => {
    const data = structuredClone(get().data)
    const b = data.bookings.find((x) => x.id === bookingId)
    if (!b) return { ok: false, error: 'Booking not found.' }
    const check = canConfirm(b, data.payments)
    if (!check.ok) return { ok: false, error: check.reason }
    const at = demoNowStamp()
    b.status = 'Confirmed'
    b.confirmedAt = at
    const svc = data.services.find((s) => s.id === b.serviceId)!
    activity(data, at, {
      category: 'Bookings', title: 'Booking confirmed',
      body: `${b.id} (${customerName(data, b.customerId)}) · ${b.label ?? svc.name}, ${shortRange(b.startDate, b.endDate)}.`, link: `/admin/bookings?id=${b.id}`,
    })
    tell(data, b.customerId, at, { category: 'Bookings', title: 'Booking confirmed', body: `${b.id} · ${tripTitle(data, b)}, ${shortRange(b.startDate, b.endDate)}. Your seats are secured.`, link: `/app/trips/${b.id}` })
    set({ data })
    return { ok: true }
  },

  cancelBooking: (bookingId, reason) => {
    if (!reason.trim()) return { ok: false, error: 'Enter a reason for the cancellation.' }
    const data = structuredClone(get().data)
    const b = data.bookings.find((x) => x.id === bookingId)
    if (!b) return { ok: false, error: 'Booking not found.' }
    const check = canCancel(b)
    if (!check.ok) return { ok: false, error: check.reason }
    const at = demoNowStamp()
    b.status = 'Cancelled'
    b.cancelReason = reason.trim()
    b.cancelledAt = at
    b.cancellationRequested = false
    // A rental's own assignment goes; a departure keeps its van while other confirmed seats remain.
    const stillAssignable = new Set(assignableTargets(data).map((t) => `${t.kind}:${t.id}`))
    data.assignments = data.assignments.filter((a) => stillAssignable.has(`${a.target.kind}:${a.target.id}`) || a.to < b.startDate)
    activity(data, at, {
      category: 'Bookings', title: 'Booking cancelled', body: `${b.id} (${customerName(data, b.customerId)}): ${b.cancelReason}`, link: `/admin/bookings?id=${b.id}`,
    })
    tell(data, b.customerId, at, { category: 'Bookings', title: 'Booking cancelled', body: `${b.id} · ${tripTitle(data, b)}: ${b.cancelReason}. Staff will contact you about any refund.`, link: `/app/trips/${b.id}` })
    set({ data })
    return { ok: true }
  },

  declineCancellation: (bookingId) => {
    const data = structuredClone(get().data)
    const b = data.bookings.find((x) => x.id === bookingId)
    if (!b || !b.cancellationRequested) return { ok: false, error: 'There is no cancellation request on this booking.' }
    const at = demoNowStamp()
    b.cancellationRequested = false
    activity(data, at, { category: 'Bookings', title: 'Cancellation declined', body: `${b.id} (${customerName(data, b.customerId)}) stays booked.`, link: `/admin/bookings?id=${b.id}` })
    tell(data, b.customerId, at, { category: 'Bookings', title: 'Cancellation not approved', body: `${b.id} stays booked. Message staff if you need help.`, link: `/app/trips/${b.id}` })
    set({ data })
    return { ok: true }
  },

  completeBooking: (bookingId) => {
    const data = structuredClone(get().data)
    const b = data.bookings.find((x) => x.id === bookingId)
    if (!b) return { ok: false, error: 'Booking not found.' }
    if (b.status !== 'Confirmed') return { ok: false, error: 'Only a confirmed booking can be marked completed.' }
    if (b.cancellationRequested) return { ok: false, error: 'Answer the cancellation request first.' }
    const m = money(b, data.payments)
    if (m.balance > 0) return { ok: false, error: `Record the balance of ${peso(m.balance)} before completing the trip.` }
    const at = demoNowStamp()
    b.status = 'Completed'
    b.completedAt = at
    activity(data, at, { category: 'Bookings', title: 'Trip completed', body: `${b.id} (${customerName(data, b.customerId)}) · ${tripTitle(data, b)}.`, link: `/admin/bookings?id=${b.id}` })
    tell(data, b.customerId, at, { category: 'Bookings', title: 'Trip completed', body: `Thanks for travelling with us on ${tripTitle(data, b)}! Rate your trip to help other travellers.`, link: `/app/reviews?trip=${b.id}` })
    set({ data })
    return { ok: true }
  },

  sendReminder: (bookingId) => {
    const data = structuredClone(get().data)
    const b = data.bookings.find((x) => x.id === bookingId)
    if (!b || b.status !== 'Confirmed') return { ok: false, error: 'Reminders go to confirmed bookings only.' }
    const svc = data.services.find((x) => x.id === b.serviceId)!
    const m = money(b, data.payments)
    const at = demoNowStamp()
    tell(data, b.customerId, at, {
      category: 'Travel', title: 'Trip reminder',
      body: `${tripTitle(data, b)} on ${shortRange(b.startDate, b.endDate)}. Pickup ${b.rental ? b.rental.pickup : svc.pickup}.${m.balance > 0 ? ` Balance of ${peso(m.balance)} is due before the trip.` : ''}`, link: `/app/trips/${b.id}`,
    })
    activity(data, at, { category: 'Travel', title: 'Reminder sent', body: `${b.id} (${customerName(data, b.customerId)}).`, link: `/admin/bookings?id=${b.id}` })
    set({ data })
    return { ok: true }
  },

  assign: (target, vehicleId, driverId) => {
    const data = structuredClone(get().data)
    const t = assignableTargets(data).find((x) => x.kind === target.kind && x.id === target.id)
    if (!t) return { ok: false, error: 'This trip cannot take a van yet. Confirm a booking first.' }
    const v = data.vehicles.find((x) => x.id === vehicleId)
    const dr = data.drivers.find((x) => x.id === driverId)
    if (!v || !dr) return { ok: false, error: 'Choose a van and a driver.' }
    const conflict = vehicleConflict(data, v, t) ?? driverConflict(data, dr, t)
    if (conflict) return { ok: false, error: conflict }
    const existing = data.assignments.find((a) => a.target.kind === t.kind && a.target.id === t.id)
    if (existing) {
      existing.vehicleId = v.id
      existing.driverId = dr.id
      existing.origin = 'local'
    } else {
      data.assignments.push({ id: nextId(data, 'assignment'), target: { kind: t.kind, id: t.id }, from: t.from, to: t.to, vehicleId: v.id, driverId: dr.id, origin: 'local' })
    }
    const at = demoNowStamp()
    activity(data, at, {
      category: 'Fleet', title: 'Van and driver assigned', body: `${t.label}, ${shortRange(t.from, t.to)} · ${v.name} with ${dr.name}.`, link: '/admin/calendar',
    })
    const riders = data.bookings.filter((b) => (t.kind === 'departure' ? b.departureId === t.id : b.id === t.id) && b.status === 'Confirmed')
    for (const b of riders) {
      tell(data, b.customerId, at, { category: 'Travel', title: existing ? 'Van or driver changed' : 'Van and driver assigned', body: `${tripTitle(data, b)}: ${v.name} (${v.plate}) with ${dr.name}.`, link: `/app/trips/${b.id}` })
    }
    set({ data })
    return { ok: true }
  },

  markRead: (id) => {
    const data = structuredClone(get().data)
    const n = data.notifications.find((x) => x.id === id && !x.customerId)
    if (!n || n.read) return
    n.read = true
    set({ data })
  },

  markAllRead: () => {
    const data = structuredClone(get().data)
    data.notifications.forEach((n) => {
      if (!n.customerId) n.read = true
    })
    set({ data })
  },

  replyInquiry: (inquiryId, text) => {
    if (!text.trim()) return { ok: false, error: 'Write a reply first.' }
    const data = structuredClone(get().data)
    const q = data.inquiries.find((x) => x.id === inquiryId)
    if (!q) return { ok: false, error: 'Inquiry not found.' }
    const at = demoNowStamp()
    q.messages.push({ from: 'staff', at, text: text.trim() })
    q.status = 'Staff replied'
    tell(data, q.customerId, at, { category: 'Messages', title: 'Staff replied', body: q.subject, link: `/app/messages/${q.id}` })
    set({ data })
    return { ok: true }
  },

  replyReview: (reviewId, text) => {
    if (!text.trim()) return { ok: false, error: 'Write a reply first.' }
    if (text.trim().length > 500) return { ok: false, error: 'Keep the reply under 500 characters.' }
    const data = structuredClone(get().data)
    const r = data.reviews.find((x) => x.id === reviewId)
    if (!r) return { ok: false, error: 'Review not found.' }
    r.staffReply = { text: text.trim(), at: demoNowStamp() }
    set({ data })
    return { ok: true }
  },

  resolveInquiry: (inquiryId) => {
    const data = structuredClone(get().data)
    const q = data.inquiries.find((x) => x.id === inquiryId)
    if (!q) return { ok: false, error: 'Inquiry not found.' }
    q.status = 'Resolved'
    set({ data })
    return { ok: true }
  },

  startReview: (kind, id) => {
    const data = structuredClone(get().data)
    const r = findRequest(data, kind, id)
    if (!r || !canTransition(r.status, 'Under review') || r.status !== 'Submitted') return { ok: false, error: 'Only a submitted request can be moved to review.' }
    const at = demoNowStamp()
    r.status = 'Under review'
    r.events.push({ at, status: 'Under review', note: 'Staff started reviewing the request.' })
    activity(data, at, { category: 'Requests', title: 'Request under review', body: `${r.id} (${customerName(data, r.customerId)}).`, link: `/admin/requests?id=${r.id}` })
    tell(data, r.customerId, at, { category: 'Requests', title: 'Request under review', body: `${r.id}: staff are working on your ${kind === 'custom' ? 'proposal' : 'quote'}.`, link: kind === 'custom' ? `/app/custom/${r.id}` : `/app/rentals/${r.id}` })
    set({ data })
    return { ok: true }
  },

  /** Sends the prepared proposal (custom trip) or the estimate as the quote (rental). */
  sendProposal: (kind, id) => {
    const data = structuredClone(get().data)
    const r = findRequest(data, kind, id)
    if (!r || r.status !== 'Under review') return { ok: false, error: 'Move the request to review first.' }
    const at = demoNowStamp()
    const validUntil = addDays(at.slice(0, 10), PROPOSAL_VALID_DAYS)
    if (kind === 'custom') {
      const c = r as CustomRequest
      const dest = requestDestination(data, c)
      const draft = c.draftProposal ?? draftCustomProposal(c, dest, at)
      if (needsDates(c) && !draft.datesSet) return { ok: false, error: 'The customer’s dates are not fixed. Set the trip dates in the proposal before sending it.' }
      c.proposal = { ...draft, sentAt: at, validUntil: addDays(at.slice(0, 10), draft.validDays ?? PROPOSAL_VALID_DAYS) }
      c.draftProposal = undefined
    } else {
      const v = r as RentalRequest
      v.quote = { ...v.estimate, note: 'Confirmed as estimated.', sentAt: at, validUntil }
    }
    const total = kind === 'custom' ? (r as CustomRequest).proposal!.total : (r as RentalRequest).quote!.total
    r.status = 'Proposal ready'
    r.events.push({ at, status: 'Proposal ready', note: `${kind === 'custom' ? 'Proposal' : 'Quote'} sent: ${peso(total)}.` })
    activity(data, at, { category: 'Requests', title: kind === 'custom' ? 'Proposal sent' : 'Quote sent', body: `${r.id} (${customerName(data, r.customerId)}) · ${peso(total)}.`, link: `/admin/requests?id=${r.id}` })
    tell(data, r.customerId, at, {
      category: 'Requests', title: kind === 'custom' ? 'Your trip proposal is ready' : 'Your van rental quote is ready', body: `${r.id}: ${peso(total)}. Review it and accept or ask for changes.`,
      link: kind === 'custom' ? `/app/custom/${r.id}` : `/app/rentals/${r.id}`,
    })
    set({ data })
    return { ok: true }
  },

  closeRequest: (kind, id, reason) => {
    if (!reason.trim()) return { ok: false, error: 'Enter a reason for closing the request.' }
    const data = structuredClone(get().data)
    const r = findRequest(data, kind, id)
    if (!r || !canTransition(r.status, 'Closed')) return { ok: false, error: 'This request can no longer be closed.' }
    const at = demoNowStamp()
    r.status = 'Closed'
    r.events.push({ at, status: 'Closed', note: reason.trim() })
    activity(data, at, { category: 'Requests', title: 'Request closed', body: `${r.id} (${customerName(data, r.customerId)}): ${reason.trim()}`, link: `/admin/requests?id=${r.id}` })
    tell(data, r.customerId, at, { category: 'Requests', title: 'Request closed', body: `${r.id}: ${reason.trim()}`, link: kind === 'custom' ? `/app/custom/${r.id}` : `/app/rentals/${r.id}` })
    set({ data })
    return { ok: true }
  },

  updateProfile: ({ name, mobile }) => {
    const s = get()
    if (name.trim().length < 2) return fail('Enter your name.')
    if (!mobileOk(mobile)) return fail('Use the format 09XX XXX XXXX.')
    set({ accounts: s.accounts.map((a) => (a.id === s.userId ? { ...a, name: name.trim(), mobile: mobile.trim() } : a)) })
    return OK
  },

  changePassword: (current, next) => {
    const s = get()
    const me = s.accounts.find((a) => a.id === s.userId)
    if (!me) return fail('Log in again to change your password.')
    if (current !== me.password) return fail('Your current password is incorrect.')
    if (next.length < 8 || !/\d/.test(next) || !/[A-Za-z]/.test(next)) return fail('Use at least 8 characters with letters and a number.')
    if (next === current) return fail('Choose a password you have not used here.')
    set({ accounts: s.accounts.map((a) => (a.id === me.id ? { ...a, password: next } : a)) })
    return OK
  },

  saveSettings: (x) => {
    if (!isAdmin(get())) return fail(ADMIN_ONLY)
    if (x.businessName.trim().length < 2) return fail('Enter the business name.')
    if (!EMAIL.test(x.email.trim())) return fail('Enter a valid email address.')
    if (!mobileOk(x.mobile)) return fail('Use the format 09XX XXX XXXX for the mobile number.')
    set({ settings: { businessName: x.businessName.trim(), email: x.email.trim(), mobile: x.mobile.trim(), address: x.address.trim(), hours: x.hours.trim() } })
    return OK
  },

  saveStaff: (id, x) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    if (x.name.trim().length < 2) return fail('Enter the staff member’s name.')
    if (!EMAIL.test(x.email.trim())) return fail('Enter a valid email address.')
    if (s.accounts.some((a) => a.id !== id && a.email.toLowerCase() === x.email.trim().toLowerCase())) return fail('Another account already uses this email.')
    if (!mobileOk(x.mobile)) return fail('Use the format 09XX XXX XXXX for the mobile number.')
    if (!id && (!x.password || x.password.length < 8)) return fail('Set a temporary password of at least 8 characters.')
    if (id === s.userId && x.role !== 'Admin') return fail('You cannot remove your own admin role.')
    const clean = { name: x.name.trim(), email: x.email.trim(), role: x.role, title: x.title.trim(), mobile: x.mobile.trim() }
    if (id) set({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, ...clean, ...(x.password ? { password: x.password } : {}) } : a)) })
    else {
      const n = Math.max(0, ...s.accounts.map((a) => Number(a.id.slice(4)))) + 1
      set({ accounts: [...s.accounts, { id: `STF-${String(n).padStart(2, '0')}`, ...clean, password: x.password!, active: true, createdAt: DEMO_TODAY }] })
    }
    return OK
  },

  setStaffActive: (id, active) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    if (id === s.userId) return fail('You cannot deactivate your own account.')
    set({ accounts: s.accounts.map((a) => (a.id === id ? { ...a, active } : a)) })
    return OK
  },

  deleteStaff: (id) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    if (id === s.userId) return fail('You cannot delete your own account.')
    set({ accounts: s.accounts.filter((a) => a.id !== id) })
    return OK
  },

  saveVehicle: (id, x) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    if (x.name.trim().length < 2) return fail('Enter the van’s name, for example Van 07.')
    if (x.model.trim().length < 3) return fail('Enter the make, model and year.')
    if (!/^[A-Z]{3}\s?\d{3,4}$/i.test(x.plate.trim())) return fail('Enter the plate number, for example TMS 1007.')
    if (s.data.vehicles.some((v) => v.id !== id && v.plate.replace(/\s/g, '').toUpperCase() === x.plate.replace(/\s/g, '').toUpperCase())) return fail('Another van already has this plate number.')
    if (!Number.isInteger(x.seats) || x.seats < 4 || x.seats > 18) return fail('Seats must be between 4 and 18.')
    const data = structuredClone(s.data)
    const clean = { ...x, name: x.name.trim(), model: x.model.trim(), plate: x.plate.trim().toUpperCase(), color: x.color?.trim() }
    let vid = id
    if (id) Object.assign(data.vehicles.find((v) => v.id === id)!, clean)
    else {
      const n = Math.max(0, ...data.vehicles.map((v) => Number(v.id.slice(4)))) + 1
      vid = `VAN-${String(n).padStart(2, '0')}`
      data.vehicles.push({ id: vid, ...clean, blocks: [] })
    }
    activity(data, demoNowStamp(), { category: 'Fleet', title: id ? 'Van details updated' : 'Van added', body: `${clean.name} · ${clean.plate}.`, link: `/admin/vehicles?id=${vid}` })
    set({ data })
    return OK
  },

  deleteVehicle: (id) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    const upcoming = s.data.assignments.filter((a) => a.vehicleId === id && a.to >= DEMO_TODAY)
    if (upcoming.length) return fail(`This van has ${upcoming.length} upcoming ${upcoming.length === 1 ? 'trip' : 'trips'}. Reassign ${upcoming.length === 1 ? 'it' : 'them'} first.`)
    const data = structuredClone(s.data)
    const v = data.vehicles.find((x) => x.id === id)
    if (!v) return fail('Van not found.')
    data.vehicles = data.vehicles.filter((x) => x.id !== id)
    activity(data, demoNowStamp(), { category: 'Fleet', title: 'Van removed', body: `${v.name} · ${v.plate}.`, link: '/admin/vehicles' })
    set({ data, maintenance: s.maintenance.filter((m) => m.vehicleId !== id) })
    return OK
  },

  saveDriver: (id, x) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    if (x.name.trim().length < 2) return fail('Enter the driver’s name.')
    if (!mobileOk(x.mobile)) return fail('Use the format 09XX XXX XXXX for the mobile number.')
    if (!x.license || x.license.trim().length < 6) return fail('Enter the driver’s license number.')
    if (!x.licenseExpiry) return fail('Enter the license expiry date.')
    if (x.licenseExpiry < DEMO_TODAY) return fail('This license has expired. Drivers need a valid license.')
    const data = structuredClone(s.data)
    const clean = { ...x, name: x.name.trim(), mobile: x.mobile.trim(), license: x.license.trim().toUpperCase() }
    let did = id
    if (id) Object.assign(data.drivers.find((d) => d.id === id)!, clean)
    else {
      const n = Math.max(0, ...data.drivers.map((d) => Number(d.id.slice(4)))) + 1
      did = `DRV-${String(n).padStart(2, '0')}`
      data.drivers.push({ id: did, ...clean, since: clean.since || DEMO_TODAY, blocks: [] })
    }
    activity(data, demoNowStamp(), { category: 'Fleet', title: id ? 'Driver details updated' : 'Driver added', body: clean.name, link: `/admin/drivers?id=${did}` })
    set({ data })
    return OK
  },

  deleteDriver: (id) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    const upcoming = s.data.assignments.filter((a) => a.driverId === id && a.to >= DEMO_TODAY)
    if (upcoming.length) return fail(`This driver has ${upcoming.length} upcoming ${upcoming.length === 1 ? 'trip' : 'trips'}. Reassign ${upcoming.length === 1 ? 'it' : 'them'} first.`)
    const data = structuredClone(s.data)
    const d = data.drivers.find((x) => x.id === id)
    if (!d) return fail('Driver not found.')
    data.drivers = data.drivers.filter((x) => x.id !== id)
    activity(data, demoNowStamp(), { category: 'Fleet', title: 'Driver removed', body: d.name, link: '/admin/drivers' })
    set({ data })
    return OK
  },

  scheduleMaintenance: (x) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    if (x.type.trim().length < 3) return fail('Describe the maintenance, for example Oil change.')
    const err = maintenanceDatesError(s.data, x.vehicleId, x.from, x.to)
    if (err) return fail(err)
    const data = structuredClone(s.data)
    const v = data.vehicles.find((y) => y.id === x.vehicleId)!
    const n = Math.max(0, ...s.maintenance.map((m) => Number(m.id.slice(4)))) + 1
    const id = `MNT-${String(n).padStart(2, '0')}`
    v.blocks.push({ from: x.from, to: x.to, kind: 'maintenance', note: x.type.trim(), ref: id, untilDone: true })
    activity(data, demoNowStamp(), { category: 'Fleet', title: 'Maintenance scheduled', body: `${v.name} · ${x.type.trim()}, ${shortRange(x.from, x.to)}.`, link: '/admin/maintenance' })
    set({ data, maintenance: [...s.maintenance, { id, ...x, type: x.type.trim(), note: x.note.trim(), status: 'Scheduled' }] })
    return OK
  },

  rescheduleMaintenance: (id, from, to) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    const m = s.maintenance.find((y) => y.id === id)
    if (!m || m.status !== 'Scheduled') return fail('Only scheduled maintenance can be moved.')
    const err = maintenanceDatesError(s.data, m.vehicleId, from, to, id)
    if (err) return fail(err)
    const data = structuredClone(s.data)
    const v = data.vehicles.find((y) => y.id === m.vehicleId)!
    const blk = v.blocks.find((b) => b.ref === id)
    if (blk) Object.assign(blk, { from, to })
    activity(data, demoNowStamp(), { category: 'Fleet', title: 'Maintenance rescheduled', body: `${v.name} · ${m.type}, now ${shortRange(from, to)}.`, link: '/admin/maintenance' })
    set({ data, maintenance: s.maintenance.map((y) => (y.id === id ? { ...y, from, to } : y)) })
    return OK
  },

  completeMaintenance: (id, note) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    const m = s.maintenance.find((y) => y.id === id)
    if (!m || m.status !== 'Scheduled') return fail('This maintenance is already closed.')
    if (m.from > DEMO_TODAY) return fail('This maintenance has not started yet. Reschedule it if the work was done early.')
    const data = structuredClone(s.data)
    const v = data.vehicles.find((y) => y.id === m.vehicleId)!
    v.blocks = v.blocks.filter((b) => b.ref !== id)
    const at = demoNowStamp()
    activity(data, at, { category: 'Fleet', title: 'Maintenance done', body: `${v.name} · ${m.type}. The van is back in service.`, link: '/admin/maintenance' })
    set({ data, maintenance: s.maintenance.map((y) => (y.id === id ? { ...y, status: 'Done', doneAt: at, doneNote: note.trim() || 'Completed.' } : y)) })
    return OK
  },

  cancelMaintenance: (id) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    const m = s.maintenance.find((y) => y.id === id)
    if (!m || m.status !== 'Scheduled') return fail('Only scheduled maintenance can be cancelled.')
    const data = structuredClone(s.data)
    const v = data.vehicles.find((y) => y.id === m.vehicleId)!
    v.blocks = v.blocks.filter((b) => b.ref !== id)
    activity(data, demoNowStamp(), { category: 'Fleet', title: 'Maintenance cancelled', body: `${v.name} · ${m.type}.`, link: '/admin/maintenance' })
    set({ data, maintenance: s.maintenance.filter((y) => y.id !== id) })
    return OK
  },

  savePackage: (id, x) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    const before = id ? s.data.services.find((v) => v.id === id) : undefined
    if (id && !before) return fail('Package not found.')
    const err = packageError(x, s.data, id)
    if (err) return fail(err)
    const data = structuredClone(s.data)
    const dest = data.destinations.find((d) => d.id === x.destinationId)!
    const lines = (l: string[]) => l.map((v) => v.trim()).filter(Boolean)
    const clean = {
      name: x.name.trim(), destinationId: x.destinationId, destination: before && before.destinationId === x.destinationId ? before.destination : dest.name, duration: x.duration.trim(), days: x.days, price: x.price, pickup: x.pickup.trim(), pickupTime: x.pickupTime,
      summary: x.summary.trim(), itinerary: lines(x.itinerary), inclusions: lines(x.inclusions), exclusions: lines(x.exclusions),
      priceBasis: x.priceBasis ?? before?.priceBasis ?? 'person', capacity: x.capacity ?? before?.capacity ?? 12, season: x.season?.trim() || undefined,
      description: x.description?.trim() || undefined, image: 'image' in x ? x.image : before?.image,
    }
    let sid = id
    let svc: Service
    if (before) {
      svc = data.services.find((v) => v.id === id)!
      Object.assign(svc, clean)
      if (x.datesReviewed) delete svc.datesUnreviewed
    } else {
      const code = dest.id.replace('DST-', '').slice(0, 3)
      let n = 1
      sid = `SVC-${code}`
      while (data.services.some((v) => v.id === sid)) sid = `SVC-${code}${++n}`
      svc = { id: sid!, type: 'tour', unit: 'person', tint: ['#1D3A7A', '#C8282F'], interests: dest.interests, ...clean }
      setStatus(svc, x.publish ? 'Active' : 'Draft')
      const at = data.services.findIndex((v) => v.type !== 'tour')
      data.services.splice(at < 0 ? data.services.length : at, 0, svc)
    }
    if (x.departures) {
      const depErr = applyDepartures(data, svc, x.departures)
      if (depErr) return fail(depErr)
    }
    if (packageStatus(svc) === 'Active') {
      const why = activationError(data, svc)
      if (why) return fail(why)
    }
    const at = demoNowStamp()
    const changes = before ? changesOf({ ...before, priceBasis: priceBasisOf(before), capacity: before.capacity ?? 12 }, svc, PACKAGE_FIELDS, { price: (v) => peso(Number(v)), image: (v) => (v ? 'Custom photo' : 'Destination photo') }) : []
    const depNote = before && x.departures ? departureChanges(s.data, data, svc.id) : ''
    if (before && changes.length === 0 && !depNote && !x.datesReviewed) return OK
    logActivity(data, at, {
      actor: actorOf(s), module: 'Packages', recordId: svc.id, recordLabel: svc.name, action: before ? 'Edited' : 'Created',
      description: before ? [changes.length ? `Changed ${changes.map((c) => c.field.toLowerCase()).join(', ')}` : '', depNote, x.datesReviewed ? 'Departure dates reviewed' : ''].filter(Boolean).join('. ') + '.' : `Added as ${packageStatus(svc)} · ${peso(svc.price)} ${priceBasisOf(svc) === 'group' ? 'per group' : 'per person'}.`,
      changes: changes.length ? changes : undefined,
    })
    activity(data, at, { category: 'Bookings', title: before ? 'Tour package updated' : 'Tour package added', body: `${svc.name} · ${peso(svc.price)}.`, link: `/admin/packages?id=${sid}` })
    set({ data })
    return { ok: true, id: sid! }
  },

  setPackageStatus: (id, status) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    const data = structuredClone(s.data)
    const svc = data.services.find((v) => v.id === id && v.type === 'tour')
    if (!svc) return fail('Package not found.')
    const from = packageStatus(svc)
    if (from === status) return OK
    if (status === 'Active') {
      const why = activationError(data, svc)
      if (why) return fail(why)
    }
    if (status === 'Draft' && packageUsage(data, id).bookings > 0) return fail('A package with bookings cannot go back to Draft. Deactivate it instead.')
    setStatus(svc, status)
    const at = demoNowStamp()
    const verb = status === 'Active' ? (from === 'Draft' ? 'Activated' : 'Reactivated') : status === 'Inactive' ? (from === 'Archived' ? 'Restored' : 'Deactivated') : status === 'Archived' ? 'Archived' : 'Moved to draft'
    const use = packageUsage(data, id)
    logActivity(data, at, {
      actor: actorOf(s), module: 'Packages', recordId: id, recordLabel: svc.name, action: verb,
      description: status === 'Active' ? 'Open for new bookings.' : `No new bookings.${use.upcoming ? ` ${use.upcoming} upcoming ${use.upcoming === 1 ? 'booking keeps' : 'bookings keep'} the agreed details.` : ''}`,
      changes: [{ field: 'Status', from, to: status }],
    })
    activity(data, at, { category: 'Bookings', title: `Tour package ${verb.toLowerCase()}`, body: svc.name, link: `/admin/packages?id=${id}` })
    set({ data })
    return OK
  },

  setPackageActive: (id, active) => get().setPackageStatus(id, active ? 'Active' : 'Inactive'),

  duplicatePackage: (id) => {
    const s = get()
    if (!isAdmin(s)) return { ok: false, error: ADMIN_ONLY }
    const src = s.data.services.find((v) => v.id === id && v.type === 'tour')
    if (!src) return { ok: false, error: 'Package not found.' }
    const data = structuredClone(s.data)
    let n = 2
    let nid = `${src.id}-C`
    while (data.services.some((v) => v.id === nid)) nid = `${src.id}-C${n++}`
    // Reusable content only: no bookings, reviews, payments, promos or van assignments come along.
    const copy: Service = { ...structuredClone(src), id: nid, name: `${src.name} (copy)`, copiedFrom: src.id, datesUnreviewed: true }
    setStatus(copy, 'Draft')
    data.services.splice(data.services.indexOf(data.services.find((v) => v.id === src.id)!) + 1, 0, copy)
    for (const dep of data.departures.filter((x) => x.serviceId === src.id && x.startDate > DEMO_TODAY)) {
      data.departures.push({ id: uniqueDepId(data, nid, dep.startDate), serviceId: nid, startDate: dep.startDate, endDate: dep.endDate, capacity: dep.capacity })
    }
    const at = demoNowStamp()
    logActivity(data, at, { actor: actorOf(s), module: 'Packages', recordId: nid, recordLabel: copy.name, action: 'Duplicated', description: `Copied from ${src.name} (${src.id}) as a Draft. Departure dates need review before activation.` })
    set({ data })
    return { ok: true, id: nid }
  },

  deletePackage: (id) => {
    const s = get()
    if (!isAdmin(s)) return fail(ADMIN_ONLY)
    const used = packageUsage(s.data, id)
    if (used.bookings > 0) return fail(`This package has ${used.bookings} ${used.bookings === 1 ? 'booking' : 'bookings'} on record. Archive or deactivate it instead so the booking history stays intact.`)
    if (used.reviews > 0) return fail(`This package has ${used.reviews} ${used.reviews === 1 ? 'review' : 'reviews'}. Archive it instead so they stay on record.`)
    if (used.assignments > 0) return fail('A van is assigned to one of its departures. Archive it instead.')
    const data = structuredClone(s.data)
    const svc = data.services.find((v) => v.id === id)
    if (!svc) return fail('Package not found.')
    data.services = data.services.filter((v) => v.id !== id)
    data.departures = data.departures.filter((d) => d.serviceId !== id)
    const at = demoNowStamp()
    logActivity(data, at, { actor: actorOf(s), module: 'Packages', recordId: id, recordLabel: svc.name, action: 'Deleted', description: 'Removed with its departures. It had no bookings, reviews or assignments.' })
    activity(data, at, { category: 'Bookings', title: 'Tour package deleted', body: svc.name, link: '/admin/packages' })
    set({ data })
    return OK
  },

  saveDraftProposal: (id, p) => {
    const data = structuredClone(get().data)
    const r = data.customRequests.find((x) => x.id === id)
    if (!r || r.status !== 'Under review') return fail('Only a request under review can be edited.')
    const err = proposalError(p)
    if (err) return fail(err)
    const lines = p.lines.map((l) => ({ ...l, label: l.label.trim(), unit: l.unit.trim(), amount: l.unitPrice * l.qty }))
    r.draftProposal = {
      ...p, title: p.title.trim(), lines, total: lines.reduce((n, l) => n + l.amount, 0), note: p.note?.trim() || undefined,
      itinerary: p.itinerary.map((l) => l.trim()).filter(Boolean), inclusions: p.inclusions.map((l) => l.trim()).filter(Boolean), exclusions: p.exclusions.map((l) => l.trim()).filter(Boolean),
    }
    set({ data })
    return OK
  },

  reviseProposal: (id) => {
    const data = structuredClone(get().data)
    const r = data.customRequests.find((x) => x.id === id)
    if (!r || !r.proposal || (r.status !== 'Proposal ready' && r.status !== 'Under review')) return fail('There is no sent proposal to revise.')
    const at = demoNowStamp()
    if (r.status === 'Proposal ready') {
      r.status = 'Under review'
      r.events.push({ at, status: 'Under review', note: 'Staff are revising the proposal.' })
    }
    r.draftProposal = { ...r.proposal }
    set({ data })
    return OK
  },

  reset: () => {
    writeSession({ staffId: null })
    set(initial(true))
  },
}))

const isAdmin = (s: { accounts: StaffAccount[]; userId: string | null }) => s.accounts.find((a) => a.id === s.userId)?.role === 'Admin'

/** "Name (Role)" of the signed-in account, for the activity history. */
export const actorOf = (s: { accounts: StaffAccount[]; userId: string | null }) => {
  const me = s.accounts.find((a) => a.id === s.userId)
  return me ? `${me.name} (${me.role})` : 'Staff'
}

/** Flexible or undecided dates need firm dates from staff before a proposal goes out. */
export const needsDates = (r: CustomRequest) => !!r.plan?.datesTbd || r.flexibility === 'Flexible dates' || r.flexibility === 'Dates to be decided'

export function maintenanceDatesError(d: Dataset, vehicleId: string, from: string, to: string, ignore?: string): string | null {
  const v = d.vehicles.find((x) => x.id === vehicleId)
  if (!v) return 'Choose a van.'
  if (!from || !to) return 'Choose the start and end dates.'
  if (to < from) return 'The end date must be on or after the start date.'
  if (from < DEMO_TODAY) return 'Maintenance can only be scheduled from today onwards.'
  const trip = d.assignments.find((a) => a.vehicleId === vehicleId && a.from <= to && a.to >= from)
  if (trip) return `${v.name} is assigned to ${trip.target.id} on ${shortRange(trip.from, trip.to)}. Reassign the trip or pick other dates.`
  const other = v.blocks.find((b) => b.ref !== ignore && b.from <= to && b.to >= from)
  if (other) return `${v.name} is already out of service ${shortRange(other.from, other.to)} (${other.note}).`
  return null
}

export function packageUsage(d: Dataset, serviceId: string) {
  const deps = d.departures.filter((x) => x.serviceId === serviceId)
  const depIds = new Set(deps.map((x) => x.id))
  const bookings = d.bookings.filter((b) => b.serviceId === serviceId)
  const upcoming = bookings.filter((b) => b.endDate >= DEMO_TODAY && b.status !== 'Cancelled')
  return {
    departures: deps.length, openDepartures: deps.filter((x) => x.startDate >= DEMO_TODAY).length, bookings: bookings.length, upcoming: upcoming.length,
    reviews: d.reviews.filter((r) => r.serviceId === serviceId).length,
    assignments: d.assignments.filter((a) => a.target.kind === 'departure' && depIds.has(a.target.id)).length,
  }
}

/** Seats taken on a departure by bookings that still hold them or already travelled. */
const seatsTaken = (d: Dataset, depId: string) => d.bookings.filter((b) => b.departureId === depId && b.status !== 'Cancelled').reduce((n, b) => n + b.pax, 0)
const hasBookings = (d: Dataset, depId: string) => d.bookings.some((b) => b.departureId === depId)

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/
export const MAX_CAPACITY = 60

export function packageError(x: PackageInput, d?: Dataset, id?: string | null): string | null {
  if (x.name.trim().length < 4) return 'Enter the package name.'
  if (d && d.services.some((s) => s.id !== id && s.type === 'tour' && s.name.trim().toLowerCase() === x.name.trim().toLowerCase())) return 'Another package already has this name.'
  if (!x.destinationId) return 'Choose the destination.'
  if (x.duration.trim().length < 3) return 'Enter the duration, for example 2 days / 1 night.'
  if (!Number.isInteger(x.days) || x.days < 1 || x.days > 10) return 'Days must be a whole number from 1 to 10.'
  if (!Number.isFinite(x.price) || !Number.isInteger(x.price)) return 'Enter the price in whole pesos.'
  if (x.price < 500) return `Set a price of at least ₱500 ${x.priceBasis === 'group' ? 'for the group' : 'per person'}.`
  if (x.price > 500_000) return 'That price looks too high. Check the amount.'
  if (x.capacity !== undefined && (!Number.isInteger(x.capacity) || x.capacity < 1 || x.capacity > MAX_CAPACITY)) return `Capacity must be from 1 to ${MAX_CAPACITY} seats.`
  if (x.pickup.trim().length < 3) return 'Enter the pickup point.'
  if (!/^\d{2}:\d{2}$/.test(x.pickupTime)) return 'Choose the pickup time.'
  if (x.summary.trim().length < 10) return 'Write a short summary for the tour page.'
  if (x.itinerary.filter((l) => l.trim()).length === 0) return 'Add at least one itinerary line.'
  if (x.inclusions.filter((l) => l.trim()).length === 0) return 'Add at least one inclusion, for example Round-trip van.'
  if (x.departures) {
    const seen = new Set<string>()
    for (const [i, r] of x.departures.entries()) {
      const label = `Departure ${i + 1}`
      if (!ISO_DAY.test(r.startDate)) return `${label}: choose a start date.`
      if (seen.has(r.startDate)) return `${label}: there is already a departure on that date.`
      seen.add(r.startDate)
      const existing = r.id && d?.departures.find((y) => y.id === r.id)
      if (!existing && r.startDate <= DEMO_TODAY) return `${label}: new departures must start after today.`
      if (!Number.isInteger(r.capacity) || r.capacity < 1 || r.capacity > MAX_CAPACITY) return `${label}: capacity must be from 1 to ${MAX_CAPACITY} seats.`
      if (existing && d) {
        const taken = seatsTaken(d, existing.id)
        if (r.capacity < taken) return `${label}: ${taken} seats are already booked, so capacity cannot go below ${taken}.`
        if (hasBookings(d, existing.id) && r.startDate !== existing.startDate) return `${label} has bookings, so its date cannot change. Add a new departure instead.`
      }
    }
    if (d && id) {
      for (const dep of d.departures.filter((y) => y.serviceId === id)) {
        if (!x.departures.some((r) => r.id === dep.id) && hasBookings(d, dep.id)) return `The ${dep.startDate} departure has bookings, so it cannot be removed.`
      }
    }
  }
  return null
}

/** Why a package cannot be opened for bookings yet, or null. */
export function activationError(d: Dataset, s: Service): string | null {
  if (s.datesUnreviewed) return 'Review the departure dates of this copy before activating it.'
  const err = packageError(s, d, s.id)
  if (err) return err
  if (!d.destinations.some((x) => x.id === s.destinationId)) return 'Choose the destination.'
  return null
}

export function uniqueDepId(d: Dataset, serviceId: string, startDate: string) {
  const base = `DEP-${serviceId.slice(4)}-${startDate.slice(5, 7)}${startDate.slice(8, 10)}`
  let id = base
  let n = 2
  while (d.departures.some((x) => x.id === id)) id = `${base}-${n++}`
  return id
}

/** Applies the edited schedule. Departures with bookings keep their dates; others follow the package length. */
function applyDepartures(d: Dataset, svc: Service, rows: DepartureInput[]): string | null {
  const keep = new Set(rows.filter((r) => r.id).map((r) => r.id!))
  d.departures = d.departures.filter((x) => x.serviceId !== svc.id || keep.has(x.id))
  for (const r of rows) {
    const dep = r.id && d.departures.find((x) => x.id === r.id)
    if (dep) {
      dep.capacity = r.capacity
      if (!hasBookings(d, dep.id)) Object.assign(dep, { startDate: r.startDate, endDate: addDays(r.startDate, svc.days - 1) })
    } else {
      d.departures.push({ id: uniqueDepId(d, svc.id, r.startDate), serviceId: svc.id, startDate: r.startDate, endDate: addDays(r.startDate, svc.days - 1), capacity: r.capacity })
    }
  }
  return null
}

function departureChanges(before: Dataset, after: Dataset, serviceId: string) {
  const a = before.departures.filter((x) => x.serviceId === serviceId)
  const b = after.departures.filter((x) => x.serviceId === serviceId)
  const added = b.filter((x) => !a.some((y) => y.id === x.id)).length
  const removed = a.filter((x) => !b.some((y) => y.id === x.id)).length
  const changed = b.filter((x) => {
    const y = a.find((z) => z.id === x.id)
    return y && (y.startDate !== x.startDate || y.capacity !== x.capacity)
  }).length
  const parts = [added && `${added} departure${added > 1 ? 's' : ''} added`, removed && `${removed} removed`, changed && `${changed} changed`].filter(Boolean)
  return parts.length ? `Schedule: ${parts.join(', ')}` : ''
}

const PACKAGE_FIELDS: Partial<Record<keyof Service, string>> = {
  name: 'Title', destination: 'Destination', season: 'Season', duration: 'Duration', days: 'Days', price: 'Price', priceBasis: 'Price basis', capacity: 'Capacity',
  pickup: 'Pickup point', pickupTime: 'Pickup time', summary: 'Summary', description: 'Description', itinerary: 'Itinerary', inclusions: 'Inclusions', exclusions: 'Exclusions', image: 'Photo',
}

/** Departures customers can still book on, for the package list. */
export const openDeparturesOf = (d: Dataset, serviceId: string) =>
  d.departures.filter((x) => x.serviceId === serviceId).filter((x) => departureAvailability(x, d.bookings).state === 'open').sort((a, b) => a.startDate.localeCompare(b.startDate))

export function proposalError(p: Proposal): string | null {
  if (p.title.trim().length < 3) return 'Enter a proposal title.'
  if (!p.startDate || !p.endDate) return 'Set the trip dates.'
  if (p.endDate < p.startDate) return 'The end date must be on or after the start date.'
  if (p.startDate < DEMO_TODAY) return 'The trip dates are in the past.'
  if (p.itinerary.filter((l) => l.trim()).length === 0) return 'Add at least one itinerary line.'
  if (p.lines.length === 0) return 'Add at least one price line.'
  for (const l of p.lines) {
    if (!l.label.trim()) return 'Every price line needs a description.'
    if (!Number.isFinite(l.unitPrice) || l.unitPrice < 0) return `Check the price for “${l.label}”.`
    if (!Number.isInteger(l.qty) || l.qty < 1) return `Check the quantity for “${l.label}”.`
  }
  return null
}
