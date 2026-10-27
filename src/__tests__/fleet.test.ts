import { beforeEach, describe, expect, it } from 'vitest'
import { assignmentIssue, isMaintenanceOverdue, maintenanceConflicts, maintenanceView } from '../domain/fleet'
import { assignableTargets, driverConflict, vehicleConflict, vehicleStatusOn } from '../domain/rules'
import { addDays, DEMO_TODAY } from '../lib/demoClock'
import { sharedSeed } from '../seed/derive'
import { DEMO_ADMIN, DEMO_STAFF, useAdmin } from '../state/adminStore'
import { staffSteps } from '../state/customerStore'
import { upgrade } from '../state/migrate'

const admin = () => useAdmin.getState()
const data = () => admin().data
const upcoming = () => data().assignments.filter((a) => a.from > addDays(DEMO_TODAY, 1)).sort((a, b) => a.from.localeCompare(b.from))[0]

beforeEach(() => {
  admin().reset()
  admin().login(DEMO_ADMIN.email, DEMO_ADMIN.password)
})

describe('saved fleet data from the previous version', () => {
  it('turns Done maintenance into Completed and gives every unavailable period an id', () => {
    const { data: d, maintenance } = sharedSeed()
    const old = structuredClone(maintenance).map((m) => (m.status === 'Completed' ? { ...m, status: 'Done' as never, completedOn: undefined } : m))
    for (const v of d.vehicles) for (const b of v.blocks) delete b.id
    const up = upgrade({ v: 3, data: d, maintenance: old })!
    const done = up.maintenance.find((m) => m.vehicleId === 'VAN-04')!
    expect(done.status).toBe('Completed')
    expect(done.completedOn).toBe(done.doneAt!.slice(0, 10))
    expect(up.data.vehicles.flatMap((v) => v.blocks).every((b) => b.id)).toBe(true)
    expect(up.maintenance).toHaveLength(maintenance.length)
  })
})

describe('maintenance lifecycle', () => {
  it('overdue is worked out from the dates, and completing frees the van', () => {
    const m = admin().maintenance.find((x) => x.vehicleId === 'VAN-05')!
    expect(m.status).toBe('Scheduled')
    expect(isMaintenanceOverdue(m)).toBe(true)
    expect(maintenanceView(m)).toBe('Overdue')
    expect(admin().completeMaintenance(m.id, { completedOn: addDays(DEMO_TODAY, 1), note: '' }).ok).toBe(false)
    expect(admin().completeMaintenance(m.id, { completedOn: addDays(m.from, -1), note: '' }).ok).toBe(false)
    expect(admin().completeMaintenance(m.id, { completedOn: DEMO_TODAY, cost: 4100, note: 'Brake pads replaced' }).ok).toBe(true)
    const after = admin().maintenance.find((x) => x.id === m.id)!
    expect(after).toMatchObject({ status: 'Completed', completedOn: DEMO_TODAY, cost: 4100 })
    expect(vehicleStatusOn(data(), data().vehicles.find((v) => v.id === 'VAN-05')!)).toBe('Available')
    const log = data().activity.find((e) => e.recordId === m.id)!
    expect(log.action).toBe('Completed')
    expect(log.changes).toEqual(expect.arrayContaining([{ field: 'Status', from: 'Scheduled', to: 'Completed' }]))
  })

  it('scheduled → in maintenance → completed; started work keeps its van and start date', () => {
    const vid = data().vehicles.find((v) => v.active !== false && maintenanceConflicts(data(), admin().maintenance, v.id, DEMO_TODAY, addDays(DEMO_TODAY, 2)).length === 0 && !v.blocks.length)!.id
    const r = admin().scheduleMaintenance({ vehicleId: vid, type: 'Aircon cleaning', from: DEMO_TODAY, to: addDays(DEMO_TODAY, 1), note: '', provider: 'CoolAir', cost: 2500 })
    if (!r.ok) throw new Error(r.error)
    expect(admin().startMaintenance(r.id!).ok).toBe(true)
    const m = () => admin().maintenance.find((x) => x.id === r.id)!
    expect(m().status).toBe('In Maintenance')
    expect(admin().updateMaintenance(r.id!, { ...m(), from: addDays(DEMO_TODAY, 1) }).ok).toBe(false)
    expect(admin().updateMaintenance(r.id!, { ...m(), to: addDays(DEMO_TODAY, 2) }).ok).toBe(true)
    expect(data().vehicles.find((v) => v.id === vid)!.blocks.find((b) => b.ref === r.id)!.to).toBe(addDays(DEMO_TODAY, 2))
    expect(admin().completeMaintenance(r.id!, { note: '' }).ok).toBe(true)
    expect(data().vehicles.find((v) => v.id === vid)!.blocks.some((b) => b.ref === r.id)).toBe(false)
  })

  it('cancelling needs a reason and keeps the record', () => {
    const m = admin().maintenance.find((x) => x.vehicleId === 'VAN-02' && x.status === 'Scheduled')!
    expect(admin().cancelMaintenance(m.id, '').ok).toBe(false)
    expect(admin().cancelMaintenance(m.id, 'Moved to next service interval').ok).toBe(true)
    expect(admin().maintenance.find((x) => x.id === m.id)).toMatchObject({ status: 'Cancelled', cancelReason: 'Moved to next service interval' })
    expect(data().vehicles.find((v) => v.id === 'VAN-02')!.blocks.some((b) => b.ref === m.id)).toBe(false)
  })

  it('lists conflicts with assigned trips (and their bookings), other maintenance and unavailable periods', () => {
    const a = upcoming()
    const list = maintenanceConflicts(data(), admin().maintenance, a.vehicleId, a.from, a.to)
    expect(list.some((c) => c.kind === 'trip' && c.text.includes(a.target.kind === 'booking' ? a.target.id : 'Assigned to'))).toBe(true)
    expect(admin().scheduleMaintenance({ vehicleId: a.vehicleId, type: 'Oil change', from: a.from, to: a.to, note: '' }).ok).toBe(false)
    const free = addDays(DEMO_TODAY, 200)
    expect(admin().saveVehicleBlock('VAN-01', { from: free, to: free, note: 'Registration renewal' }).ok).toBe(true)
    const clash = maintenanceConflicts(data(), admin().maintenance, 'VAN-01', free, free)
    expect(clash).toEqual([expect.objectContaining({ kind: 'unavailable' })])
    expect(admin().scheduleMaintenance({ vehicleId: 'VAN-01', type: 'Oil change', from: free, to: free, note: '' }).ok).toBe(false)
  })

  it('staff can see but not change maintenance', () => {
    admin().login(DEMO_STAFF.email, DEMO_STAFF.password)
    const m = admin().maintenance.find((x) => x.status === 'Scheduled')!
    expect(admin().cancelMaintenance(m.id, 'No longer needed').ok).toBe(false)
  })
})

describe('drivers', () => {
  it('unavailability over an assigned trip flags it for reassignment until staff pick another driver', () => {
    const a = upcoming()
    const drv = a.driverId
    expect(assignmentIssue(data(), a)).toBeNull()
    expect(admin().saveDriverBlock(drv, { from: a.from, to: a.to, note: 'Sick leave' }).ok).toBe(true)
    const flagged = data().assignments.find((x) => x.id === a.id)!
    expect(assignmentIssue(data(), flagged)).toMatch(/Sick leave/)
    const b = data().bookings.find((x) => (a.target.kind === 'departure' ? x.departureId === a.target.id : x.id === a.target.id) && x.status === 'Confirmed')
    if (b) expect(staffSteps(data(), b)).toContain('assign')
    const t = assignableTargets(data()).find((x) => x.kind === a.target.kind && x.id === a.target.id)!
    const other = data().drivers.find((d) => d.id !== drv && !driverConflict(data(), d, t))!
    expect(admin().assign(a.target, a.vehicleId, other.id).ok).toBe(true)
    expect(assignmentIssue(data(), data().assignments.find((x) => x.id === a.id)!)).toBeNull()
    // Editing and removing the period.
    const blk = data().drivers.find((d) => d.id === drv)!.blocks.find((x) => x.note === 'Sick leave')!
    expect(admin().saveDriverBlock(drv, { id: blk.id, from: a.from, to: a.from, note: 'Sick leave' }).ok).toBe(true)
    expect(admin().removeDriverBlock(drv, blk.id!).ok).toBe(true)
    expect(data().drivers.find((d) => d.id === drv)!.blocks.some((x) => x.id === blk.id)).toBe(false)
  })

  it('a driver with trip history is deactivated, not deleted, and takes no new trips', () => {
    const a = upcoming()
    expect(admin().deleteDriver(a.driverId).ok).toBe(false)
    expect(admin().setDriverActive(a.driverId, false, '').ok).toBe(false)
    expect(admin().setDriverActive(a.driverId, false, 'Resigned').ok).toBe(true)
    const d = data().drivers.find((x) => x.id === a.driverId)!
    expect(d.active).toBe(false)
    expect(driverConflict(data(), d, { kind: 'booking', id: 'X', from: addDays(DEMO_TODAY, 300), to: addDays(DEMO_TODAY, 300), pax: 1, label: 'X' })).toMatch(/Inactive/)
    expect(assignmentIssue(data(), a)).toMatch(/inactive/)
    expect(data().activity[0]).toMatchObject({ module: 'Drivers', action: 'Deactivated', changes: [{ field: 'Active', from: 'Yes', to: 'No' }] })
  })

  it('records before and after values for the fields that changed', () => {
    const d = data().drivers[0]
    expect(admin().saveDriver(d.id, { ...d, email: 'ramon@example.com', base: 'Malolos garage' }).ok).toBe(true)
    const e = data().activity[0]
    expect(e.changes).toEqual([
      { field: 'Email', from: '—', to: 'ramon@example.com' },
      { field: 'Address or base', from: '—', to: 'Malolos garage' },
    ])
    expect(admin().saveDriver(d.id, { ...d, email: 'not-an-email' }).ok).toBe(false)
  })
})

describe('vans', () => {
  it('keeps plates unique and seats enough for assigned trips', () => {
    const a = upcoming()
    const v = data().vehicles.find((x) => x.id === a.vehicleId)!
    const other = data().vehicles.find((x) => x.id !== v.id)!
    expect(admin().saveVehicle(v.id, { ...v, plate: other.plate.replace(' ', '') }).ok).toBe(false)
    const pax = assignableTargets(data()).find((t) => t.kind === a.target.kind && t.id === a.target.id)!.pax
    if (pax > 4) expect(admin().saveVehicle(v.id, { ...v, seats: pax - 1 }).ok).toBe(false)
    expect(admin().saveVehicle(v.id, { ...v, condition: 'Minor issues' }).ok).toBe(true)
    expect(data().activity[0].changes).toEqual([{ field: 'Condition', from: 'Good', to: 'Minor issues' }])
  })

  it('inactive and not roadworthy vans are not assignable; active, in maintenance and unavailable stay separate', () => {
    const v = data().vehicles.find((x) => x.id === 'VAN-02')!
    const far = { kind: 'booking' as const, id: 'X', from: addDays(DEMO_TODAY, 300), to: addDays(DEMO_TODAY, 300), pax: 2, label: 'X' }
    expect(vehicleConflict(data(), v, far)).toBeNull()
    expect(admin().saveVehicle(v.id, { ...v, condition: 'Not roadworthy' }).ok).toBe(true)
    expect(vehicleConflict(data(), data().vehicles.find((x) => x.id === 'VAN-02')!, far)).toBe('Not roadworthy')
    expect(admin().saveVehicle(v.id, { ...v, condition: 'Good' }).ok).toBe(true)
    expect(admin().setVehicleActive(v.id, false, 'Sold').ok).toBe(true)
    const off = data().vehicles.find((x) => x.id === 'VAN-02')!
    expect(vehicleStatusOn(data(), off)).toBe('Inactive')
    expect(vehicleConflict(data(), off, far)).toMatch(/Inactive/)
    expect(admin().deleteVehicle(v.id).ok).toBe(false)
    expect(admin().setVehicleActive(v.id, true, '').ok).toBe(true)
    // Van 03 is active and in maintenance today; Van 06 is active and marked unavailable.
    expect(vehicleStatusOn(data(), data().vehicles.find((x) => x.id === 'VAN-03')!)).toBe('Maintenance')
  })

  it('a van with no history can be removed', () => {
    const r = admin().saveVehicle(null, { name: 'Van 99', model: 'Toyota Hiace (2025)', plate: 'TMS 9999', seats: 12, categoryId: data().vehicleCategories[0].id, color: '', odometer: 0 })
    if (!r.ok) throw new Error(r.error)
    expect(data().vehicles.find((v) => v.id === r.id)!.active).toBe(true)
    expect(admin().deleteVehicle(r.id!).ok).toBe(true)
  })
})
