import { beforeEach, describe, expect, it } from 'vitest'
import { answerQuestion } from '../domain/assistant'
import { bookingReport, dashboard, PERIODS, revenueReport, statusCounts } from '../domain/metrics'
import { bookableDeparture, recKey, recommendationRows, type RecContext } from '../domain/recommend'
import { rentalEstimate, validateRental, type RentalInput } from '../domain/requests'
import { adminSeed, customerSeed } from '../seed/derive'
import type { Dataset } from '../seed/types'
import { useAdmin } from '../state/adminStore'
import { DEMO_CUSTOMER, NEW_CUSTOMER, useCustomer } from '../state/customerStore'
import { resetAll } from '../state/demo'

const STD = () => customerSeed().vehicleCategories[0]
const login = (acct = DEMO_CUSTOMER) => expect(useCustomer.getState().login(acct.email, acct.password).ok).toBe(true)

beforeEach(() => {
  resetAll()
})

describe('van rental estimate', () => {
  it('counts calendar days as service days and adds the overnight allowance', () => {
    const e = rentalEstimate(STD(), { tripType: 'Multi-day', startDate: '2026-10-24', startTime: '06:00', endDate: '2026-10-25', endTime: '17:00' })
    expect(e.serviceDays).toBe(2)
    expect(e.total).toBe(6500 * 2 + 1000)
  })

  it('adds overtime to same-day trips over 12 hours and bills one-way as a full day', () => {
    const long = rentalEstimate(STD(), { tripType: 'Round trip (same day)', startDate: '2026-10-20', startTime: '05:00', endDate: '', endTime: '19:00' })
    expect(long.total).toBe(6500 + 2 * 500)
    const oneWay = rentalEstimate(STD(), { tripType: 'One-way', startDate: '2026-10-20', startTime: '05:00', endDate: '2026-10-30', endTime: '' })
    expect(oneWay.serviceDays).toBe(1)
    expect(oneWay.notes[0]).toMatch(/full service day/)
  })
})

describe('van rental validation', () => {
  const base: RentalInput = {
    categoryId: 'CAT-STD', tripType: 'Round trip (same day)', pickupArea: 'Bulacan', pickup: 'Malolos', dropoff: 'Tagaytay',
    destinationArea: 'Cavite', startDate: '2026-10-22', startTime: '06:00', endDate: '2026-10-22', endTime: '18:00', passengers: 8,
  }
  const d = customerSeed()

  it('accepts a valid request', () => {
    expect(validateRental(d, base)).toEqual({})
  })

  it('checks chronology, cutoff, capacity and service area', () => {
    expect(validateRental(d, { ...base, endTime: '05:00' }).endTime).toBeTruthy()
    expect(validateRental(d, { ...base, tripType: 'Multi-day', endDate: '2026-10-21' }).endDate).toBeTruthy()
    expect(validateRental(d, { ...base, startDate: '2026-10-10' }).startDate).toMatch(/close 2 days/)
    expect(validateRental(d, { ...base, passengers: 13 }).passengers).toMatch(/up to 12/)
    expect(validateRental(d, { ...base, destinationArea: 'Outside Luzon' }).destinationArea).toMatch(/outside our service area/)
    expect(validateRental(d, { ...base, pickupArea: 'Cebu' }).pickupArea).toBeTruthy()
  })

  it('flags dates when no van of the category is free (day resolution)', () => {
    // Oct 11: Van 03's maintenance ends Oct 10, so one premium van is free even though Van 06 is in repair.
    expect(validateRental(d, { ...base, categoryId: 'CAT-PRM', passengers: 8, startDate: '2026-10-11', endDate: '2026-10-11' }).availability).toBeUndefined()
    expect(validateRental(d, { ...base, categoryId: 'CAT-PRM', passengers: 8, startDate: '2026-10-11', endDate: '2026-10-11' }).startDate).toBeUndefined()
    const blocked: Dataset = structuredClone(d)
    blocked.vehicles.find((v) => v.id === 'VAN-03')!.blocks.push({ from: '2026-10-22', to: '2026-10-22', kind: 'maintenance', note: '' })
    blocked.vehicles.find((v) => v.id === 'VAN-06')!.blocks.push({ from: '2026-10-21', to: '2026-10-23', kind: 'unavailable', note: '' })
    expect(validateRental(blocked, { ...base, categoryId: 'CAT-PRM' }).availability).toMatch(/No premium van is free/)
  })
})

describe('custom-trip proposal acceptance', () => {
  it('creates exactly one pending booking, linked both ways, and does not confirm it', () => {
    login()
    const before = useCustomer.getState().data.bookings.length
    const r1 = useCustomer.getState().acceptProposal('CR-2026-0012')
    const r2 = useCustomer.getState().acceptProposal('CR-2026-0012')
    expect(r1.ok && r2.ok).toBe(true)
    if (!r1.ok || !r2.ok) return
    expect(r2.value.id).toBe(r1.value.id)
    const s = useCustomer.getState().data
    expect(s.bookings.length).toBe(before + 1)
    const b = s.bookings.find((x) => x.id === r1.value.id)!
    expect(b).toMatchObject({ status: 'Pending', total: 30900, requestId: 'CR-2026-0012', serviceId: 'SVC-CUSTOM' })
    expect(b.confirmedAt).toBeUndefined()
    expect(s.payments.some((p) => p.bookingId === b.id)).toBe(false)
    const req = s.customRequests.find((x) => x.id === 'CR-2026-0012')!
    expect(req.status).toBe('Accepted')
    expect(req.bookingId).toBe(b.id)
  })

  it('accepting a rental quote creates a van booking at the quoted price', () => {
    login()
    const r = useCustomer.getState().acceptQuote('VR-2026-0005')
    expect(r.ok && r.value.total).toBe(14000)
    expect(r.ok && r.value.serviceId).toBe('SVC-VAN')
  })

  it('another customer cannot accept Maria’s proposal', () => {
    login(NEW_CUSTOMER)
    expect(useCustomer.getState().acceptProposal('CR-2026-0012').ok).toBe(false)
  })

  it('change requests send the proposal back to review', () => {
    login()
    expect(useCustomer.getState().requestChanges('custom', 'CR-2026-0012', 'Leave an hour later').ok).toBe(true)
    expect(useCustomer.getState().data.customRequests.find((x) => x.id === 'CR-2026-0012')!.status).toBe('Under review')
    expect(useCustomer.getState().acceptProposal('CR-2026-0012').ok).toBe(false)
  })
})

describe('requests are not revenue', () => {
  it('adding or advancing requests leaves every report figure unchanged', () => {
    const d = adminSeed()
    const extra = structuredClone(d)
    extra.customRequests.push({ ...extra.customRequests[3], id: 'CR-TEST', status: 'Proposal ready' })
    extra.rentalRequests.push({ ...extra.rentalRequests[1], id: 'VR-TEST' })
    const [OCT] = PERIODS
    expect(dashboard(extra)).toEqual(dashboard(d))
    expect(statusCounts(extra)).toEqual(statusCounts(d))
    expect(bookingReport(extra, OCT).value).toBe(bookingReport(d, OCT).value)
    expect(revenueReport(extra, OCT).collections).toBe(revenueReport(d, OCT).collections)
  })

  it('the accepted seeded rental counts once, through its booking', () => {
    const d = adminSeed()
    const linked = d.bookings.filter((b) => b.requestId === 'VR-2026-0001')
    expect(linked).toHaveLength(1)
    expect(linked[0].total).toBe(d.rentalRequests.find((r) => r.id === 'VR-2026-0001')!.quote!.total)
  })

  it('admin can send the prepared Vigan proposal', () => {
    const a = useAdmin.getState()
    expect(a.sendProposal('custom', 'CR-2026-0009').ok).toBe(true)
    const r = useAdmin.getState().data.customRequests.find((x) => x.id === 'CR-2026-0009')!
    expect(r.status).toBe('Proposal ready')
    expect(r.proposal?.validUntil).toBe('2026-10-15')
    expect(dashboard(useAdmin.getState().data).collections).toBe(25092)
  })
})

describe('recommendations', () => {
  const d = customerSeed()
  const maria = (): RecContext => ({ customerId: 'CUS-0001', prefs: d.preferences['CUS-0001'], saved: d.saved['CUS-0001'], viewed: [], dismissed: [] })
  const keys = (rows: ReturnType<typeof recommendationRows>) => rows.flatMap((r) => r.items.map((i) => recKey(i.kind, i.id)))

  it('never repeats an item across rows and never offers a tour without open dates', () => {
    const rows = recommendationRows(d, maria())
    const all = keys(rows)
    expect(new Set(all).size).toBe(all.length)
    for (const k of all.filter((x) => x.startsWith('tour:'))) expect(bookableDeparture(d, k.slice(5))).toBeTruthy()
  })

  it('history rows only come from the customer’s own completed trips', () => {
    expect(recommendationRows(d, maria()).find((r) => r.id === 'history')?.title).toBe('Because you went to Tagaytay')
    const paolo = recommendationRows(d, { customerId: 'CUS-0011', saved: [], viewed: [], dismissed: [] })
    expect(paolo.map((r) => r.id)).toEqual(['departures', 'destinations'])
  })

  it('guests get fallback rows only', () => {
    const rows = recommendationRows(d, { customerId: null, saved: [], viewed: [], dismissed: [] })
    expect(rows.map((r) => r.id)).toEqual(['departures', 'destinations'])
    expect(rows.every((r) => r.items.every((i) => i.reason))).toBe(true)
  })

  it('changing preferences changes the matches', () => {
    const cool = recommendationRows(d, maria()).find((r) => r.id === 'interests')!.items
    const beach = recommendationRows(d, { ...maria(), prefs: { interests: ['Beach'], budgetMax: 0, duration: 'Any', style: 'Any' } }).find((r) => r.id === 'interests')!.items
    expect(beach.map((i) => i.id)).not.toEqual(cool.map((i) => i.id))
    expect(beach[0].reason).toMatch(/Beach/)
  })

  it('“Not interested” removes an item for the session', () => {
    const first = recommendationRows(d, maria())[0].items[0]
    const after = keys(recommendationRows(d, { ...maria(), dismissed: [recKey(first.kind, first.id)] }))
    expect(after).not.toContain(recKey(first.kind, first.id))
  })
})

describe('Ask TAMS assistant', () => {
  const d = customerSeed()
  const ask = (question: string, customerId: string | null = 'CUS-0001') => answerQuestion(d, { question, customerId })

  it('answers from the data', () => {
    expect(ask('How much is the Baguio tour?').text).toMatch(/₱2,499 per person/)
    expect(ask('how much is a van rental per day').intent).toBe('van_rental')
    expect(ask('What payment methods do you accept? gcash?').intent).toBe('payment_methods')
  })

  it('asks for clarification when the question is ambiguous', () => {
    expect(ask('How much?').intent).toBe('clarify')
    expect(ask('Trips to San Juan?').options).toHaveLength(2)
  })

  it('offers staff when it cannot answer', () => {
    const a = ask('Can I bring my dog on the van?')
    expect(a.intent).toBe('unknown')
    expect(a.escalate).toBe(true)
  })

  it('personal answers need login and only use the active customer’s records', () => {
    expect(ask('What is the status of my booking?', null).intent).toBe('login_needed')
    expect(ask('Status of BK-2026-0130?').text).toMatch(/couldn’t find BK-2026-0130/)
    expect(ask('What is the status of my booking?').text).toMatch(/BK-2026-0141/)
    expect(ask('What is the status of my booking?').text).not.toMatch(/Joel|BK-2026-0130/)
  })
})

describe('escalation and messages', () => {
  it('creates an inquiry that waits for staff, then shows the sample reply', () => {
    login()
    const r = useCustomer.getState().escalate({ subject: 'Dog on the van', text: 'Can I bring my dog?', relatedRef: 'BK-2026-0141' })
    expect(r.ok && r.value.id).toBe('INQ-2026-0005')
    expect(r.ok && r.value.status).toBe('Awaiting staff')
    expect(useCustomer.getState().escalate({ subject: 'x', text: 'y', relatedRef: 'BK-2026-0130' }).ok).toBe(false)
    expect(useCustomer.getState().showSampleReply('INQ-2026-0005').ok).toBe(true)
    expect(useCustomer.getState().data.inquiries.find((q) => q.id === 'INQ-2026-0005')!.status).toBe('Staff replied')
  })
})

describe('reset', () => {
  it('clears everything the revision adds', () => {
    login()
    const s = useCustomer.getState()
    s.toggleSaved({ kind: 'tour', id: 'SVC-BAG' })
    s.setPreferences({ interests: ['Beach'], budgetMax: 0, duration: 'Any', style: 'Any' })
    s.markViewed('tour', 'SVC-TAG')
    s.dismiss('tour', 'SVC-PAG')
    s.addChat({ from: 'customer', text: 'hi' })
    s.toggleChecklist('BK-2026-0141', 'id')
    s.saveDraft('custom', undefined)
    s.acceptProposal('CR-2026-0012')
    s.escalate({ subject: 'a', text: 'b' })
    resetAll()
    const after = useCustomer.getState()
    expect(after.data).toEqual(customerSeed())
    expect([after.viewed, after.dismissed, after.chat]).toEqual([[], [], []])
    expect(after.checklist).toEqual({})
    expect(after.drafts).toEqual({})
    expect(after.customerId).toBeNull()
  })
})
