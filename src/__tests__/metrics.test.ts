import { beforeEach, describe, expect, it } from 'vitest'
import { bookingReport, bookingsPerWeek, dashboard, performanceReport, PERIODS, revenueReport, statusCounts } from '../domain/metrics'
import { assignableTargets, departureAvailability, driverConflict, vehicleConflict } from '../domain/rules'
import { resetDemoClock } from '../lib/demoClock'
import { adminSeed, customerSeed } from '../seed/derive'
import { useAdmin } from '../state/adminStore'
import { DEMO_CUSTOMER, useCustomer } from '../state/customerStore'
import { resetAll } from '../state/demo'

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
    expect([perf.filled, perf.capacity]).toEqual([29, 108])
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

describe('demo scripts', () => {
  beforeEach(() => {
    resetAll()
    resetDemoClock()
  })

  it('customer walkthrough C3–C9 recreates BK-2026-0148 and PAY-2026-0192', () => {
    const c = useCustomer.getState()
    expect(c.login(DEMO_CUSTOMER.email, 'wrong').ok).toBe(false)
    expect(c.login(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password).ok).toBe(true)
    const b = useCustomer.getState().createBooking({ serviceId: 'SVC-BAG', departureId: 'DEP-BAG-1017', pax: 2, contactName: 'Maria Santos', contactMobile: '0900 555 0101' })
    if (!b.ok) throw new Error(b.error)
    expect(b.value).toMatchObject({ id: 'BK-2026-0148', total: 4998, status: 'Pending', createdAt: '2026-10-08T09:31:00+08:00' })
    const p = useCustomer.getState().submitPayment({ bookingId: b.value.id, method: 'GCash', type: 'Down payment', reference: '1009 8822 5531', proof: 'sample' })
    if (!p.ok) throw new Error(p.error)
    expect(p.value).toMatchObject({ id: 'PAY-2026-0192', amount: 2499, status: 'Submitted', submittedAt: '2026-10-08T09:32:00+08:00' })
    const seeded = adminSeed()
    const { origin: _o1, ...live } = b.value
    const { origin: _o2, scenario: _s, ...pre } = seeded.bookings.find((x) => x.id === 'BK-2026-0148')!
    expect({ ...live, notes: undefined }).toEqual({ ...pre, notes: undefined })
    const dep = useCustomer.getState().data.departures.find((x) => x.id === 'DEP-BAG-1017')!
    expect(departureAvailability(dep, useCustomer.getState().data.bookings).left).toBe(6)
    // The admin demo never receives the customer's data.
    expect(useAdmin.getState().data.bookings.find((x) => x.id === 'BK-2026-0148')?.origin).toBe('seed')
  })

  it('admin walkthrough A6–A11 moves the figures as scripted', () => {
    const a = useAdmin.getState()
    expect(a.confirmBooking('BK-2026-0148').ok).toBe(false)
    expect(a.verifyPayment('PAY-2026-0192').ok).toBe(true)
    expect(useAdmin.getState().confirmBooking('BK-2026-0148').ok).toBe(true)
    expect(useAdmin.getState().assign({ kind: 'booking', id: 'BK-2026-0130' }, 'VAN-01', 'DRV-03')).toMatchObject({ ok: false })
    expect(useAdmin.getState().assign({ kind: 'booking', id: 'BK-2026-0130' }, 'VAN-04', 'DRV-03').ok).toBe(true)
    const d = useAdmin.getState().data
    const k = dashboard(d)
    expect(k.collections).toBe(27591)
    expect(k.outstanding).toBe(29195)
    expect(k.toVerify).toBe(0)
    expect(k.needsAssignment).toBe(1)
    expect(statusCounts(d)).toMatchObject({ Pending: 1, Confirmed: 10 })
    const perf = performanceReport(d, OCT)
    expect(perf.filled).toBe(31)
    const bag17 = perf.rows.find((r) => r.departure.id === 'DEP-BAG-1017')!
    expect([bag17.filled, bag17.capacity]).toEqual([6, 12])
  })

  it('admin lockout after five wrong passwords', () => {
    for (let i = 0; i < 4; i++) expect(useAdmin.getState().login('admin@tamsap.example.com', 'nope').ok).toBe(false)
    const r = useAdmin.getState().login('admin@tamsap.example.com', 'nope')
    expect(r).toMatchObject({ ok: false, error: expect.stringContaining('locked') })
    expect(useAdmin.getState().login('admin@tamsap.example.com', 'Admin2026!').ok).toBe(false)
  })
})
