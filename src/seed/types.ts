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

/** Where a bundled photo came from, for attribution. */
export interface PhotoCredit {
  title: string
  author: string
  license: string
  licenseUrl?: string
  /** The file's page on Wikimedia Commons. */
  /** Page of the original; missing for photos supplied by the team whose source is still to be confirmed. */
  source?: string
}

/**
 * A bundled image. `photo` is a real photo of the place; `vehicle` is a representative photo of the van model,
 * not the agency's own van; `illustration` marks generated artwork; `supplied` marks images from the team's files.
 */
export interface ImageRef {
  src: string
  alt: string
  kind: 'photo' | 'vehicle' | 'supplied' | 'illustration'
  /** Responsive sources, smallest first. */
  srcset?: { w: number; src: string }[]
  /** Tiny blurred preview shown while the photo loads. */
  lqip?: string
  /** CSS object-position, so crops keep the subject. */
  focus?: string
  credit?: PhotoCredit
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
  /** Deactivated packages stay on past bookings but take no new departures. */
  inactive?: boolean
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
  completedAt?: string
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
  /** Maintenance record this block belongs to (admin maintenance schedule). */
  ref?: string
  /** Maintenance keeps the van out of service past its end date until staff confirm the work is done. */
  untilDone?: boolean
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
  color?: string
  odometer?: number
}

export interface Driver {
  id: string
  name: string
  mobile: string
  blocks: Block[]
  license?: string
  licenseExpiry?: string
  since?: string
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
  /** Set on customer notifications: who receives it. Staff notifications have none. */
  customerId?: string
  /** Staff notifications about a customer's activity, so that customer's records can be cleared with it. */
  about?: string
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
  /** Note from staff shown with the proposal. */
  note?: string
  /** Days the proposal stays open once sent (default PROPOSAL_VALID_DAYS). */
  validDays?: number
  /** Staff set firm dates for a request with flexible or undecided dates. */
  datesSet?: boolean
}

export type TripPace = 'Relaxed' | 'Balanced' | 'Packed'

export interface CustomRequest {
  id: string
  customerId: string
  /** Catalog destination, or '' when the customer typed a place we do not list yet (see destinationName). */
  destinationId: string
  /** The place as the customer typed it, when it is not in the catalog. */
  destinationName?: string
  /** How the plan was made: from the destination's suggested trip, or from scratch. */
  planMode?: 'suggested' | 'scratch'
  /** Stops in the order the customer wants them. Staff check feasibility and timing. */
  stops?: string[]
  pace?: TripPace
  startDate: string
  endDate: string
  flexibility: 'Exact dates' | '± 3 days' | 'Any weekend this month' | 'Flexible dates' | 'Dates to be decided'
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
  /** Plan made with the AI planner demo, sent as the starting point for staff. */
  plan?: PlannedTrip
}

/** A suggested itinerary from the AI planner demo, as the customer edited it. Staff confirm every part. */
export interface PlannedTrip {
  source: 'planner'
  /** True when the customer has not fixed dates; startDate and endDate are then placeholders. */
  datesTbd?: boolean
  /** Roughly when, for flexible dates (e.g. "Sometime in December"). */
  datesNote?: string
  days: number
  groupType: string
  children: number
  seniors: number
  budgetBasis: 'person' | 'group' | 'help'
  /** As the customer entered it, per person or for the group; absent when they asked us to estimate. */
  budgetAmount?: number
  pace: TripPace
  interests: string[]
  lodging: string
  mustVisit?: string
  accessibility?: string
  dietary?: string
  reasons: string[]
  itinerary: { day: number; date?: string; label: string; items: { time?: string; title: string; kind: string; note?: string; review?: string }[] }[]
  stops: { name: string; day: number; locked?: boolean; custom?: boolean }[]
  estimate: { group: 'shared' | 'person' | 'optional' | 'quote'; label: string; amount?: number; detail?: string; unitPrice?: number; qty?: number; unit?: string }[]
  total: number
  perPerson: number
  /** Conflicts the customer chose to leave for staff. */
  issues: string[]
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

/**
 * A public rating left by a traveller after a completed trip. Only customers with a completed TAMS AP trip
 * can write one, so every review is tied to a real trip (seeded reviews describe earlier departures).
 */
export interface Review {
  id: string
  serviceId: string
  /** Set when the reviewer is a customer in this dataset; seeded reviews from older trips only carry a name. */
  customerId?: string
  bookingId?: string
  /** Public display name, first name and last initial. */
  name: string
  city: string
  rating: 1 | 2 | 3 | 4 | 5
  title: string
  text: string
  /** Optional suggestion for the agency, shown separately so staff can act on it. */
  suggestion?: string
  /** Departure date of the trip being reviewed. */
  travelDate: string
  createdAt: string
  /** Who they travelled with, for context on the review card. */
  party?: 'Solo' | 'Couple' | 'Family' | 'Friends' | 'Officemates'
  staffReply?: { text: string; at: string }
  origin: Origin
}

/** One month of agency sales, used for the admin trend and forecast. */
export interface MonthlySales {
  /** 'YYYY-MM' */
  month: string
  /** Booking value of trips sold that month, whole pesos. */
  revenue: number
  bookings: number
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
  reviews: Review[]
  /** Monthly sales before the demo month (sample history for the forecast). */
  salesHistory: MonthlySales[]
  /** Next sequence numbers for records created during the demo. */
  next: { booking: number; payment: number; assignment: number; notification: number; customer: number; customRequest: number; rentalRequest: number; inquiry: number; review: number }
}
