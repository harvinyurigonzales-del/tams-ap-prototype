import { beforeEach, describe, expect, it } from 'vitest'
import { EMPTY_FILTER, filterTours } from '../domain/explore'
import { forecastSales } from '../domain/forecast'
import { needsReply, ratingFor, reviewEligibility } from '../domain/reviews'
import { adminFixture as adminSeed, customerFixture as customerSeed, loadFixture } from './fixtures'
import { useAdmin } from '../state/adminStore'
import { DEMO_CUSTOMER, NEW_CUSTOMER, useCustomer } from '../state/customerStore'
import { resetAll } from '../state/demo'

describe('public reviews', () => {
  beforeEach(() => {
    resetAll()
    loadFixture(customerSeed())
  })
  const d = customerSeed()

  it('seeded reviews are all 4 stars or higher, each tied to a tour', () => {
    expect(d.reviews.length).toBeGreaterThan(40)
    expect(d.reviews.every((r) => r.rating >= 4)).toBe(true)
    expect(d.reviews.every((r) => d.services.some((s) => s.id === r.serviceId))).toBe(true)
  })

  it('only travellers with a completed trip can rate', () => {
    expect(reviewEligibility(d, null)).toEqual({ ok: false, reason: 'guest' })
    const maria = reviewEligibility(d, 'CUS-0001')
    expect(maria.ok && maria.trips.map((b) => b.id)).toEqual(['BK-2026-0098'])
    // Nicole already reviewed her Baguio trip.
    expect(reviewEligibility(d, 'CUS-0007')).toEqual({ ok: false, reason: 'all-reviewed' })
  })

  it('a new account cannot post, Maria can post once', () => {
    const c = useCustomer.getState()
    expect(c.login(NEW_CUSTOMER.email, NEW_CUSTOMER.password).ok).toBe(true)
    expect(useCustomer.getState().submitReview({ bookingId: 'BK-2026-0098', rating: 5, title: 'Great', text: 'Trying to post without a trip of my own.' }).ok).toBe(false)

    expect(useCustomer.getState().login(DEMO_CUSTOMER.email, DEMO_CUSTOMER.password).ok).toBe(true)
    const before = ratingFor(useCustomer.getState().data, 'SVC-TAG').count
    const input = { bookingId: 'BK-2026-0098', rating: 5, title: 'Clear view of Taal', text: 'On time pickup and a relaxed pace the whole day.' }
    expect(useCustomer.getState().submitReview(input).ok).toBe(true)
    expect(ratingFor(useCustomer.getState().data, 'SVC-TAG').count).toBe(before + 1)
    expect(useCustomer.getState().submitReview(input).ok).toBe(false)
  })

  it('staff replies clear a review from the queue', () => {
    const a = useAdmin.getState()
    const waiting = a.data.reviews.filter(needsReply)
    expect(waiting.length).toBeGreaterThan(0)
    expect(a.replyReview(waiting[0].id, '').ok).toBe(false)
    expect(useAdmin.getState().replyReview(waiting[0].id, 'Salamat po, see you on the next trip!').ok).toBe(true)
    expect(useAdmin.getState().data.reviews.filter(needsReply).length).toBe(waiting.length - 1)
  })

  it('Top rated sort puts the best-rated bookable tour first', () => {
    const list = filterTours(d, { ...EMPTY_FILTER, sort: 'rating', open: true })
    const avgs = list.map((s) => ratingFor(d, s.id).avg)
    expect(avgs).toEqual([...avgs].sort((a, b) => b - a))
  })
})

describe('sales forecast', () => {
  const history = adminSeed().salesHistory
  const f = forecastSales(history, 6)

  it('forecasts six months after the last actual month', () => {
    expect(f.points.map((p) => p.month)).toEqual(['2026-10', '2026-11', '2026-12', '2027-01', '2027-02', '2027-03'])
  })

  it('keeps December as the peak and ranges that widen with each month', () => {
    const dec = f.points.find((p) => p.month === '2026-12')!
    expect(Math.max(...f.points.map((p) => p.value))).toBe(dec.value)
    const widths = f.points.map((p) => (p.high80 - p.low80) / p.value)
    widths.slice(1).forEach((w, i) => expect(w).toBeGreaterThan(widths[i]))
    f.points.forEach((p) => {
      expect(p.low95).toBeLessThanOrEqual(p.low80)
      expect(p.low80).toBeLessThanOrEqual(p.value)
      expect(p.value).toBeLessThanOrEqual(p.high80)
      expect(p.high80).toBeLessThanOrEqual(p.high95)
    })
  })

  it('is deterministic and shows a modest upward trend', () => {
    expect(forecastSales(history, 6)).toEqual(f)
    expect(f.monthlyGrowth).toBeGreaterThan(0)
    expect(f.monthlyGrowth).toBeLessThan(0.05)
  })
})
