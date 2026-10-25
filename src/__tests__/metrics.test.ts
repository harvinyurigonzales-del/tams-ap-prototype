import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { bookingReport, bookingsPerWeek, dashboard, performanceReport, PERIODS, revenueReport, statusCounts } from '../domain/metrics'
import { assignableTargets, departureAvailability, driverConflict, vehicleConflict } from '../domain/rules'
import { resetDemoClock } from '../lib/demoClock'
import { adminFixture as adminSeed, customerFixture as customerSeed } from './fixtures'
import { DEMO_STAFF, staffNotifications, useAdmin } from '../state/adminStore'
import { DEMO_CUSTOMER, useCustomer } from '../state/customerStore'
import { resetAll, resetMaria } from '../state/demo'
import { reviewEligibility, ratingFor } from '../domain/reviews'
import { MARIA_ID } from '../seed/derive'
import { startSync } from '../state/sync'

const [OCT, SEP] = PERIODS

describe('seeded figures (spec section 9)', () => {
  const d = adminSeed()

  it('dashboard KPIs', () => {
    const k = dashboard(d)
    expect(k.collections).toBe(25092)
    expect(k.outstanding).toBe(31694)
    expect(k.toVerify).toBe(1)
    expect(k.toVerifyAmount).toBe(2499)
    expect(k.needsAssignment).toBe(2)
  })

  it('status counts and weekly bookings', () => {
    expect(statusCounts(d)).toEqual({ Pending: 2, Confirmed: 9, Completed: 2, Cancelled: 1 })
    expect(bookingsPerWeek(d).map((w) => w.count)).toEqual([1, 0, 2, 4, 3, 4])
  })

  it('reports', () => {
    expect(bookingReport(d, OCT).value).toBe(106073)
    expect(revenueReport(d, SEP).collections).toBe(54483)
    const methods = Object.fromEntries(revenueReport(d, { from: '2026-01-01', to: '2026-12-31', label: '' }).byMethod.map((m) => [m.method, m.amount]))
    expect(methods).toEqual({ GCash: 38388, 'Bank transfer': 30391, Maya: 10796 })
    const perf = performanceReport(d, OCT)
    // 27 October departures of 12 seats each, including the added joiner tours.
    expect([perf.filled, perf.capacity]).toEqual([29, 324])
  })

  it('customer copy starts without Maria’s scenario booking', () => {
    const c = customerSeed()
    expect(c.bookings.find((b) => b.id === 'BK-2026-0148')).toBeUndefined()
    const dep = c.departures.find((x) => x.id === 'DEP-BAG-1017')!
    expect(departureAvailability(dep, c.bookings).left).toBe(8)
    expect(departureAvailability(c.departures.find((x) => x.id === 'DEP-BAG-1010')!, c.bookings).state).toBe('full')
    expect(departureAvailability(c.departures.find((x) => x.id === 'DEP-BAT-1009')!, c.bookings).state).toBe('closed')
  })

  it('conflict reasons for the Baler rental (A9)', () => {
    const t = assignableTargets(d).find((x) => x.id === 'BK-2026-0130')!
    const v = (id: string) => vehicleConflict(d, d.vehicles.find((x) => x.id === id)!, t)
    const dr = (id: string) => driverConflict(d, d.drivers.find((x) => x.id === id)!, t)
    expect(v('VAN-01')).toBe('Assigned to DEP-BAG-1017 · Oct 17–18')
    expect(v('VAN-06')).toBe('Unavailable until Oct 20')
    expect(v('VAN-04')).toBeNull()
    expect(dr('DRV-01')).toBe('Assigned to DEP-BAG-1017 · Oct 17–18')
    expect(dr('DRV-05')).toBe('On leave Oct 16–18')
    expect(dr('DRV-03')).toBeNull()
  })
})

describe('shared journey: Maria books, staff complete the trip, Maria rates it', () => {
  beforeAll(() => startSync())
  beforeEach(() => {
    resetAll()
    resetDemoClock()
  })

  const signInMaria = () => expect(useCustomer.getState().login(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password).ok).toBe(true)

  it('starts Maria with no trips, requests, reviews or notifications', () => {
    signInMaria()
    const d = useCustomer.getState().data
    expect(d.bookings.filter((b) => b.customerId === MARIA_ID)).toEqual([])
    expect(d.notifications.filter((n) => n.customerId === MARIA_ID)).toEqual([])
    expect(reviewEligibility(d, MARIA_ID)).toMatchObject({ ok: false })
  })

  it('a customer booking reaches staff, and staff updates reach the customer', () => {
    signInMaria()
    const b = useCustomer.getState().createBooking({ serviceId: 'SVC-BAG', departureId: 'DEP-BAG-1017', pax: 2, contactName: 'Maria Santos', contactMobile: '0900 555 0101' })
    if (!b.ok) throw new Error(b.error)
    expect(b.value).toMatchObject({ total: 4998, status: 'Pending', customerId: MARIA_ID })
    // The staff portal holds the same record, and staff are told about it.
    expect(useAdmin.getState().data.bookings.find((x) => x.id === b.value.id)?.status).toBe('Pending')
    expect(staffNotifications(useAdmin.getState().data).some((n) => n.about === MARIA_ID)).toBe(true)

    const p = useCustomer.getState().submitPayment({ bookingId: b.value.id, method: 'GCash', type: 'Full', reference: '1009 8822 5531', proof: 'sample' })
    if (!p.ok) throw new Error(p.error)
    expect(useAdmin.getState().data.payments.find((x) => x.id === p.value.id)?.status).toBe('Submitted')

    expect(useAdmin.getState().verifyPayment(p.value.id).ok).toBe(true)
    const mine = () => useCustomer.getState().data.notifications.filter((n) => n.customerId === MARIA_ID)
    expect(mine().some((n) => /verified/i.test(n.title) && !n.read)).toBe(true)
    if (useAdmin.getState().data.bookings.find((x) => x.id === b.value.id)!.status === 'Pending') expect(useAdmin.getState().confirmBooking(b.value.id).ok).toBe(true)
    expect(useCustomer.getState().data.bookings.find((x) => x.id === b.value.id)?.status).toBe('Confirmed')

    // Not reviewable until staff mark it completed.
    expect(reviewEligibility(useCustomer.getState().data, MARIA_ID)).toMatchObject({ ok: false })
    expect(useAdmin.getState().completeBooking(b.value.id).ok).toBe(true)
    const done = mine().find((n) => n.title === 'Trip completed')!
    expect(done.link).toBe(`/app/reviews?trip=${b.value.id}`)
    const elig = reviewEligibility(useCustomer.getState().data, MARIA_ID)
    expect(elig.ok && elig.trips.map((x) => x.id)).toEqual([b.value.id])

    // A star rating alone is a complete review, and it counts once.
    const before = ratingFor(useCustomer.getState().data, 'SVC-BAG').count
    expect(useCustomer.getState().submitReview({ bookingId: b.value.id, rating: 4 }).ok).toBe(true)
    expect(useCustomer.getState().submitReview({ bookingId: b.value.id, rating: 5 }).ok).toBe(false)
    expect(ratingFor(useAdmin.getState().data, 'SVC-BAG').count).toBe(before + 1)
    expect(reviewEligibility(useCustomer.getState().data, MARIA_ID)).toEqual({ ok: false, reason: 'all-reviewed' })

    // Signing out and in as staff and back keeps every record.
    useCustomer.getState().logout()
    expect(useAdmin.getState().login(DEMO_STAFF.email, DEMO_STAFF.password).ok).toBe(true)
    useAdmin.getState().logout()
    signInMaria()
    expect(useCustomer.getState().data.bookings.find((x) => x.id === b.value.id)?.status).toBe('Completed')
  })

  it('resetting Maria clears only her records', () => {
    signInMaria()
    const b = useCustomer.getState().createBooking({ serviceId: 'SVC-BAG', departureId: 'DEP-BAG-1017', pax: 2, contactName: 'Maria Santos', contactMobile: '0900 555 0101' })
    if (!b.ok) throw new Error(b.error)
    const others = useAdmin.getState().data.bookings.filter((x) => x.customerId !== MARIA_ID)
    resetMaria()
    const d = useAdmin.getState().data
    expect(d.bookings.filter((x) => x.customerId === MARIA_ID)).toEqual([])
    expect(d.bookings.filter((x) => x.customerId !== MARIA_ID)).toEqual(others)
    expect(useCustomer.getState().data).toBe(d)
  })

  it('admin lockout after five wrong passwords', () => {
    for (let i = 0; i < 4; i++) expect(useAdmin.getState().login('admin@tamsap.example.com', 'nope').ok).toBe(false)
    const r = useAdmin.getState().login('admin@tamsap.example.com', 'nope')
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('locked') })
    expect(useAdmin.getState().login('admin@tamsap.example.com', 'Admin2026!').ok).toBe(false)
  })
})
