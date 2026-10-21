// Shared record shapes for the seed and both simulations. Dates are 'YYYY-MM-DD' (Asia/Manila),
// timestamps are ISO strings with the +08:00 offset, money is whole pesos.

export type Origin = 'seed' | 'local'

export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Submitted' | 'Verified' | 'Rejected'
export type PaymentMethod = 'GCash' | 'Maya' | 'Bank transfer' | 'Cash'
export type PaymentType = 'Down payment' | 'Full' | 'Balance'
export type PaymentSummary = 'Unpaid' | 'Partially paid' | 'Fully paid'

/** Interest tags shared by destinations, tours, preferences and recommendations. */
export type Interest = 'Nature' | 'Beach' | 'Heritage' | 'Food' | 'Adventure' | 'Cool weather' | 'Family' | 'Relaxation' | 'Photography'
export const INTERESTS: Interest[] = ['Nature', 'Beach', 'Heritage', 'Food', 'Adventure', 'Cool weather', 'Family', 'Relaxation', 'Photography']

/** A bundled image. `illustration` marks generated artwork; `supplied` marks images from the team's design files. */
export interface ImageRef {
  src: string
  alt: string
  kind: 'supplied' | 'illustration'
}

export interface Destination {
  id: string
  name: string
  province: string
  summary: string
  overview: string
  highlights: string[]
  interests: Interest[]
  bestMonths: string
  /** Typical travel time from Metro Manila by van, for planning text. */
  travelTime: string
  /** Rough number of days a visit needs, used to suggest custom-trip lengths. */
  suggestedDays: number
  image: ImageRef
}

export interface Customer {
  id: string
  name: string
  email: string
  mobile: string
  city: string
  registered: string
  origin: Origin
}

export interface Service {
  id: string
  name: string
  /** `custom` is the internal service used for bookings created from accepted custom-trip proposals. */
  type: 'tour' | 'van' | 'custom'
  destination: string
  duration: string
  days: number
  price: number
  unit: 'person' | 'day'
  pickup: string
  pickupTime: string
  summary: string
  itinerary: string[]
  inclusions: string[]
  exclusions: string[]
  /** Two colours for the photo placeholder gradient. */
  tint: [string, string]
  /** Tours belong to a destination; van rental and custom trips do not. */
  destinationId?: string
  interests?: Interest[]
}

export interface Departure {
  id: string
  serviceId: string
  startDate: string
  endDate: string
  capacity: number
  promo?: { amountOff: number; bookBy: string; label: string }
}

export interface Booking {
  id: string
  customerId: string
  serviceId: string
  departureId?: string
  startDate: string
  endDate: string
  pax: number
  unitPrice: number
  promoOff: number
  total: number
  status: BookingStatus
  createdAt: string
  contactName: string
  contactMobile: string
  notes?: string
  rental?: { pickup: string; destination: string }
  cancelReason?: string
  cancelledAt?: string
  confirmedAt?: string
  cancellationRequested?: boolean
  scenario?: string
  /** Set when the booking was created by accepting a custom-trip proposal or a rental quote. */
  requestId?: string
  /** Display title for bookings that come from a request, e.g. "Banaue custom trip". */
  label?: string
  origin: Origin
}

export interface Payment {
  id: string
  bookingId: string
  amount: number
  method: PaymentMethod
  type: PaymentType
  status: PaymentStatus
  reference: string
  submittedAt: string
  reviewedAt?: string
  rejectReason?: string
  proof: 'sample' | 'uploaded' | 'none'
  scenario?: string
  origin: Origin
}

export interface Block {
  from: string
  to: string
  kind: 'maintenance' | 'unavailable' | 'leave'
  note: string
}

/** Customer-facing rental category. Requests ask for a category; staff assign the actual van later. */
export interface VehicleCategory {
  id: string
  name: string
  models: string
  seats: number
  luggage: string
  ratePerDay: number
  features: string[]
  image: ImageRef
}

export interface Vehicle {
  id: string
  categoryId: string
  name: string
  model: string
  plate: string
  seats: number
  blocks: Block[]
}

export interface Driver {
  id: string
  name: string
  mobile: string
  blocks: Block[]
}

export interface Assignment {
  id: string
  target: { kind: 'departure' | 'booking'; id: string }
  from: string
  to: string
  vehicleId: string
  driverId: string
  origin: Origin
}

export type NotificationCategory = 'Bookings' | 'Payments' | 'Travel' | 'Fleet' | 'Requests' | 'Messages'

export interface AppNotification {
  id: string
  at: string
  category: NotificationCategory
  title: string
  body: string
  link?: string
  read: boolean
  customerId?: string
  scenario?: string
  origin: Origin
}

export interface InquiryMessage {
  from: 'customer' | 'staff'
  at: string
  text: string
  simulated?: boolean
}

export type InquiryStatus = 'Awaiting staff' | 'Staff replied' | 'Resolved'

export interface Inquiry {
  id: string
  customerId: string
  subject: string
  status: InquiryStatus
  /** Booking or request reference the question is about. */
  relatedRef?: string
  /** Prepared reply the presenter can reveal with "Show sample staff reply". */
  sampleReply?: string
  messages: InquiryMessage[]
  origin?: Origin
}

// ---------- Custom trips and rental requests ----------

export type RequestStatus = 'Submitted' | 'Under review' | 'Proposal ready' | 'Accepted' | 'Closed'

export interface RequestEvent {
  at: string
  status: RequestStatus
  note: string
}

export interface PriceLine {
  label: string
  /** Price of one unit, e.g. per day or per person. */
  unitPrice: number
  qty: number
  unit: string
  amount: number
}

export interface Proposal {
  title: string
  startDate: string
  endDate: string
  groupSize: number
  itinerary: string[]
  inclusions: string[]
  exclusions: string[]
  lines: PriceLine[]
  total: number
  validUntil: string
  sentAt: string
}

export interface CustomRequest {
  id: string
  customerId: string
  destinationId: string
  startDate: string
  endDate: string
  flexibility: 'Exact dates' | '± 3 days' | 'Any weekend this month'
  groupSize: number
  pickup: string
  /** Budget per person, in pesos. */
  budgetMin: number
  budgetMax: number
  interests: Interest[]
  requests: string
  contactName: string
  contactMobile: string
  status: RequestStatus
  createdAt: string
  events: RequestEvent[]
  proposal?: Proposal
  /** Proposal staff have prepared but not sent yet (admin demo). */
  draftProposal?: Proposal
  bookingId?: string
  origin: Origin
}

export type RentalTripType = 'One-way' | 'Round trip (same day)' | 'Multi-day'

export interface RentalEstimate {
  lines: PriceLine[]
  total: number
  serviceDays: number
  notes: string[]
}

export interface RentalRequest {
  id: string
  customerId: string
  categoryId: string
  tripType: RentalTripType
  pickupArea: string
  pickup: string
  dropoff: string
  destinationArea: string
  stops: string[]
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  passengers: number
  requests: string
  contactName: string
  contactMobile: string
  estimate: RentalEstimate
  quote?: RentalEstimate & { validUntil: string; sentAt: string; note: string }
  status: RequestStatus
  createdAt: string
  events: RequestEvent[]
  bookingId?: string
  origin: Origin
}

export interface TravelPreferences {
  interests: Interest[]
  /** Budget ceiling per person for tours, in pesos. 0 means no preference. */
  budgetMax: number
  duration: 'Any' | 'Day trip' | 'Weekend (2–3 days)' | 'Longer (4+ days)'
  style: 'Any' | 'Joiner tour' | 'Private or custom'
}

export interface SavedItem {
  kind: 'tour' | 'destination'
  id: string
}

export interface ApprovedReply {
  id: string
  title: string
  text: string
}

export interface Dataset {
  customers: Customer[]
  destinations: Destination[]
  services: Service[]
  vehicleCategories: VehicleCategory[]
  customRequests: CustomRequest[]
  rentalRequests: RentalRequest[]
  /** Seeded per-customer preferences and saved items (customer demo starting state). */
  preferences: Record<string, TravelPreferences>
  saved: Record<string, SavedItem[]>
  departures: Departure[]
  bookings: Booking[]
  payments: Payment[]
  vehicles: Vehicle[]
  drivers: Driver[]
  assignments: Assignment[]
  notifications: AppNotification[]
  inquiries: Inquiry[]
  replies: ApprovedReply[]
  /** Next sequence numbers for records created during the demo. */
  next: { booking: number; payment: number; assignment: number; notification: number; customer: number; customRequest: number; rentalRequest: number; inquiry: number }
}
