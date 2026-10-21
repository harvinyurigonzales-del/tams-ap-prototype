// Shared record shapes for the seed and both simulations. Dates are 'YYYY-MM-DD' (Asia/Manila),
// timestamps are ISO strings with the +08:00 offset, money is whole pesos.

export type Origin = 'seed' | 'local'

export type BookingStatus = 'Pending' | 'Confirmed' | 'Completed' | 'Cancelled'
export type PaymentStatus = 'Submitted' | 'Verified' | 'Rejected'
export type PaymentMethod = 'GCash' | 'Maya' | 'Bank transfer' | 'Cash'
export type PaymentType = 'Down payment' | 'Full' | 'Balance'
export type PaymentSummary = 'Unpaid' | 'Partially paid' | 'Fully paid'

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
  type: 'tour' | 'van'
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

export interface Vehicle {
  id: string
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

export type NotificationCategory = 'Bookings' | 'Payments' | 'Travel' | 'Fleet'

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

export interface Inquiry {
  id: string
  customerId: string
  subject: string
  messages: InquiryMessage[]
}

export interface ApprovedReply {
  id: string
  title: string
  text: string
}

export interface Dataset {
  customers: Customer[]
  services: Service[]
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
  next: { booking: number; payment: number; assignment: number; notification: number; customer: number }
}
