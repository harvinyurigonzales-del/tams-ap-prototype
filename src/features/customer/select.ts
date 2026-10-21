import { departureAvailability } from '../../domain/rules'
import type { Dataset, Service } from '../../seed/types'

/** Upcoming departures of a tour with availability, soonest first. */
export function departuresOf(d: Dataset, serviceId: string) {
  return d.departures
    .filter((x) => x.serviceId === serviceId)
    .map((dep) => ({ dep, avail: departureAvailability(dep, d.bookings) }))
    .filter((x) => x.avail.state !== 'past')
    .sort((a, b) => a.dep.startDate.localeCompare(b.dep.startDate))
}

export function nextOpen(d: Dataset, s: Service) {
  return departuresOf(d, s.id).find((x) => x.avail.state === 'open')
}

export const priceUnit = (s: Service) => (s.unit === 'person' ? '/person' : '/day')
