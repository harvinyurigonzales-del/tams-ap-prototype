import { beforeEach, describe, expect, it } from 'vitest'
import { matchPreset, respond, type ChatPreset } from '../domain/assistant'
import { proposalTrack } from '../domain/requests'
import { vehicleConflict, vehicleStatusOn } from '../domain/rules'
import { addDays, DEMO_TODAY } from '../lib/demoClock'
import { DEMO_ADMIN, DEMO_STAFF, useAdmin } from '../state/adminStore'

const admin = () => useAdmin.getState()

beforeEach(() => admin().reset())

describe('roles', () => {
  it('staff cannot run admin-only actions', () => {
    expect(admin().login(DEMO_STAFF.email, DEMO_STAFF.password).ok).toBe(true)
    expect(admin().saveSettings({ ...admin().settings, businessName: 'X Tours' })).toEqual({ ok: false, error: 'Only an admin can do this.' })
    expect(admin().deleteStaff('STF-03').ok).toBe(false)
  })

  it('an admin cannot demote, deactivate or delete themselves', () => {
    admin().login(DEMO_ADMIN.email, DEMO_ADMIN.password)
    const me = admin().accounts.find((a) => a.id === 'STF-01')!
    expect(admin().saveStaff(me.id, { ...me, role: 'Staff' }).ok).toBe(false)
    expect(admin().setStaffActive(me.id, false).ok).toBe(false)
    expect(admin().deleteStaff(me.id).ok).toBe(false)
  })
})

describe('maintenance', () => {
  beforeEach(() => admin().login(DEMO_ADMIN.email, DEMO_ADMIN.password))

  it('overdue maintenance keeps the van out of service until confirmed done', () => {
    const van = () => admin().data.vehicles.find((v) => v.id === 'VAN-05')!
    expect(vehicleStatusOn(admin().data, van())).toBe('Maintenance')
    const t = { kind: 'booking' as const, id: 'X', from: DEMO_TODAY, to: DEMO_TODAY, pax: 4, label: 'X' }
    expect(vehicleConflict(admin().data, van(), t)).toMatch(/overdue/)
    const m = admin().maintenance.find((x) => x.vehicleId === 'VAN-05' && x.status === 'Scheduled')!
    expect(admin().completeMaintenance(m.id, { note: '' }).ok).toBe(true)
    expect(vehicleStatusOn(admin().data, van())).toBe('Available')
    expect(vehicleConflict(admin().data, van(), t)).toBeNull()
  })

  it('cannot schedule over an assigned trip or mark future work done', () => {
    const r = admin().scheduleMaintenance({ vehicleId: 'VAN-01', type: 'Oil change', from: addDays(DEMO_TODAY, 9), to: addDays(DEMO_TODAY, 9), note: '' })
    expect(r.ok).toBe(false)
    const future = admin().maintenance.find((x) => x.vehicleId === 'VAN-02')!
    expect(admin().completeMaintenance(future.id, { note: '' }).ok).toBe(false)
  })
})

describe('proposals', () => {
  it('tracks a change request on the planner request and needs a revision before resending', () => {
    admin().login(DEMO_STAFF.email, DEMO_STAFF.password)
    const r = () => admin().data.customRequests.find((x) => x.plan)!
    expect(proposalTrack(r())).toBe('Changes requested')
    expect(admin().reviseProposal(r().id).ok).toBe(true)
    expect(r().draftProposal?.datesSet).toBe(true)
    expect(admin().sendProposal('custom', r().id).ok).toBe(true)
    expect(proposalTrack(r())).toBe('Sent')
    expect(proposalTrack(r(), addDays(DEMO_TODAY, 30))).toBe('Expired')
  })
})

describe('chatbot presets', () => {
  const presets: ChatPreset[] = [
    { id: 'P1', title: 'Hours', keywords: ['office hours'], answer: 'Mon to Sat, 8 to 6.', active: true },
    { id: 'P2', title: 'Off', keywords: ['parking'], answer: 'Free parking.', active: false },
  ]
  it('matches active presets by phrase and skips booking references', () => {
    expect(matchPreset(presets, 'What are your OFFICE hours?')?.id).toBe('P1')
    expect(matchPreset(presets, 'Is there parking?')).toBeUndefined()
    const d = admin().data
    expect(respond(d, { question: 'office hours please', customerId: null }, undefined, presets).text).toBe('Mon to Sat, 8 to 6.')
    expect(respond(d, { question: 'office hours for BK-2026-0141', customerId: null }, undefined, presets).intent).not.toBe('preset')
  })
})
