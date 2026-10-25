import { create } from 'zustand'
import { demoNowStamp } from '../lib/demoClock'
import { peso } from '../lib/format'
import { canTransition, draftCustomProposal, PROPOSAL_VALID_DAYS, requestDestination } from '../domain/requests'
import { assignableTargets, canCancel, canConfirm, driverConflict, shortRange, vehicleConflict } from '../domain/rules'
import { addDays } from '../lib/demoClock'
import { adminSeed } from '../seed/derive'
import type { AppNotification, CustomRequest, Dataset, RentalRequest } from '../seed/types'
import { nextId } from './ids'

// Admin simulation: its own in-memory working copy of the seed. It never sees anything the customer demo did.

export const DEMO_ADMIN = { email: 'admin@tamsap.example.com', password: 'Admin2026!', name: 'Admin' }
export const MAX_ATTEMPTS = 5
export const LOCKOUT_MS = 30_000

type Result = { ok: true } | { ok: false; error: string }

interface AdminState {
  data: Dataset
  loggedIn: boolean
  failedAttempts: number
  lockedUntil: number | null
  login: (email: string, password: string) => Result
  logout: () => void
  verifyPayment: (paymentId: string) => Result
  rejectPayment: (paymentId: string, reason: string) => Result
  confirmBooking: (bookingId: string) => Result
  cancelBooking: (bookingId: string, reason: string) => Result
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

const initial = () => ({ data: adminSeed(), loggedIn: false, failedAttempts: 0, lockedUntil: null as number | null })

/** Adds a staff activity entry. Admin actions are already seen, so they are created as read. */
function activity(d: Dataset, at: string, n: Omit<AppNotification, 'id' | 'at' | 'read' | 'origin'>) {
  d.notifications.unshift({ id: nextId(d, 'notification'), at, read: true, origin: 'local', ...n })
}

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
    if (email.trim().toLowerCase() !== DEMO_ADMIN.email || password !== DEMO_ADMIN.password) {
      const failedAttempts = s.failedAttempts + 1
      if (failedAttempts >= MAX_ATTEMPTS) {
        set({ failedAttempts: 0, lockedUntil: Date.now() + LOCKOUT_MS })
        return { ok: false, error: 'Too many attempts. Login is locked for 30 seconds.' }
      }
      set({ failedAttempts, lockedUntil: null })
      return { ok: false, error: `Email or password is incorrect. ${MAX_ATTEMPTS - failedAttempts} attempts left.` }
    }
    set({ loggedIn: true, failedAttempts: 0, lockedUntil: null })
    return { ok: true }
  },

  logout: () => set({ loggedIn: false }),

  verifyPayment: (paymentId) => {
    const data = structuredClone(get().data)
    const p = data.payments.find((x) => x.id === paymentId)
    if (!p || p.status !== 'Submitted') return { ok: false, error: 'Only a submitted payment can be verified.' }
    const b = data.bookings.find((x) => x.id === p.bookingId)!
    const at = demoNowStamp('admin')
    p.status = 'Verified'
    p.reviewedAt = at
    activity(data, at, {
      category: 'Payments', title: 'Payment verified',
      body: `${b.id} (${customerName(data, b.customerId)}) ${p.type.toLowerCase()} of ${peso(p.amount)}.`, link: `/admin/bookings?id=${b.id}`,
    })
    set({ data })
    return { ok: true }
  },

  rejectPayment: (paymentId, reason) => {
    if (!reason.trim()) return { ok: false, error: 'Enter a reason so the customer knows what to fix.' }
    const data = structuredClone(get().data)
    const p = data.payments.find((x) => x.id === paymentId)
    if (!p || p.status !== 'Submitted') return { ok: false, error: 'Only a submitted payment can be rejected.' }
    const b = data.bookings.find((x) => x.id === p.bookingId)!
    const at = demoNowStamp('admin')
    p.status = 'Rejected'
    p.reviewedAt = at
    p.rejectReason = reason.trim()
    activity(data, at, {
      category: 'Payments', title: 'Payment rejected', body: `${b.id} (${customerName(data, b.customerId)}): ${p.rejectReason}`, link: `/admin/bookings?id=${b.id}`,
    })
    set({ data })
    return { ok: true }
  },

  confirmBooking: (bookingId) => {
    const data = structuredClone(get().data)
    const b = data.bookings.find((x) => x.id === bookingId)
    if (!b) return { ok: false, error: 'Booking not found.' }
    const check = canConfirm(b, data.payments)
    if (!check.ok) return { ok: false, error: check.reason }
    const at = demoNowStamp('admin')
    b.status = 'Confirmed'
    b.confirmedAt = at
    const svc = data.services.find((s) => s.id === b.serviceId)!
    activity(data, at, {
      category: 'Bookings', title: 'Booking confirmed',
      body: `${b.id} (${customerName(data, b.customerId)}) · ${svc.name}, ${shortRange(b.startDate, b.endDate)}.`, link: `/admin/bookings?id=${b.id}`,
    })
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
    const at = demoNowStamp('admin')
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
    activity(data, demoNowStamp('admin'), {
      category: 'Fleet', title: 'Van and driver assigned', body: `${t.label}, ${shortRange(t.from, t.to)} · ${v.name} with ${dr.name}.`, link: '/admin/calendar',
    })
    set({ data })
    return { ok: true }
  },

  markRead: (id) => {
    const data = structuredClone(get().data)
    const n = data.notifications.find((x) => x.id === id)
    if (n) n.read = true
    set({ data })
  },

  markAllRead: () => {
    const data = structuredClone(get().data)
    data.notifications.forEach((n) => (n.read = true))
    set({ data })
  },

  replyInquiry: (inquiryId, text) => {
    if (!text.trim()) return { ok: false, error: 'Write a reply first.' }
    const data = structuredClone(get().data)
    const q = data.inquiries.find((x) => x.id === inquiryId)
    if (!q) return { ok: false, error: 'Inquiry not found.' }
    q.messages.push({ from: 'staff', at: demoNowStamp('admin'), text: text.trim(), simulated: true })
    q.status = 'Staff replied'
    set({ data })
    return { ok: true }
  },

  replyReview: (reviewId, text) => {
    if (!text.trim()) return { ok: false, error: 'Write a reply first.' }
    if (text.trim().length > 500) return { ok: false, error: 'Keep the reply under 500 characters.' }
    const data = structuredClone(get().data)
    const r = data.reviews.find((x) => x.id === reviewId)
    if (!r) return { ok: false, error: 'Review not found.' }
    r.staffReply = { text: text.trim(), at: demoNowStamp('admin') }
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
    const at = demoNowStamp('admin')
    r.status = 'Under review'
    r.events.push({ at, status: 'Under review', note: 'Staff started reviewing the request.' })
    activity(data, at, { category: 'Requests', title: 'Request under review', body: `${r.id} (${customerName(data, r.customerId)}).`, link: `/admin/requests?id=${r.id}` })
    set({ data })
    return { ok: true }
  },

  /** Sends the prepared proposal (custom trip) or the estimate as the quote (rental). */
  sendProposal: (kind, id) => {
    const data = structuredClone(get().data)
    const r = findRequest(data, kind, id)
    if (!r || r.status !== 'Under review') return { ok: false, error: 'Move the request to review first.' }
    const at = demoNowStamp('admin')
    const validUntil = addDays(at.slice(0, 10), PROPOSAL_VALID_DAYS)
    if (kind === 'custom') {
      const c = r as CustomRequest
      const dest = requestDestination(data, c)
      c.proposal = { ...(c.draftProposal ?? draftCustomProposal(c, dest, at)), sentAt: at, validUntil }
      c.draftProposal = undefined
    } else {
      const v = r as RentalRequest
      v.quote = { ...v.estimate, note: 'Confirmed as estimated.', sentAt: at, validUntil }
    }
    const total = kind === 'custom' ? (r as CustomRequest).proposal!.total : (r as RentalRequest).quote!.total
    r.status = 'Proposal ready'
    r.events.push({ at, status: 'Proposal ready', note: `${kind === 'custom' ? 'Proposal' : 'Quote'} sent: ${peso(total)}.` })
    activity(data, at, { category: 'Requests', title: kind === 'custom' ? 'Proposal sent' : 'Quote sent', body: `${r.id} (${customerName(data, r.customerId)}) · ${peso(total)}.`, link: `/admin/requests?id=${r.id}` })
    set({ data })
    return { ok: true }
  },

  closeRequest: (kind, id, reason) => {
    if (!reason.trim()) return { ok: false, error: 'Enter a reason for closing the request.' }
    const data = structuredClone(get().data)
    const r = findRequest(data, kind, id)
    if (!r || !canTransition(r.status, 'Closed')) return { ok: false, error: 'This request can no longer be closed.' }
    const at = demoNowStamp('admin')
    r.status = 'Closed'
    r.events.push({ at, status: 'Closed', note: reason.trim() })
    activity(data, at, { category: 'Requests', title: 'Request closed', body: `${r.id} (${customerName(data, r.customerId)}): ${reason.trim()}`, link: `/admin/requests?id=${r.id}` })
    set({ data })
    return { ok: true }
  },

  reset: () => set(initial()),
}))
