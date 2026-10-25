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

/** Completed tour trips of a customer that do not have a review yet. */
export function reviewableTrips(d: Dataset, customerId: string | null): Booking[] {
  if (!customerId) return []
  return d.bookings.filter(
    (b) => b.customerId === customerId && b.status === 'Completed' && !b.rental && b.serviceId !== 'SVC-CUSTOM' && !d.reviews.some((r) => r.bookingId === b.id),
  )
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

export function validateReview(input: { rating: number; title: string; text: string }) {
  const errors: { rating?: string; title?: string; text?: string } = {}
  if (!(input.rating >= 1 && input.rating <= 5)) errors.rating = 'Choose a star rating.'
  if (!input.title.trim()) errors.title = 'Add a short title.'
  else if (input.title.trim().length > 80) errors.title = 'Keep the title under 80 characters.'
  if (input.text.trim().length < 20) errors.text = 'Tell other travellers a little more (at least 20 characters).'
  else if (input.text.trim().length > 1000) errors.text = 'Keep the review under 1,000 characters.'
  return errors
}

export type ReviewSort = 'recent' | 'highest'

/** Days a new review stays in the staff "needs reply" queue. Older ones without a reply are left as they are. */
export const REPLY_WINDOW_DAYS = 30

export const needsReply = (r: Review) => !r.staffReply && r.createdAt.slice(0, 10) >= addDays(DEMO_TODAY, -REPLY_WINDOW_DAYS)
