import { beforeEach, describe, expect, it } from 'vitest'
import { agreedOf, isOffered } from '../domain/packages'
import { catalogTours, recommendationRows } from '../domain/recommend'
import { sharedSeed } from '../seed/derive'
import { DEMO_ADMIN, useAdmin } from '../state/adminStore'
import { DEMO_CUSTOMER, useCustomer } from '../state/customerStore'
import { DATA_VERSION, upgrade } from '../state/migrate'
import { resetAll } from '../state/demo'
import { startSync } from '../state/sync'

startSync()

const admin = () => useAdmin.getState()
const customer = () => useCustomer.getState()

beforeEach(() => resetAll())

describe('saved data from the previous version', () => {
  it('upgrades in place and keeps records', () => {
    const { data, maintenance } = sharedSeed()
    // Shape of a version 1 copy: no statuses, snapshots or new lists.
    const old = structuredClone(data) as unknown as Record<string, unknown> & typeof data
    for (const s of old.services) delete s.status
    old.services.find((s) => s.id === 'SVC-BAG')!.inactive = true
    for (const b of old.bookings) delete b.agreed
    delete (old as Partial<typeof data>).activity
    delete (old as Partial<typeof data>).refunds
    const up = upgrade({ v: 1, data: old, maintenance })!
    expect(up.v).toBe(DATA_VERSION)
    expect(up.data.bookings).toHaveLength(data.bookings.length)
    expect(up.data.customers).toEqual(data.customers)
    expect(up.data.services.find((s) => s.id === 'SVC-BAG')!.status).toBe('Inactive')
    expect(up.data.bookings.every((b) => b.agreed && b.agreed.pickupTime)).toBe(true)
    expect(up.data.activity).toEqual([])
  })

  it('rejects data from a newer version instead of guessing', () => {
    const { data, maintenance } = sharedSeed()
    expect(upgrade({ v: DATA_VERSION + 1, data, maintenance })).toBeNull()
  })
})

describe('deactivated packages', () => {
  it('leave the catalog and recommendations and cannot be booked, while bookings stay as agreed', () => {
    admin().login(DEMO_ADMIN.email, DEMO_ADMIN.password)
    const id = 'SVC-BAG'
    const before = admin().data.bookings.filter((b) => b.serviceId === id)
    expect(before.length).toBeGreaterThan(0)
    const dep = admin().data.departures.find((d) => d.serviceId === id && d.startDate > admin().data.bookings[0].startDate)
    expect(admin().setPackageActive(id, false).ok).toBe(true)
    const d = customer().data
    expect(isOffered(d.services.find((s) => s.id === id)!)).toBe(false)
    expect(catalogTours(d).some((s) => s.id === id)).toBe(false)
    const rows = recommendationRows(d, { customerId: null, saved: [], viewed: ['tour:SVC-BAG'], dismissed: [] })
    expect(rows.flatMap((r) => r.items).some((i) => i.id === id)).toBe(false)
    customer().login(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password)
    const r = customer().createBooking({ serviceId: id, departureId: dep?.id, pax: 1, contactName: 'Maria Santos', contactMobile: '09175550123' })
    expect(r.ok).toBe(false)
    const after = customer().data.bookings.filter((b) => b.serviceId === id)
    expect(after).toEqual(before)
  })

  it('editing a package does not change what existing bookings agreed to', () => {
    admin().login(DEMO_ADMIN.email, DEMO_ADMIN.password)
    const svc = admin().data.services.find((s) => s.id === 'SVC-BAG')!
    const b = admin().data.bookings.find((x) => x.serviceId === svc.id)!
    const agreed = structuredClone(agreedOf(admin().data, b))
    const r = admin().savePackage(svc.id, { ...svc, name: 'Baguio Weekend Escape (new)', pickupTime: '03:00', itinerary: ['Day 1: Something else'] })
    expect(r.ok).toBe(true)
    const now = admin().data.bookings.find((x) => x.id === b.id)!
    expect(agreedOf(admin().data, now)).toEqual(agreed)
    expect(now.total).toBe(b.total)
  })
})
