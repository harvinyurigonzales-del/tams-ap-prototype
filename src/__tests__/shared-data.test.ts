import { describe, expect, it } from 'vitest'
import { amountPaid, departureAvailability, downPayment, seatUse } from '../domain/rules'
import { overlaps } from '../lib/demoClock'
import { MARIA_ID, sharedSeed } from '../seed/derive'

const { data: d, maintenance } = sharedSeed()

describe('shared sample data', () => {
  it('starts Maria with her profile and nothing else', () => {
    expect(d.customers.find((c) => c.id === MARIA_ID)?.name).toBe('Maria Santos')
    expect(d.bookings.filter((b) => b.customerId === MARIA_ID)).toHaveLength(0)
    expect([...d.customRequests, ...d.rentalRequests].filter((r) => r.customerId === MARIA_ID)).toHaveLength(0)
    expect(d.reviews.filter((r) => r.customerId === MARIA_ID)).toHaveLength(0)
    expect(d.inquiries.filter((q) => q.customerId === MARIA_ID)).toHaveLength(0)
    expect(d.notifications.filter((n) => n.customerId === MARIA_ID || n.about === MARIA_ID || /Maria/.test(n.body))).toHaveLength(0)
    expect(d.saved[MARIA_ID]).toBeUndefined()
    expect(d.preferences[MARIA_ID]).toBeUndefined()
    const bookingIds = new Set(d.bookings.map((b) => b.id))
    expect(d.payments.every((p) => bookingIds.has(p.bookingId))).toBe(true)
  })

  it('has the expanded fleet, customers and bookings', () => {
    expect(d.drivers).toHaveLength(12)
    expect(d.vehicles).toHaveLength(15)
    // 9 original customers besides Maria and Paolo, plus 30 generated ones.
    expect(d.customers.filter((c) => c.id !== MARIA_ID && c.id !== 'CUS-0011').length).toBeGreaterThanOrEqual(39)
    expect(d.bookings.length).toBeGreaterThanOrEqual(60)
    expect(new Set(d.bookings.map((b) => b.id)).size).toBe(d.bookings.length)
    expect(new Set(d.payments.map((p) => p.id)).size).toBe(d.payments.length)
    expect(new Set(d.notifications.map((n) => n.id)).size).toBe(d.notifications.length)
    expect(maintenance.length).toBeGreaterThan(4)
  })

  it('never puts more people on a departure than it has seats', () => {
    for (const dep of d.departures) {
      const use = seatUse(dep.id, d.bookings)
      expect(use.held + use.completed, dep.id).toBeLessThanOrEqual(dep.capacity)
      expect(departureAvailability(dep, d.bookings).left).toBeGreaterThanOrEqual(0)
    }
  })

  it('keeps payments consistent with each booking', () => {
    for (const b of d.bookings) {
      const paid = amountPaid(b.id, d.payments)
      expect(paid, b.id).toBeLessThanOrEqual(b.total)
      if (b.status === 'Completed') expect(paid, b.id).toBe(b.total)
      if (b.status === 'Confirmed') expect(paid, b.id).toBeGreaterThanOrEqual(downPayment(b.total))
      if (b.status === 'Pending') expect(paid, b.id).toBeLessThan(downPayment(b.total) + 1)
    }
    const customers = new Set(d.customers.map((c) => c.id))
    expect(d.bookings.every((b) => customers.has(b.customerId))).toBe(true)
    expect([...d.customRequests, ...d.rentalRequests].every((r) => customers.has(r.customerId))).toBe(true)
  })

  it('never double-books a van or a driver and respects van seats', () => {
    for (const [i, a] of d.assignments.entries()) {
      const v = d.vehicles.find((x) => x.id === a.vehicleId)!
      const pax = a.target.kind === 'departure' ? (() => { const u = seatUse(a.target.id, d.bookings); return u.held + u.completed })() : d.bookings.find((b) => b.id === a.target.id)!.pax
      expect(v.seats, a.id).toBeGreaterThanOrEqual(pax)
      for (const b of d.assignments.slice(i + 1)) {
        if (!overlaps(a.from, a.to, b.from, b.to)) continue
        expect(a.vehicleId === b.vehicleId, `${a.id}/${b.id} van`).toBe(false)
        expect(a.driverId === b.driverId, `${a.id}/${b.id} driver`).toBe(false)
      }
    }
  })
})
