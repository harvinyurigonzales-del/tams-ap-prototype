import { create } from 'zustand'
import { DEMO_TODAY, dateOf, demoNowStamp } from '../lib/demoClock'
import { peso } from '../lib/format'
import { departureAvailability, payableOptions, rentalTotal, tourTotal, VAN_RENTAL_MAX_PAX } from '../domain/rules'
import { customerSeed } from '../seed/derive'
import type { Booking, Customer, Dataset, Payment, PaymentMethod, PaymentType } from '../seed/types'
import { nextId } from './ids'

// Customer simulation: its own in-memory working copy of the seed. Nothing is persisted and nothing is
// shared with the admin simulation.

export interface Account {
  email: string
  password: string
  customerId: string
}

export const DEMO_CUSTOMER = { email: 'maria.santos@example.com', password: 'Maria2026!' }

type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string }

export interface NewBooking {
  serviceId: string
  departureId?: string
  pax: number
  contactName: string
  contactMobile: string
  notes?: string
  rental?: { startDate: string; endDate: string; pickup: string; destination: string }
}

export interface NewPayment {
  bookingId: string
  method: PaymentMethod
  type: PaymentType
  reference: string
  proof: Payment['proof']
}

interface CustomerState {
  data: Dataset
  accounts: Account[]
  customerId: string | null
  login: (email: string, password: string) => Result
  logout: () => void
  signup: (input: { name: string; email: string; mobile: string; password: string }) => Result
  updateProfile: (input: { name: string; mobile: string }) => Result
  createBooking: (input: NewBooking) => Result<Booking>
  submitPayment: (input: NewPayment) => Result<Payment>
  requestCancellation: (bookingId: string) => Result
  markAllRead: () => void
  reset: () => void
}

const initial = () => ({
  data: customerSeed(),
  accounts: [{ ...DEMO_CUSTOMER, customerId: 'CUS-0001' }],
  customerId: null as string | null,
})

export const useCustomer = create<CustomerState>((set, get) => ({
  ...initial(),

  login: (email, password) => {
    const acct = get().accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
    if (!acct || acct.password !== password) return { ok: false, error: 'Email or password is incorrect.' }
    set({ customerId: acct.customerId })
    return { ok: true, value: undefined }
  },

  logout: () => set({ customerId: null }),

  signup: ({ name, email, mobile, password }) => {
    const s = get()
    const taken = s.accounts.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())
      || s.data.customers.some((c) => c.email.toLowerCase() === email.trim().toLowerCase())
    if (taken) return { ok: false, error: 'An account with this email already exists in this demo. Log in instead.' }
    const data = structuredClone(s.data)
    const customer: Customer = { id: nextId(data, 'customer'), name: name.trim(), email: email.trim(), mobile: mobile.trim(), city: '', registered: DEMO_TODAY, origin: 'local' }
    data.customers.push(customer)
    set({ data, accounts: [...s.accounts, { email: customer.email, password, customerId: customer.id }], customerId: customer.id })
    return { ok: true, value: undefined }
  },

  updateProfile: ({ name, mobile }) => {
    const s = get()
    if (!s.customerId) return { ok: false, error: 'Please log in again.' }
    const data = structuredClone(s.data)
    const c = data.customers.find((x) => x.id === s.customerId)!
    c.name = name.trim()
    c.mobile = mobile.trim()
    set({ data })
    return { ok: true, value: undefined }
  },

  createBooking: (input) => {
    const s = get()
    if (!s.customerId) return { ok: false, error: 'Please log in to book.' }
    const data = structuredClone(s.data)
    const service = data.services.find((x) => x.id === input.serviceId)
    if (!service) return { ok: false, error: 'This service is no longer available.' }
    const createdAt = demoNowStamp()
    let booking: Booking
    if (service.type === 'tour') {
      const dep = data.departures.find((x) => x.id === input.departureId)
      if (!dep) return { ok: false, error: 'Please choose a departure date.' }
      const avail = departureAvailability(dep, data.bookings)
      if (avail.state === 'full') return { ok: false, error: 'This departure is full. Please choose another date.' }
      if (avail.state !== 'open') return { ok: false, error: 'Online booking for this date is closed.' }
      if (input.pax < 1 || input.pax > avail.left) return { ok: false, error: `Only ${avail.left} seats left on this date.` }
      const price = tourTotal(service, dep, input.pax, dateOf(createdAt))
      booking = {
        id: nextId(data, 'booking'), customerId: s.customerId, serviceId: service.id, departureId: dep.id,
        startDate: dep.startDate, endDate: dep.endDate, pax: input.pax, ...price, status: 'Pending', createdAt,
        contactName: input.contactName.trim(), contactMobile: input.contactMobile.trim(), notes: input.notes?.trim() || undefined, origin: 'local',
      }
    } else {
      const r = input.rental
      if (!r) return { ok: false, error: 'Please enter the rental dates.' }
      if (input.pax < 1 || input.pax > VAN_RENTAL_MAX_PAX) return { ok: false, error: `A van seats up to ${VAN_RENTAL_MAX_PAX} passengers.` }
      booking = {
        id: nextId(data, 'booking'), customerId: s.customerId, serviceId: service.id, startDate: r.startDate, endDate: r.endDate,
        pax: input.pax, unitPrice: service.price, promoOff: 0, total: rentalTotal(service, r.startDate, r.endDate), status: 'Pending', createdAt,
        contactName: input.contactName.trim(), contactMobile: input.contactMobile.trim(), notes: input.notes?.trim() || undefined,
        rental: { pickup: r.pickup.trim(), destination: r.destination.trim() }, origin: 'local',
      }
    }
    data.bookings.push(booking)
    data.notifications.unshift({
      id: nextId(data, 'notification'), at: createdAt, category: 'Bookings', title: 'Booking received',
      body: `${booking.id} · ${service.name}. Send your payment to keep your seats.`, link: `/app/trips/${booking.id}`, read: false, customerId: s.customerId, origin: 'local',
    })
    set({ data })
    return { ok: true, value: booking }
  },

  submitPayment: (input) => {
    const s = get()
    const data = structuredClone(s.data)
    const b = data.bookings.find((x) => x.id === input.bookingId && x.customerId === s.customerId)
    if (!b) return { ok: false, error: 'Booking not found.' }
    const option = payableOptions(b, data.payments).find((o) => o.type === input.type)
    if (!option) return { ok: false, error: 'This booking has no payment due right now.' }
    const at = demoNowStamp()
    const payment: Payment = {
      id: nextId(data, 'payment'), bookingId: b.id, amount: option.amount, method: input.method, type: input.type, status: 'Submitted',
      reference: input.reference.trim(), submittedAt: at, proof: input.proof, origin: 'local',
    }
    data.payments.push(payment)
    data.notifications.unshift({
      id: nextId(data, 'notification'), at, category: 'Payments', title: 'Payment submitted',
      body: `${peso(payment.amount)} via ${payment.method} for ${b.id}. We’ll confirm once it’s verified.`, link: `/app/trips/${b.id}`, read: false, customerId: s.customerId!, origin: 'local',
    })
    set({ data })
    return { ok: true, value: payment }
  },

  requestCancellation: (bookingId) => {
    const s = get()
    const data = structuredClone(s.data)
    const b = data.bookings.find((x) => x.id === bookingId && x.customerId === s.customerId)
    if (!b || (b.status !== 'Pending' && b.status !== 'Confirmed')) return { ok: false, error: 'This booking can no longer be cancelled.' }
    b.cancellationRequested = true
    set({ data })
    return { ok: true, value: undefined }
  },

  markAllRead: () => {
    const data = structuredClone(get().data)
    data.notifications.forEach((n) => (n.read = true))
    set({ data })
  },

  reset: () => set(initial()),
}))

export const useMe = () => {
  const { data, customerId } = useCustomer()
  return customerId ? data.customers.find((c) => c.id === customerId) ?? null : null
}
