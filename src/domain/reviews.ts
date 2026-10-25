import { addDays, DEMO_TODAY } from '../lib/demoClock'
import type { Booking, Dataset, Review } from '../seed/types'

// Public ratings. Only customers with a completed TAMS AP trip can review, one review per trip, which keeps
// trolls out without moderation queues.

export interface Rating {
  avg: number
  count: number
  /** Count of 5, 4, 3, 2, 1 star reviews, in that order. */
  dist: [number, number, number, number, number]
}

export function ratingOf(reviews: Review[]): Rating {
  const dist: Rating['dist'] = [0, 0, 0, 0, 0]
  let sum = 0
  for (const r of reviews) {
    dist[5 - r.rating] += 1
    sum += r.rating
  }
  return { avg: reviews.length ? Math.round((sum / reviews.length) * 10) / 10 : 0, count: reviews.length, dist }
}

export const reviewsFor = (d: Dataset, serviceId: string) => d.reviews.filter((r) => r.serviceId === serviceId)
export const ratingFor = (d: Dataset, serviceId: string) => ratingOf(reviewsFor(d, serviceId))

/** A customer's own completed trips that do not have a review yet, most recent first. */
export function reviewableTrips(d: Dataset, customerId: string | null): Booking[] {
  if (!customerId) return []
  return d.bookings
    .filter((b) => b.customerId === customerId && b.status === 'Completed' && !d.reviews.some((r) => r.bookingId === b.id))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))
}

/** The customer's completed trips that already have their review. */
export function reviewedTrips(d: Dataset, customerId: string | null): { booking: Booking; review: Review }[] {
  if (!customerId) return []
  return d.bookings
    .filter((b) => b.customerId === customerId && b.status === 'Completed')
    .flatMap((b) => {
      const review = d.reviews.find((r) => r.bookingId === b.id)
      return review ? [{ booking: b, review }] : []
    })
}

export type Eligibility = { ok: true; trips: Booking[] } | { ok: false; reason: 'guest' | 'no-trips' | 'all-reviewed' }

export function reviewEligibility(d: Dataset, customerId: string | null): Eligibility {
  if (!customerId) return { ok: false, reason: 'guest' }
  const completed = d.bookings.some((b) => b.customerId === customerId && b.status === 'Completed')
  if (!completed) return { ok: false, reason: 'no-trips' }
  const trips = reviewableTrips(d, customerId)
  return trips.length ? { ok: true, trips } : { ok: false, reason: 'all-reviewed' }
}

/** "Maria Santos" → "Maria S." */
export const publicName = (full: string) => {
  const [first, ...rest] = full.trim().split(/\s+/)
  const last = rest.at(-1)
  return last ? `${first} ${last[0]}.` : first
}

/** Only the star rating is required. A title, a written review and a suggestion are optional. */
export function validateReview(input: { rating: number; title?: string; text?: string; suggestion?: string }) {
  const errors: { rating?: string; title?: string; text?: string; suggestion?: string } = {}
  if (!(Number.isInteger(input.rating) && input.rating >= 1 && input.rating <= 5)) errors.rating = 'Choose a star rating from 1 to 5.'
  if ((input.title ?? '').trim().length > 80) errors.title = 'Keep the title under 80 characters.'
  if ((input.text ?? '').trim().length > 1000) errors.text = 'Keep the review under 1,000 characters.'
  if ((input.suggestion ?? '').trim().length > 500) errors.suggestion = 'Keep the suggestion under 500 characters.'
  return errors
}

export type ReviewSort = 'recent' | 'highest'

/** Days a new review stays in the staff "needs reply" queue. Older ones without a reply are left as they are. */
export const REPLY_WINDOW_DAYS = 30

export const needsReply = (r: Review) => !r.staffReply && r.createdAt.slice(0, 10) >= addDays(DEMO_TODAY, -REPLY_WINDOW_DAYS)
