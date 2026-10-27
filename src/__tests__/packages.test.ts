import { beforeEach, describe, expect, it } from 'vitest'
import { isOffered, packageStatus } from '../domain/packages'
import { catalogTours } from '../domain/recommend'
import { addDays, DEMO_TODAY } from '../lib/demoClock'
import { DEMO_ADMIN, DEMO_STAFF, packageError, useAdmin, type PackageInput } from '../state/adminStore'
import { resetAll } from '../state/demo'

const admin = () => useAdmin.getState()
const svc = (id: string) => admin().data.services.find((s) => s.id === id)!

const base: PackageInput = {
  name: 'Bulacan Heritage Day', destinationId: 'DST-INTRAMUROS', duration: '1 day', days: 1, price: 1899, pickup: 'Malolos, Bulacan', pickupTime: '06:00',
  summary: 'Churches, museums and kakanin around Malolos.', itinerary: ['Barasoain Church', 'Lunch'], inclusions: ['Round-trip van'], exclusions: [],
  departures: [{ startDate: addDays(DEMO_TODAY, 20), capacity: 12 }],
}

beforeEach(() => {
  resetAll()
  admin().login(DEMO_ADMIN.email, DEMO_ADMIN.password)
})

describe('package management', () => {
  it('adds a package as a draft that customers cannot see, then publishes it', () => {
    const r = admin().savePackage(null, base)
    expect(r.ok).toBe(true)
    const id = (r as { id: string }).id
    expect(packageStatus(svc(id))).toBe('Draft')
    expect(catalogTours(admin().data).some((s) => s.id === id)).toBe(false)
    expect(admin().data.departures.filter((d) => d.serviceId === id)).toHaveLength(1)
    expect(admin().setPackageStatus(id, 'Active').ok).toBe(true)
    expect(isOffered(svc(id))).toBe(true)
    const log = admin().data.activity.filter((a) => a.recordId === id).map((a) => a.action)
    expect(log).toEqual(['Activated', 'Created'])
    expect(admin().data.activity[0].actor).toBe('Admin (Admin)')
  })

  it('validates required fields, price, capacity and dates', () => {
    expect(packageError({ ...base, name: '' })).toMatch(/name/)
    expect(packageError({ ...base, price: 100 })).toMatch(/at least/)
    expect(packageError({ ...base, price: 1999.5 })).toMatch(/whole pesos/)
    expect(packageError({ ...base, capacity: 0 })).toMatch(/Capacity/)
    expect(packageError({ ...base, departures: [{ startDate: DEMO_TODAY, capacity: 12 }] }, admin().data)).toMatch(/after today/)
    expect(packageError({ ...base, departures: [{ startDate: addDays(DEMO_TODAY, 9), capacity: 12 }, { startDate: addDays(DEMO_TODAY, 9), capacity: 10 }] }, admin().data)).toMatch(/already a departure/)
    expect(packageError({ ...base, departures: [{ startDate: addDays(DEMO_TODAY, 9), capacity: 99 }] }, admin().data)).toMatch(/capacity/)
    expect(packageError({ ...base, name: 'Baguio Weekend Escape' }, admin().data)).toMatch(/already has this name/)
  })

  it('records before and after values when a package is edited', () => {
    const s = svc('SVC-TAG')
    expect(admin().savePackage(s.id, { ...s, price: s.price + 100 }).ok).toBe(true)
    const e = admin().data.activity[0]
    expect(e.action).toBe('Edited')
    expect(e.changes).toEqual([{ field: 'Price', from: `₱${s.price.toLocaleString('en-PH')}`, to: `₱${(s.price + 100).toLocaleString('en-PH')}` }])
  })

  it('keeps booked departures fixed and their seats protected', () => {
    const booked = admin().data.departures.find((d) => d.serviceId === 'SVC-BAG' && d.startDate > DEMO_TODAY && admin().data.bookings.some((b) => b.departureId === d.id && b.status !== 'Cancelled'))!
    const s = svc('SVC-BAG')
    const others = admin().data.departures.filter((d) => d.serviceId === s.id && d.id !== booked.id).map((d) => ({ id: d.id, startDate: d.startDate, capacity: d.capacity }))
    const moved = admin().savePackage(s.id, { ...s, departures: [...others, { id: booked.id, startDate: addDays(booked.startDate, 7), capacity: booked.capacity }] })
    expect(moved.ok).toBe(false)
    const removed = admin().savePackage(s.id, { ...s, departures: others })
    expect(removed.ok).toBe(false)
    const shrunk = admin().savePackage(s.id, { ...s, departures: [...others, { id: booked.id, startDate: booked.startDate, capacity: 0 }] })
    expect(shrunk.ok).toBe(false)
  })

  it('duplicates content only, as a draft that needs its dates reviewed', () => {
    const before = { bookings: admin().data.bookings.length, reviews: admin().data.reviews.length, payments: admin().data.payments.length, assignments: admin().data.assignments.length }
    const r = admin().duplicatePackage('SVC-BAG')
    expect(r.ok).toBe(true)
    const id = (r as { id: string }).id
    const copy = svc(id)
    expect(id).not.toBe('SVC-BAG')
    expect(packageStatus(copy)).toBe('Draft')
    expect(copy.itinerary).toEqual(svc('SVC-BAG').itinerary)
    expect(admin().data.departures.filter((d) => d.serviceId === id).every((d) => !d.promo)).toBe(true)
    expect({ bookings: admin().data.bookings.length, reviews: admin().data.reviews.length, payments: admin().data.payments.length, assignments: admin().data.assignments.length }).toEqual(before)
    expect(admin().data.bookings.some((b) => b.serviceId === id)).toBe(false)
    expect(admin().setPackageStatus(id, 'Active')).toEqual({ ok: false, error: 'Review the departure dates of this copy before activating it.' })
    expect(admin().savePackage(id, { ...copy, name: 'Paskong Baguio Plus', price: 3099, datesReviewed: true }).ok).toBe(true)
    expect(admin().setPackageStatus(id, 'Active').ok).toBe(true)
    expect(admin().data.activity.some((a) => a.recordId === id && a.action === 'Duplicated')).toBe(true)
  })

  it('deletes only packages nothing depends on, and archives the rest', () => {
    expect(admin().deletePackage('SVC-BAG').ok).toBe(false)
    expect(admin().setPackageStatus('SVC-BAG', 'Archived').ok).toBe(true)
    expect(admin().data.bookings.filter((b) => b.serviceId === 'SVC-BAG').length).toBeGreaterThan(0)
    const id = (admin().savePackage(null, base) as { id: string }).id
    expect(admin().deletePackage(id).ok).toBe(true)
    expect(admin().data.services.some((s) => s.id === id)).toBe(false)
    expect(admin().data.departures.some((d) => d.serviceId === id)).toBe(false)
  })

  it('ships active seasonal examples, and a draft one that needs its dates checked', () => {
    const seasonal = admin().data.services.filter((s) => s.season)
    expect(seasonal.map((s) => s.name)).toEqual(expect.arrayContaining(['Paskong Baguio Getaway', 'New Year, New Views', 'Zambales Summer Escape', 'Holy Week Family Getaway', 'La Union Long Weekend Escape']))
    expect(seasonal.filter(isOffered).length).toBeGreaterThanOrEqual(4)
    expect(packageStatus(svc('SVC-XTAL'))).toBe('Draft')
    for (const s of seasonal) {
      const deps = admin().data.departures.filter((d) => d.serviceId === s.id)
      expect(deps.length).toBeGreaterThan(0)
      expect(deps.every((d) => d.startDate > DEMO_TODAY)).toBe(true)
    }
    expect(admin().setPackageStatus('SVC-XZAM', 'Inactive').ok).toBe(true)
    expect(catalogTours(admin().data).some((s) => s.id === 'SVC-XZAM')).toBe(false)
  })

  it('stays admin-only', () => {
    admin().logout()
    admin().login(DEMO_STAFF.email, DEMO_STAFF.password)
    expect(admin().savePackage(null, base).ok).toBe(false)
    expect(admin().duplicatePackage('SVC-BAG').ok).toBe(false)
    expect(admin().setPackageStatus('SVC-BAG', 'Inactive').ok).toBe(false)
  })
})
