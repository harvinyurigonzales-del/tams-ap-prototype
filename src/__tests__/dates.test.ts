import { describe, expect, it } from 'vitest'
import { departureAvailability, promoFor } from '../domain/rules'
import { canonical } from '../seed/canonical'
import { shiftDataset } from '../seed/shift'

// The sample data written around Oct 8, 2026, viewed on Sun, Oct 25, 2026: it moves two weeks forward.
describe('sample data follows the demo date', () => {
  const today = '2026-10-25'
  const d = shiftDataset(canonical, 14, 0, today)
  const dep = (id: string) => d.departures.find((x) => x.id === id)!

  it('moves dates in whole weeks so weekend tours stay on weekends', () => {
    expect(dep('DEP-BAG-1017').startDate).toBe('2026-10-31')
    expect(new Date(dep('DEP-BAG-1017').startDate).getUTCDay()).toBe(6)
  })

  it('never offers a departure that already left or is inside the cutoff', () => {
    expect(departureAvailability(dep('DEP-BAG-1010'), d.bookings, today).state).toBe('past')
    // Seed Oct 11 + 14 = Oct 25, today: closed for online booking.
    expect(departureAvailability(dep('DEP-PAG-1011'), d.bookings, today).state).not.toBe('open')
    expect(departureAvailability(dep('DEP-BAG-1031'), d.bookings, today).state).toBe('open')
  })

  it('stops applying a promo after its book-by date', () => {
    const saver = dep('DEP-BAG-1017')
    expect(saver.promo!.bookBy).toBe('2026-10-24')
    expect(promoFor(saver, today)).toBe(0)
    expect(promoFor(saver, '2026-10-24')).toBe(200)
  })

  it('keeps dates written in messages in step with the records', () => {
    const n = d.notifications.find((x) => x.id === 'NTF-0106')!
    expect(n.body).toContain('Oct 31')
    expect(n.at.startsWith('2026-10-22')).toBe(true)
  })

  it('closes out trips that ended before today', () => {
    const past = d.bookings.filter((b) => b.endDate < today)
    expect(past.length).toBeGreaterThan(0)
    expect(past.every((b) => b.status === 'Completed' || b.status === 'Cancelled')).toBe(true)
  })
})
