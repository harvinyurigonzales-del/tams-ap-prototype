import type { AgreedTerms, Booking, Dataset, PackageStatus, Service } from '../seed/types'

// Tour package publication. Only Active packages are offered to customers: in the catalog, search, recommendations,
// Ask TAMS and the booking pages. Bookings keep a copy of what was agreed, so editing or deactivating a package never
// changes a booking that already exists.

/** Custom trips leave at the time staff agree with the group; payment deadlines count back from this default. */
export const CUSTOM_PICKUP_TIME = '06:00'

export const PACKAGE_STATUSES: PackageStatus[] = ['Draft', 'Active', 'Inactive', 'Archived']

export const packageStatus = (s: Service): PackageStatus => s.status ?? (s.inactive ? 'Inactive' : 'Active')

/** A tour customers can find and book. Van rental and custom trips are services, not packages. */
export const isOffered = (s: Service) => s.type === 'tour' && packageStatus(s) === 'Active'

/** Sets the status and keeps the older `inactive` flag in step for records and screens that still read it. */
export function setStatus(s: Service, status: PackageStatus) {
  s.status = status
  s.inactive = status !== 'Active'
}

export const priceBasisOf = (s: Service): 'person' | 'group' => s.priceBasis ?? 'person'

/** The terms a booking is made on, copied from the package at that moment. */
export function agreedFrom(s: Service, pickupTime = s.pickupTime): AgreedTerms {
  return {
    title: s.name, duration: s.duration, pickup: s.pickup, pickupTime, itinerary: [...s.itinerary], inclusions: [...s.inclusions], exclusions: [...s.exclusions],
    priceBasis: s.type === 'van' ? 'day' : s.type === 'custom' ? 'quote' : priceBasisOf(s),
  }
}

/** What a booking agreed to: its own copy, or the package as it is now for records made before copies were kept. */
export function agreedOf(d: Dataset, b: Booking): AgreedTerms {
  if (b.agreed) return b.agreed
  const s = d.services.find((x) => x.id === b.serviceId)
  const rentalTime = b.requestId ? d.rentalRequests.find((r) => r.id === b.requestId)?.startTime : undefined
  if (!s) return { title: b.label ?? b.serviceId, duration: '', pickup: b.rental?.pickup ?? '', pickupTime: rentalTime || CUSTOM_PICKUP_TIME, itinerary: [], inclusions: [], exclusions: [], priceBasis: 'quote' }
  return { ...agreedFrom(s, rentalTime || s.pickupTime), ...(b.label ? { title: b.label } : {}), ...(b.rental ? { pickup: b.rental.pickup } : {}) }
}
