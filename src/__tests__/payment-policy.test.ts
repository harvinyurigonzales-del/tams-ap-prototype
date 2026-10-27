import { beforeEach, describe, expect, it } from 'vitest'
import { deadlinesOf, deadlinesPending, MISSED_REASON, paymentState, runDeadlines, selfCancelOpen } from '../domain/paymentPolicy'
import { departureAvailability, payableOptions } from '../domain/rules'
import { addDays, addHours, DEMO_TODAY } from '../lib/demoClock'
import { DEMO_ADMIN, DEMO_STAFF, useAdmin } from '../state/adminStore'
import { DEMO_CUSTOMER, useCustomer } from '../state/customerStore'
import { resetAll } from '../state/demo'
import { startSync } from '../state/sync'
import { advanceTimeline, restoreTimeline, samplePayment } from '../state/timeline'

startSync()

const admin = () => useAdmin.getState()
const customer = () => useCustomer.getState()
const booking = (id: string) => admin().data.bookings.find((b) => b.id === id)!

/** Maria books two seats on an open departure about two weeks away. */
function book(minDays = 10, maxDays = 30) {
  const d = admin().data
  const dep = d.departures
    .filter((x) => x.startDate >= addDays(DEMO_TODAY, minDays) && x.startDate <= addDays(DEMO_TODAY, maxDays) && departureAvailability(x, d.bookings).left >= 2)
    .find((x) => d.services.find((s) => s.id === x.serviceId)?.status === 'Active')!
  const r = customer().createBooking({ serviceId: dep.serviceId, departureId: dep.id, pax: 2, contactName: 'Maria Santos', contactMobile: '09175550123' })
  if (!r.ok) throw new Error(r.error)
  return r.value.id
}

beforeEach(() => {
  resetAll()
  customer().login(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password)
  admin().login(DEMO_ADMIN.email, DEMO_ADMIN.password)
})

describe('payment deadline policy', () => {
  it('counts exact hours back from the pickup time, in Manila time', () => {
    const id = book()
    const b = booking(id)
    const dl = deadlinesOf(admin().data, b)
    expect(dl.departAt).toBe(`${b.startDate}T${b.agreed!.pickupTime}:00+08:00`)
    expect(dl.dueAt).toBe(addHours(dl.departAt, -72))
    expect(dl.reminderAt).toBe(addHours(dl.departAt, -96))
    expect(dl.cutoffAt).toBe(addHours(dl.departAt, -48))
    const d = admin().data
    expect(paymentState(d, b, addHours(dl.reminderAt, -1 / 60)).stage).toBe('upcoming')
    expect(paymentState(d, b, dl.reminderAt).stage).toBe('reminder')
    expect(paymentState(d, b, dl.dueAt).stage).toBe('due')
    expect(paymentState(d, b, addHours(dl.dueAt, 1 / 60)).stage).toBe('overdue')
    expect(paymentState(d, b, addHours(dl.cutoffAt, -1 / 60)).stage).toBe('overdue')
    expect(paymentState(d, b, dl.cutoffAt).stage).toBe('cancel')
  })

  it('closes self-service cancellation at exactly 72 hours before departure', () => {
    const id = book()
    const b = booking(id)
    const dl = deadlinesOf(admin().data, b)
    expect(selfCancelOpen(admin().data, b, addHours(dl.dueAt, -1 / 60))).toBe(true)
    expect(selfCancelOpen(admin().data, b, dl.dueAt)).toBe(false)
    advanceTimeline(id, 'deadline')
    expect(customer().requestCancellation(id).ok).toBe(false)
    // Staff can still cancel exceptional cases.
    expect(admin().cancelBooking(id, 'Family emergency').ok).toBe(true)
  })

  it('no payment: reminder, due, overdue, then cancellation with seats released and no refund', () => {
    const id = book()
    const dep = booking(id).departureId!
    const held = () => departureAvailability(admin().data.departures.find((x) => x.id === dep)!, admin().data.bookings).held
    const before = held()
    advanceTimeline(id, 'reminder')
    advanceTimeline(id, 'deadline')
    const titles = () => admin().data.notifications.filter((n) => n.ref === id).map((n) => n.title)
    expect(titles()).toEqual(expect.arrayContaining(['Balance due in 24 hours', 'Payment due now']))
    advanceTimeline(id, 'past-grace')
    const b = booking(id)
    expect(b.status).toBe('Cancelled')
    expect(b.cancelReason).toBe(MISSED_REASON)
    expect(b.cancelledBy).toBe('system')
    expect(held()).toBe(before - 2)
    expect(admin().data.refunds.some((r) => r.bookingId === id)).toBe(false)
    expect(titles().filter((t) => t.startsWith('Auto-cancelled') || t.startsWith('Booking cancelled'))).toHaveLength(2)
    // Running the rules again, or advancing again, changes nothing.
    const snapshot = JSON.stringify(admin().data)
    advanceTimeline(id, 'past-grace')
    expect(runDeadlines(structuredClone(admin().data))).toBe(false)
    expect(deadlinesPending(admin().data)).toBe(false)
    expect(admin().data.notifications.length).toBe(JSON.parse(snapshot).notifications.length)
  })

  it('partial payment: cancellation opens a refund review for the verified amount, with no deductions', () => {
    const id = book()
    expect(samplePayment(id, 'down').ok).toBe(true)
    const paid = admin().data.payments.filter((p) => p.bookingId === id && p.status === 'Verified').reduce((n, p) => n + p.amount, 0)
    advanceTimeline(id, 'past-grace')
    expect(booking(id).status).toBe('Cancelled')
    const r = admin().data.refunds.find((x) => x.bookingId === id)!
    expect(r).toMatchObject({ paid, proposed: paid, deductions: [], status: 'Pending review', cancelledBy: 'system' })
    // Payment history stays.
    expect(admin().data.payments.filter((p) => p.bookingId === id).length).toBe(1)
    advanceTimeline(id, 'past-grace')
    expect(admin().data.refunds.filter((x) => x.bookingId === id)).toHaveLength(1)
  })

  it('full payment protects the booking', () => {
    const id = book()
    samplePayment(id, 'full')
    advanceTimeline(id, 'past-grace')
    expect(booking(id).status).toBe('Confirmed')
    expect(paymentState(admin().data, booking(id)).stage).toBe('paid')
  })

  it('a timely payment awaiting verification pauses cancellation; a later rejection needs a staff decision', () => {
    const id = book()
    samplePayment(id, 'down')
    advanceTimeline(id, 'deadline')
    samplePayment(id, 'pending')
    advanceTimeline(id, 'past-grace')
    expect(booking(id).status).toBe('Confirmed')
    expect(paymentState(admin().data, booking(id)).stage).toBe('verifying')
    const pending = admin().data.payments.find((p) => p.bookingId === id && p.status === 'Submitted')!
    expect(admin().rejectPayment(pending.id, 'Receipt is unreadable').ok).toBe(true)
    // Rejected after the deadline: not cancelled for staff processing time.
    runDeadlines(admin().data)
    expect(booking(id).status).toBe('Confirmed')
    expect(paymentState(admin().data, booking(id)).stage).toBe('needs-resolution')
    expect(admin().setRevisedCutoff(id, 12, 'Send a clearer receipt.').ok).toBe(true)
    expect(paymentState(admin().data, booking(id)).stage).toBe('overdue')
    advanceTimeline(id, 'past-grace')
    expect(booking(id).status).toBe('Cancelled')
  })

  it('an incomplete submission does not count as a timely payment', () => {
    const id = book()
    advanceTimeline(id, 'deadline')
    const d = structuredClone(admin().data)
    d.payments.push({ id: 'PAY-X', bookingId: id, amount: 100, method: 'GCash', type: 'Balance', status: 'Submitted', reference: '', submittedAt: d.previews[0].at, proof: 'none', origin: 'local' })
    useAdmin.setState({ data: d })
    advanceTimeline(id, 'past-grace')
    expect(booking(id).status).toBe('Cancelled')
  })

  it('restore puts the booking back without touching other records', () => {
    const id = book()
    const other = book(10, 60)
    const otherBefore = JSON.stringify(booking(other))
    const notesBefore = admin().data.notifications.filter((n) => n.ref === id).length
    samplePayment(id, 'down')
    advanceTimeline(id, 'past-grace')
    expect(booking(id).status).toBe('Cancelled')
    expect(restoreTimeline(id).ok).toBe(true)
    expect(booking(id).status).toBe('Pending')
    expect(admin().data.payments.some((p) => p.bookingId === id)).toBe(false)
    expect(admin().data.refunds.some((r) => r.bookingId === id)).toBe(false)
    expect(admin().data.notifications.filter((n) => n.ref === id).length).toBe(notesBefore)
    expect(admin().data.previews).toHaveLength(0)
    expect(JSON.stringify(booking(other))).toBe(otherBefore)
    // The rest of the app is still on the real clock.
    expect(paymentState(admin().data, booking(id)).stage).toBe('upcoming')
  })

  it('a booking made inside the 72-hour window is paid in full', () => {
    const d = admin().data
    const dep = d.departures.find((x) => departureAvailability(x, d.bookings).state === 'open' && x.startDate === addDays(DEMO_TODAY, 3))
    if (!dep) return
    const r = customer().createBooking({ serviceId: dep.serviceId, departureId: dep.id, pax: 1, contactName: 'Maria Santos', contactMobile: '09175550123' })
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const b = booking(r.value.id)
    if (!deadlinesOf(admin().data, b).late) return
    expect(payableOptions(b, admin().data.payments).map((o) => o.type)).toEqual(['Full'])
  })
})

describe('refund review', () => {
  it('staff record, admin decide, and money is only "processed" when recorded', () => {
    const id = book()
    samplePayment(id, 'down')
    expect(admin().cancelBooking(id, 'Typhoon signal, trip called off').ok).toBe(true)
    const r = () => admin().data.refunds.find((x) => x.bookingId === id)!
    expect(r().cancelledBy).toBe('staff')
    expect(admin().recordRefund(r().id, { method: 'GCash', reference: 'GC-12345', date: DEMO_TODAY }).ok).toBe(false)
    admin().logout()
    admin().login(DEMO_STAFF.email, DEMO_STAFF.password)
    expect(admin().decideRefund(r().id, true, r().paid, 'ok').ok).toBe(false)
    admin().logout()
    admin().login(DEMO_ADMIN.email, DEMO_ADMIN.password)
    expect(admin().decideRefund(r().id, true, r().paid + 1, 'too much').ok).toBe(false)
    expect(admin().decideRefund(r().id, true, r().paid, 'Operator cancellation, full refund.').ok).toBe(true)
    expect(r().status).toBe('Approved')
    expect(booking(id).status).toBe('Cancelled')
    admin().logout()
    admin().login(DEMO_STAFF.email, DEMO_STAFF.password)
    expect(admin().recordRefund(r().id, { method: 'GCash', reference: 'GC-12345', date: DEMO_TODAY }).ok).toBe(true)
    expect(r().status).toBe('Processed')
    expect(r().processed).toMatchObject({ method: 'GCash', reference: 'GC-12345', by: 'Liza Manalo (Staff)' })
  })
})
