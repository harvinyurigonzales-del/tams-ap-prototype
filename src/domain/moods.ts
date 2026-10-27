import { isOffered } from './packages'
import { DEMO_TODAY } from '../lib/demoClock'
import type { Dataset, Destination, Interest, Service } from '../seed/types'
import { departureAvailability } from './rules'

// "Travel by mood" categories. Each one is a plain rule over fields the packages already have (interests and
// length), so a mood only appears when real packages match it.

export type MoodId = 'family' | 'beach' | 'mountain' | 'adventure' | 'heritage' | 'daytrip' | 'weekend'

export interface Mood {
  id: MoodId
  label: string
  /** Short Taglish line shown under the label. */
  line: string
  tour: (s: Service) => boolean
  destination: (d: Destination) => boolean
}

const has = (xs: Interest[] | undefined, i: Interest) => (xs ?? []).includes(i)

export const MOODS: Mood[] = [
  { id: 'family', label: 'Family escapes', line: 'Easy pace, para kay Lola at sa mga bata', tour: (s) => has(s.interests, 'Family'), destination: (d) => has(d.interests, 'Family') },
  { id: 'beach', label: 'Beach days', line: 'Tara, beach?', tour: (s) => has(s.interests, 'Beach'), destination: (d) => has(d.interests, 'Beach') },
  { id: 'mountain', label: 'Mountain air', line: 'Pine trees and cool mornings', tour: (s) => has(s.interests, 'Cool weather'), destination: (d) => has(d.interests, 'Cool weather') },
  { id: 'adventure', label: 'Adventure', line: 'Para sa barkada na game sa lahat', tour: (s) => has(s.interests, 'Adventure'), destination: (d) => has(d.interests, 'Adventure') },
  { id: 'heritage', label: 'Heritage towns', line: 'Old streets and Ilocano food', tour: (s) => has(s.interests, 'Heritage'), destination: (d) => has(d.interests, 'Heritage') },
  { id: 'daytrip', label: 'Day trips', line: 'Alis nang maaga, uwi bago maghapunan', tour: (s) => s.days === 1, destination: (d) => d.suggestedDays === 1 },
  { id: 'weekend', label: 'Weekend trips', line: 'Two to three days away', tour: (s) => s.days >= 2 && s.days <= 3, destination: (d) => d.suggestedDays >= 2 && d.suggestedDays <= 3 },
]

export const moodById = (id: string | null | undefined) => MOODS.find((m) => m.id === id)

const tours = (d: Dataset) => d.services.filter(isOffered)

/** Moods that at least one tour in the catalog matches, with how many tours match each. */
export function availableMoods(d: Dataset) {
  return MOODS.map((m) => ({ mood: m, count: tours(d).filter(m.tour).length })).filter((x) => x.count > 0)
}

export interface TripWindow {
  /** Earliest departure date, YYYY-MM-DD. */
  from?: string
  /** Number of travellers who need seats. */
  pax?: number
}

/**
 * The soonest departure of a tour that can still be booked and fits the window: leaves on or after `from`
 * and has at least `pax` seats left. Without a window this is simply the next bookable departure.
 */
export function departureInWindow(d: Dataset, serviceId: string, w: TripWindow = {}, today = DEMO_TODAY) {
  const from = w.from && w.from > today ? w.from : today
  const pax = w.pax && w.pax > 0 ? w.pax : 1
  return d.departures
    .filter((x) => x.serviceId === serviceId && x.startDate >= from)
    .map((dep) => ({ dep, avail: departureAvailability(dep, d.bookings, today) }))
    .filter((x) => x.avail.state === 'open' && x.avail.left >= pax)
    .sort((a, b) => a.dep.startDate.localeCompare(b.dep.startDate))[0]
}
