import { create } from 'zustand'
import { addDays, DEMO_TODAY, dateOf, demoNowStamp } from '../lib/demoClock'
import { peso } from '../lib/format'
import type { AssistantAnswer } from '../domain/assistant'
import { recKey, type RecKind } from '../domain/recommend'
import {
  canTransition, draftCustomProposal, PROPOSAL_VALID_DAYS, proposalExpired, rentalEndDate, rentalEstimate, requestDestination, validateCustom, validateRental,
  type CustomInput, type RentalInput,
} from '../domain/requests'
import { assignableTargets, canConfirm, departureAvailability, driverConflict, money, payableOptions, shortRange, tourTotal, vehicleConflict } from '../domain/rules'
import { publicName, reviewableTrips, validateReview } from '../domain/reviews'
import { INTERESTS } from '../seed/types'
import type {
  AppNotification, Booking, CustomRequest, Customer, Dataset, Inquiry, Interest, Payment, PaymentMethod, PaymentType, RentalRequest,
  RentalTripType, RequestStatus, Review, SavedItem, TravelPreferences, TripPace,
} from '../seed/types'
import { nextId } from './ids'
import { freshState, markSignedOut, readSession, startingState, writeSession, type CustomerAccount } from './persist'
import { budgetOf, firstInvalid, pickupLabel, requestDates, toPlannedTrip, type PlannerAnswers, type TripPlan } from '../domain/planner/engine'

// Customer site state. The business records (`data`) are the saved records the staff portal also uses
// (see persist.ts and sync.ts), so staff see what customers do and customers see staff updates.

export type Account = CustomerAccount

export const DEMO_CUSTOMER = { email: 'maria.santos@example.com', password: 'Maria2026!' }
/** Second demo account: a new customer with no trips, preferences or saved items. */
export const NEW_CUSTOMER = { email: 'paolo.rivera@example.com', password: 'Paolo2026!' }

type Result<T = undefined> = { ok: true; value: T } | { ok: false; error: string }

export interface NewBooking {
  serviceId: string
  departureId?: string
  pax: number
  contactName: string
  contactMobile: string
  notes?: string
}

/** A stop in the trip planner. Suggested stops can be switched off without losing their place. */
export interface PlanStop {
  name: string
  on: boolean
  /** Added by the customer rather than taken from the suggested trip. */
  own?: boolean
}

/** The stops a plan sends: chosen suggested stops and own stops, or only own stops when building from scratch. */
export const planStops = (f: Pick<CustomForm, 'plan' | 'planMode'>) =>
  f.plan.filter((x) => x.on && x.name.trim() && (f.planMode === 'suggested' || x.own)).map((x) => x.name.trim())

export interface CustomForm extends CustomInput {
  flexibility: CustomRequest['flexibility']
  interests: Interest[]
  requests: string
  pickupCity: string
  pickupLandmark: string
  planMode: 'suggested' | 'scratch'
  plan: PlanStop[]
  /** The destination the suggested stops were taken from, so changing destination offers a fresh template. */
  planFor?: string
  pace: TripPace
}

export interface PlannedTripInput {
  answers: PlannerAnswers
  plan: TripPlan
  contactName: string
  contactMobile: string
}

/** Planner interests that are also catalog interests; Mountains maps to cool weather. */
const plannerInterests = (xs: string[]): Interest[] =>
  [...new Set(xs.map((x) => (x === 'Mountains' ? 'Cool weather' : x)).filter((x): x is Interest => (INTERESTS as string[]).includes(x)))]

export interface RentalForm extends RentalInput {
  stops: string[]
  requests: string
  contactName: string
  contactMobile: string
}

export interface ChatEntry {
  id: number
  from: 'customer' | 'assistant'
  text: string
  answer?: AssistantAnswer
  /** An answer that failed; `question` is kept so the customer can retry it. */
  error?: boolean
  question?: string
}

export const EMPTY_PREFS: TravelPreferences = { interests: [], budgetMax: 0, duration: 'Any', style: 'Any' }

export interface NewReview {
  bookingId: string
  /** The only required field: 1 to 5 stars. */
  rating: number
  title?: string
  text?: string
  suggestion?: string
  party?: Review['party']
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
  /** Signs a customer in and applies a save they asked for as a guest. */
  startSession: (customerId: string) => void
  logout: () => void
  signup: (input: { name: string; email: string; mobile: string; password: string }) => Result
  /** Signs in with a Google profile from Google Identity Services, creating the demo account on first use. */
  googleSignIn: (profile: { email: string; name: string; sub: string }) => Result
  updateProfile: (input: { name: string; mobile: string }) => Result
  createBooking: (input: NewBooking) => Result<Booking>
  submitPayment: (input: NewPayment) => Result<Payment>
  requestCancellation: (bookingId: string) => Result
  markAllRead: () => void
  markRead: (id: string) => void
  // Personalisation (session only)
  viewed: string[]
  dismissed: string[]
  pendingSave: SavedItem | null
  toggleSaved: (item: SavedItem) => Result<boolean>
  setPendingSave: (item: SavedItem | null) => void
  setPreferences: (p: TravelPreferences) => Result
  markViewed: (kind: RecKind, id: string) => void
  dismiss: (kind: RecKind, id: string) => void
  undoDismiss: (kind: RecKind, id: string) => void
  // Requests
  drafts: { custom?: CustomForm; rental?: RentalForm }
  saveDraft: (kind: 'custom' | 'rental', form: CustomForm | RentalForm | undefined) => void
  submitCustom: (f: CustomForm) => Result<CustomRequest>
  /** Sends a plan from the AI planner into the custom-request workflow. */
  submitPlannedTrip: (input: PlannedTripInput) => Result<CustomRequest>
  submitRental: (f: RentalForm) => Result<RentalRequest>
  acceptProposal: (requestId: string) => Result<Booking>
  acceptQuote: (requestId: string) => Result<Booking>
  requestChanges: (kind: 'custom' | 'rental', requestId: string, text: string) => Result
  withdrawRequest: (kind: 'custom' | 'rental', requestId: string) => Result
  simulateStaffUpdate: (kind: 'custom' | 'rental', requestId: string) => Result<RequestStatus>
  simulateBookingStep: (bookingId: string, step: StaffStep) => Result<string>
  // Messages and assistant
  chat: ChatEntry[]
  addChat: (entry: Omit<ChatEntry, 'id'>) => void
  clearChat: () => void
  removeChat: (id: number) => void
  escalate: (input: { subject: string; text: string; relatedRef?: string }) => Result<Inquiry>
  sendMessage: (inquiryId: string, text: string) => Result
  resolveInquiry: (inquiryId: string) => Result
  showSampleReply: (inquiryId: string) => Result
  // Ratings
  submitReview: (input: NewReview) => Result<Review>
  // Pre-travel checklist (session only)
  checklist: Record<string, string[]>
  toggleChecklist: (bookingId: string, itemId: string) => void
  reset: () => void
}

/** Everything that belongs to one signed-in session. Cleared on login, logout and reset. */
const sessionState = () => ({
  viewed: [] as string[],
  dismissed: [] as string[],
  chat: [] as ChatEntry[],
  checklist: {} as Record<string, string[]>,
})

const SEED_ACCOUNTS: Account[] = [
  { ...DEMO_CUSTOMER, customerId: 'CUS-0001' },
  { ...NEW_CUSTOMER, customerId: 'CUS-0011' },
]

const initial = (fresh = false) => {
  const s = fresh ? freshState() : startingState()
  const accounts = s.customerAccounts ?? structuredClone(SEED_ACCOUNTS)
  const id = fresh ? null : readSession().customerId
  return {
    data: s.data,
    accounts,
    customerId: id && accounts.some((a) => a.customerId === id) ? id : null,
  pendingSave: null as SavedItem | null,
    drafts: {} as { custom?: CustomForm; rental?: RentalForm },
    ...sessionState(),
  }
}

const ok = <T,>(value: T) => ({ ok: true as const, value })
const fail = (error: string) => ({ ok: false as const, error })

/** Staff steps the presenter can play on a booking. */
export type StaffStep = 'verify' | 'reject' | 'confirm' | 'assign' | 'remind' | 'approveCancel' | 'declineCancel' | 'complete'

export const STEP_LABEL: Record<StaffStep, string> = {
  verify: 'Staff verify the payment',
  reject: 'Staff reject the payment',
  confirm: 'Staff confirm the booking',
  assign: 'Staff assign a van and driver',
  remind: 'Send the trip reminder',
  approveCancel: 'Staff approve the cancellation',
  declineCancel: 'Staff decline the cancellation',
  complete: 'Mark the trip completed',
}
const STEP_DONE: Record<StaffStep, string> = {
  verify: 'Payment verified.', reject: 'Payment rejected.', confirm: 'Booking confirmed.', assign: 'Van and driver assigned.', remind: 'Reminder sent.',
  approveCancel: 'Booking cancelled.', declineCancel: 'Cancellation declined.', complete: 'Trip marked completed.',
}

/** The staff steps that make sense for a booking right now, in the order the journey goes. */
export function staffSteps(d: Dataset, b: Booking): StaffStep[] {
  if (b.status === 'Cancelled' || b.status === 'Completed') return []
  const out: StaffStep[] = []
  if (d.payments.some((p) => p.bookingId === b.id && p.status === 'Submitted')) out.push('verify', 'reject')
  if (b.cancellationRequested) out.push('approveCancel', 'declineCancel')
  if (b.status === 'Pending' && canConfirm(b, d.payments).ok) out.push('confirm')
  if (b.status === 'Confirmed') {
    const t = assignableTargets(d).find((x) => (b.departureId ? x.kind === 'departure' && x.id === b.departureId : x.kind === 'booking' && x.id === b.id))
    if (t && !t.assignment) out.push('assign')
    if (t?.assignment) out.push('remind')
    if (money(b, d.payments).balance === 0 && !b.cancellationRequested) out.push('complete')
  }
  return out
}

function notify(d: Dataset, customerId: string, n: Omit<AppNotification, 'id' | 'read' | 'customerId' | 'origin'>) {
  d.notifications.unshift({ id: nextId(d, 'notification'), read: false, customerId, origin: 'local', ...n })
}

/** Alerts staff in the admin portal about something a customer did. */
function alertStaff(d: Dataset, customerId: string, n: Omit<AppNotification, 'id' | 'read' | 'customerId' | 'about' | 'origin'>) {
  d.notifications.unshift({ id: nextId(d, 'notification'), read: false, about: customerId, origin: 'local', ...n })
}

const nameOf = (d: Dataset, customerId: string) => d.customers.find((c) => c.id === customerId)?.name ?? customerId

const sameItem = (a: SavedItem, b: SavedItem) => a.kind === b.kind && a.id === b.id

function applySave(d: Dataset, customerId: string, item: SavedItem) {
  const list = d.saved[customerId] ?? []
  const exists = list.some((x) => sameItem(x, item))
  d.saved = { ...d.saved, [customerId]: exists ? list.filter((x) => !sameItem(x, item)) : [item, ...list] }
  return !exists
}

export const useCustomer = create<CustomerState>((set, get) => ({
  ...initial(),

  startSession: (customerId) => {
    const s = get()
    const data = structuredClone(s.data)
    if (s.pendingSave) {
      const list = data.saved[customerId] ?? []
      if (!list.some((x) => sameItem(x, s.pendingSave!))) applySave(data, customerId, s.pendingSave)
    }
    // Guest views and the guest's chat carry over so "Continue planning" still makes sense right after logging in.
    set({ data, customerId, pendingSave: null, ...sessionState(), viewed: s.customerId ? [] : s.viewed, chat: s.customerId ? [] : s.chat })
    writeSession({ customerId })
  },

  login: (email, password) => {
    const acct = get().accounts.find((a) => a.email.toLowerCase() === email.trim().toLowerCase())
    if (!acct || !acct.password || acct.password !== password) return { ok: false, error: 'Email or password is incorrect.' }
    get().startSession(acct.customerId)
    return { ok: true, value: undefined }
  },

  logout: () => {
    markSignedOut()
    set({ customerId: null, drafts: {}, pendingSave: null, ...sessionState() })
    writeSession({ customerId: null })
  },

  signup: ({ name, email, mobile, password }) => {
    const s = get()
    const taken = s.accounts.some((a) => a.email.toLowerCase() === email.trim().toLowerCase())
      || s.data.customers.some((c) => c.email.toLowerCase() === email.trim().toLowerCase())
    if (taken) return { ok: false, error: 'An account with this email already exists. Log in instead.' }
    const data = structuredClone(s.data)
    const customer: Customer = { id: nextId(data, 'customer'), name: name.trim(), email: email.trim(), mobile: mobile.trim(), city: '', registered: DEMO_TODAY, origin: 'local' }
    data.customers.push(customer)
    set({ data, accounts: [...s.accounts, { email: customer.email, password, customerId: customer.id }] })
    get().startSession(customer.id)
    return { ok: true, value: undefined }
  },

  googleSignIn: ({ email, name, sub }) => {
    const s = get()
    const existing = s.accounts.find((a) => a.email.toLowerCase() === email.toLowerCase())
    if (existing) {
      get().startSession(existing.customerId)
      return { ok: true, value: undefined }
    }
    const data = structuredClone(s.data)
    const customer: Customer = { id: nextId(data, 'customer'), name: name.trim() || email, email, mobile: '', city: '', registered: DEMO_TODAY, origin: 'local' }
    data.customers.push(customer)
    // No password: this account can only sign in through Google.
    set({ data, accounts: [...s.accounts, { email, password: '', customerId: customer.id, googleSub: sub }] })
    get().startSession(customer.id)
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
    if (service.type !== 'tour') return { ok: false, error: 'Van rentals and custom trips start with a request.' }
    const dep = data.departures.find((x) => x.id === input.departureId)
    if (!dep) return { ok: false, error: 'Please choose a departure date.' }
    const avail = departureAvailability(dep, data.bookings)
    if (avail.state === 'full') return { ok: false, error: 'This departure is full. Please choose another date.' }
    if (avail.state !== 'open') return { ok: false, error: 'Online booking for this date is closed.' }
    if (input.pax < 1 || input.pax > avail.left) return { ok: false, error: `Only ${avail.left} seats left on this date.` }
    const price = tourTotal(service, dep, input.pax, dateOf(createdAt))
    const booking: Booking = {
      id: nextId(data, 'booking'), customerId: s.customerId, serviceId: service.id, departureId: dep.id,
      startDate: dep.startDate, endDate: dep.endDate, pax: input.pax, ...price, status: 'Pending', createdAt,
      contactName: input.contactName.trim(), contactMobile: input.contactMobile.trim(), notes: input.notes?.trim() || undefined, origin: 'local',
    }
    data.bookings.push(booking)
    data.notifications.unshift({
      id: nextId(data, 'notification'), at: createdAt, category: 'Bookings', title: 'Booking received',
      body: `${booking.id} · ${service.name}. Send your payment to keep your seats.`, link: `/app/trips/${booking.id}`, read: false, customerId: s.customerId, origin: 'local',
    })
    alertStaff(data, s.customerId, { at: createdAt, category: 'Bookings', title: 'New booking request', body: `${booking.id} (${nameOf(data, s.customerId)}) · ${service.name}, ${shortRange(booking.startDate, booking.endDate)}, ${booking.pax} pax.`, link: `/admin/bookings?id=${booking.id}` })
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
    alertStaff(data, b.customerId, { at, category: 'Payments', title: 'Payment needs verification', body: `${b.id} (${nameOf(data, b.customerId)}) submitted ${peso(payment.amount)} via ${payment.method}.`, link: `/admin/bookings?id=${b.id}` })
    set({ data })
    return { ok: true, value: payment }
  },

  requestCancellation: (bookingId) => {
    const s = get()
    const data = structuredClone(s.data)
    const b = data.bookings.find((x) => x.id === bookingId && x.customerId === s.customerId)
    if (!b || (b.status !== 'Pending' && b.status !== 'Confirmed')) return { ok: false, error: 'This booking can no longer be cancelled.' }
    b.cancellationRequested = true
    const at = demoNowStamp()
    notify(data, b.customerId, { at, category: 'Bookings', title: 'Cancellation requested', body: `${b.id}: staff will review your request and contact you about any refund.`, link: `/app/trips/${b.id}` })
    alertStaff(data, b.customerId, { at, category: 'Bookings', title: 'Cancellation requested', body: `${b.id} (${nameOf(data, b.customerId)}) asked to cancel.`, link: `/admin/bookings?id=${b.id}` })
    set({ data })
    return { ok: true, value: undefined }
  },

  markAllRead: () => {
    const s = get()
    if (!s.customerId || !s.data.notifications.some((n) => n.customerId === s.customerId && !n.read)) return
    const data = structuredClone(s.data)
    data.notifications.forEach((n) => {
      if (n.customerId === s.customerId) n.read = true
    })
    set({ data })
  },

  markRead: (id) => {
    const s = get()
    const target = s.data.notifications.find((x) => x.id === id && x.customerId === s.customerId)
    if (!target || target.read) return
    const data = structuredClone(s.data)
    data.notifications.find((x) => x.id === id)!.read = true
    set({ data })
  },

  // ---------- Personalisation ----------

  toggleSaved: (item) => {
    const s = get()
    if (!s.customerId) return fail('Log in to save trips and destinations.')
    const data = structuredClone(s.data)
    const added = applySave(data, s.customerId, item)
    set({ data })
    return ok(added)
  },

  setPendingSave: (item) => set({ pendingSave: item }),

  setPreferences: (p) => {
    const s = get()
    if (!s.customerId) return fail('Log in to set travel preferences.')
    if (p.budgetMax < 0 || !Number.isFinite(p.budgetMax)) return fail('Enter a budget in pesos, or 0 for no limit.')
    const data = structuredClone(s.data)
    data.preferences = { ...data.preferences, [s.customerId]: { ...p, interests: [...p.interests] } }
    set({ data })
    return ok(undefined)
  },

  markViewed: (kind, id) => {
    const key = recKey(kind, id)
    const viewed = get().viewed
    if (viewed[0] === key) return
    set({ viewed: [key, ...viewed.filter((k) => k !== key)].slice(0, 8) })
  },

  dismiss: (kind, id) => set({ dismissed: [...new Set([...get().dismissed, recKey(kind, id)])] }),
  undoDismiss: (kind, id) => set({ dismissed: get().dismissed.filter((k) => k !== recKey(kind, id)) }),

  // ---------- Custom trips and van rental requests ----------

  saveDraft: (kind, form) => set({ drafts: { ...get().drafts, [kind]: form } }),

  submitCustom: (f) => {
    const s = get()
    if (!s.customerId) return fail('Please log in to send your request.')
    const errors = validateCustom(f)
    if (Object.keys(errors).length) return fail(Object.values(errors)[0])
    const data = structuredClone(s.data)
    const dest = requestDestination(data, f)
    const at = demoNowStamp()
    const r: CustomRequest = {
      id: nextId(data, 'customRequest'), customerId: s.customerId, destinationId: dest.id, destinationName: dest.id ? undefined : dest.name, startDate: f.startDate, endDate: f.endDate,
      flexibility: f.flexibility, groupSize: f.groupSize, pickup: f.pickup.trim(), budgetMin: f.budgetMin, budgetMax: f.budgetMax,
      interests: [...f.interests], requests: f.requests.trim(), contactName: f.contactName.trim(), contactMobile: f.contactMobile.trim(),
      planMode: f.planMode, stops: planStops(f), pace: f.pace,
      status: 'Submitted', createdAt: at, events: [{ at, status: 'Submitted', note: 'Request received. Staff will review it and prepare a proposal.' }], origin: 'local',
    }
    data.customRequests.push(r)
    notify(data, s.customerId, { at, category: 'Requests', title: 'Custom trip request sent', body: `${r.id} · ${dest.name}. We’ll let you know when your proposal is ready.`, link: `/app/custom/${r.id}` })
    alertStaff(data, s.customerId, { at, category: 'Requests', title: 'New custom trip request', body: `${r.id} (${nameOf(data, s.customerId)}) · ${dest.name}, ${r.groupSize} pax.`, link: `/admin/requests?id=${r.id}` })
    set({ data, drafts: { ...s.drafts, custom: undefined } })
    return ok(r)
  },

  submitPlannedTrip: ({ answers: a, plan, contactName, contactMobile }) => {
    const s = get()
    if (!s.customerId) return fail('Please log in to send your request.')
    const bad = firstInvalid(a)
    if (bad) return fail('Some answers are missing. Go back and finish the questions first.')
    if (contactName.trim().length < 2) return fail('Enter a contact name.')
    if (!/^(09|\+639)\d{9}$/.test(contactMobile.replace(/[\s-]/g, ''))) return fail('Use the format 09XX XXX XXXX for the mobile number.')
    const data = structuredClone(s.data)
    const dest = requestDestination(data, { destinationId: plan.destinationId, destinationName: plan.destinationName })
    const trip = toPlannedTrip(plan, a)
    const { startDate, endDate } = requestDates(a)
    const b = budgetOf(a)
    const at = demoNowStamp()
    const notes = [a.prefs.notes.trim(), a.prefs.mustVisit.trim() && `Must visit: ${a.prefs.mustVisit.trim()}`, a.prefs.accessibility.trim() && `Accessibility: ${a.prefs.accessibility.trim()}`, a.prefs.dietary.trim() && `Dietary: ${a.prefs.dietary.trim()}`].filter(Boolean).join(' · ')
    const r: CustomRequest = {
      id: nextId(data, 'customRequest'), customerId: s.customerId, destinationId: dest.id, destinationName: dest.id ? undefined : dest.name, startDate, endDate,
      flexibility: a.dates.mode === 'exact' ? 'Exact dates' : a.dates.mode === 'flexible' ? 'Flexible dates' : 'Dates to be decided',
      groupSize: a.group.size, pickup: pickupLabel(a),
      // Budget per person, as the request form stores it. "Help me estimate" sends the estimate as the ceiling, never zero.
      budgetMin: 0, budgetMax: b ? b.perPerson : trip.perPerson,
      interests: plannerInterests(a.interests), requests: notes, contactName: contactName.trim(), contactMobile: contactMobile.trim(),
      planMode: 'suggested', stops: trip.stops.map((x) => x.name), pace: trip.pace, plan: trip,
      status: 'Submitted', createdAt: at, events: [{ at, status: 'Submitted', note: 'Trip request sent. TAMS-AP will review your plan and prepare a proposal.' }], origin: 'local',
    }
    data.customRequests.push(r)
    notify(data, s.customerId, { at, category: 'Requests', title: 'Trip request sent', body: `${r.id} · ${dest.name}. TAMS-AP will review your plan and prepare a proposal.`, link: `/app/custom/${r.id}` })
    alertStaff(data, s.customerId, { at, category: 'Requests', title: 'New trip plan request', body: `${r.id} (${nameOf(data, s.customerId)}) · ${dest.name}, ${r.groupSize} pax, from the Trip Planner.`, link: `/admin/requests?id=${r.id}` })
    set({ data })
    return ok(r)
  },

  submitRental: (f) => {
    const s = get()
    if (!s.customerId) return fail('Please log in to send your request.')
    const errors = validateRental(s.data, f)
    if (Object.keys(errors).length) return fail(Object.values(errors)[0])
    if (f.contactName.trim().length < 2) return fail('Enter a contact name.')
    const data = structuredClone(s.data)
    const cat = data.vehicleCategories.find((c) => c.id === f.categoryId)!
    const at = demoNowStamp()
    const endDate = rentalEndDate(f)
    const r: RentalRequest = {
      id: nextId(data, 'rentalRequest'), customerId: s.customerId, categoryId: cat.id, tripType: f.tripType as RentalTripType,
      pickupArea: f.pickupArea, pickup: f.pickup.trim(), dropoff: f.dropoff.trim(), destinationArea: f.destinationArea,
      stops: f.stops.map((x) => x.trim()).filter(Boolean), startDate: f.startDate, startTime: f.startTime, endDate,
      endTime: f.tripType === 'One-way' ? '' : f.endTime, passengers: f.passengers, requests: f.requests.trim(),
      contactName: f.contactName.trim(), contactMobile: f.contactMobile.trim(), estimate: rentalEstimate(cat, { ...f, endDate }),
      status: 'Submitted', createdAt: at, events: [{ at, status: 'Submitted', note: 'Request received. Staff will check the route and send a quote.' }], origin: 'local',
    }
    data.rentalRequests.push(r)
    notify(data, s.customerId, { at, category: 'Requests', title: 'Van rental request sent', body: `${r.id} · ${cat.name} to ${r.dropoff}. A request does not reserve a van yet.`, link: `/app/rentals/${r.id}` })
    alertStaff(data, s.customerId, { at, category: 'Requests', title: 'New van rental request', body: `${r.id} (${nameOf(data, s.customerId)}) · ${cat.name} to ${r.dropoff}.`, link: `/admin/requests?id=${r.id}` })
    set({ data, drafts: { ...s.drafts, rental: undefined } })
    return ok(r)
  },

  acceptProposal: (requestId) => {
    const s = get()
    const data = structuredClone(s.data)
    const r = data.customRequests.find((x) => x.id === requestId && x.customerId === s.customerId)
    if (!r) return fail('Request not found.')
    // Idempotent: accepting twice returns the booking created the first time.
    if (r.bookingId) {
      const existing = data.bookings.find((b) => b.id === r.bookingId)
      if (existing) return ok(existing)
    }
    if (r.status !== 'Proposal ready' || !r.proposal) return fail('There is no proposal to accept right now.')
    if (proposalExpired(r.proposal.validUntil)) return fail('This proposal has expired. Request changes to get an updated one.')
    const p = r.proposal
    const dest = requestDestination(data, r)
    const at = demoNowStamp()
    const booking: Booking = {
      id: nextId(data, 'booking'), customerId: r.customerId, serviceId: 'SVC-CUSTOM', startDate: p.startDate, endDate: p.endDate, pax: p.groupSize,
      unitPrice: p.total, promoOff: 0, total: p.total, status: 'Pending', createdAt: at, contactName: r.contactName, contactMobile: r.contactMobile,
      notes: r.requests || undefined, requestId: r.id, label: p.title, rental: { pickup: r.pickup, destination: dest.name }, origin: 'local',
    }
    data.bookings.push(booking)
    r.status = 'Accepted'
    r.bookingId = booking.id
    r.events.push({ at, status: 'Accepted', note: `Proposal accepted. Booking ${booking.id} created; pay the down payment to continue.` })
    notify(data, r.customerId, { at, category: 'Bookings', title: 'Proposal accepted', body: `${booking.id} · ${p.title}. Pay the down payment so staff can confirm it.`, link: `/app/trips/${booking.id}` })
    alertStaff(data, r.customerId, { at, category: 'Requests', title: 'Proposal accepted', body: `${r.id} (${nameOf(data, r.customerId)}) became booking ${booking.id}.`, link: `/admin/bookings?id=${booking.id}` })
    set({ data })
    return ok(booking)
  },

  acceptQuote: (requestId) => {
    const s = get()
    const data = structuredClone(s.data)
    const r = data.rentalRequests.find((x) => x.id === requestId && x.customerId === s.customerId)
    if (!r) return fail('Request not found.')
    if (r.bookingId) {
      const existing = data.bookings.find((b) => b.id === r.bookingId)
      if (existing) return ok(existing)
    }
    if (r.status !== 'Proposal ready' || !r.quote) return fail('There is no quote to accept right now.')
    if (proposalExpired(r.quote.validUntil)) return fail('This quote has expired. Request changes to get an updated one.')
    const cat = data.vehicleCategories.find((c) => c.id === r.categoryId)!
    const at = demoNowStamp()
    const booking: Booking = {
      id: nextId(data, 'booking'), customerId: r.customerId, serviceId: 'SVC-VAN', startDate: r.startDate, endDate: r.endDate, pax: r.passengers,
      unitPrice: cat.ratePerDay, promoOff: 0, total: r.quote.total, status: 'Pending', createdAt: at, contactName: r.contactName,
      contactMobile: r.contactMobile, notes: r.requests || undefined, rental: { pickup: r.pickup, destination: r.dropoff }, requestId: r.id,
      label: `${cat.name} to ${r.dropoff}`, origin: 'local',
    }
    data.bookings.push(booking)
    r.status = 'Accepted'
    r.bookingId = booking.id
    r.events.push({ at, status: 'Accepted', note: `Quote accepted. Booking ${booking.id} created; pay the down payment to continue.` })
    notify(data, r.customerId, { at, category: 'Bookings', title: 'Quote accepted', body: `${booking.id} · ${booking.label}. Pay the down payment so staff can confirm it.`, link: `/app/trips/${booking.id}` })
    alertStaff(data, r.customerId, { at, category: 'Requests', title: 'Quote accepted', body: `${r.id} (${nameOf(data, r.customerId)}) became booking ${booking.id}.`, link: `/admin/bookings?id=${booking.id}` })
    set({ data })
    return ok(booking)
  },

  requestChanges: (kind, requestId, text) => {
    const s = get()
    if (!text.trim()) return fail('Tell staff what you would like to change.')
    const data = structuredClone(s.data)
    const list: (CustomRequest | RentalRequest)[] = kind === 'custom' ? data.customRequests : data.rentalRequests
    const r = list.find((x) => x.id === requestId && x.customerId === s.customerId)
    if (!r || !canTransition(r.status, 'Under review') || r.status !== 'Proposal ready') return fail('Changes can be requested only while a proposal or quote is waiting for you.')
    const at = demoNowStamp()
    r.status = 'Under review'
    r.events.push({ at, status: 'Under review', note: `You asked for changes: “${text.trim()}”` })
    notify(data, r.customerId, { at, category: 'Requests', title: 'Changes requested', body: `${r.id}: staff will revise the ${kind === 'custom' ? 'proposal' : 'quote'} and send it again.`, link: kind === 'custom' ? `/app/custom/${r.id}` : `/app/rentals/${r.id}` })
    alertStaff(data, r.customerId, { at, category: 'Requests', title: 'Customer asked for changes', body: `${r.id} (${nameOf(data, r.customerId)}): “${text.trim()}”`, link: `/admin/requests?id=${r.id}` })
    set({ data })
    return ok(undefined)
  },

  withdrawRequest: (kind, requestId) => {
    const s = get()
    const data = structuredClone(s.data)
    const list: (CustomRequest | RentalRequest)[] = kind === 'custom' ? data.customRequests : data.rentalRequests
    const r = list.find((x) => x.id === requestId && x.customerId === s.customerId)
    if (!r || !canTransition(r.status, 'Closed')) return fail('This request can no longer be withdrawn.')
    r.status = 'Closed'
    const at = demoNowStamp()
    r.events.push({ at, status: 'Closed', note: 'Withdrawn by you.' })
    alertStaff(data, r.customerId, { at, category: 'Requests', title: 'Request withdrawn', body: `${r.id} (${nameOf(data, r.customerId)}) withdrew the request.`, link: `/admin/requests?id=${r.id}` })
    notify(data, r.customerId, { at, category: 'Requests', title: 'Request withdrawn', body: `${r.id} is closed. You can send a new request any time.`, link: kind === 'custom' ? `/app/custom/${r.id}` : `/app/rentals/${r.id}` })
    set({ data })
    return ok(undefined)
  },

  /** Demo control: plays the staff side one step forward (review, then proposal or quote). */
  simulateStaffUpdate: (kind, requestId) => {
    const s = get()
    const data = structuredClone(s.data)
    const at = demoNowStamp()
    if (kind === 'custom') {
      const r = data.customRequests.find((x) => x.id === requestId && x.customerId === s.customerId)
      if (!r) return fail('Request not found.')
      const dest = requestDestination(data, r)
      if (r.status === 'Submitted') {
        r.status = 'Under review'
        r.events.push({ at, status: 'Under review', note: `Staff are checking lodging and guides in ${dest.name}.` })
      } else if (r.status === 'Under review') {
        r.proposal = draftCustomProposal(r, dest, at)
        r.status = 'Proposal ready'
        r.events.push({ at, status: 'Proposal ready', note: 'Proposal sent. Review it and accept or request changes.' })
        notify(data, r.customerId, { at, category: 'Requests', title: 'Custom trip proposal ready', body: `${r.id}: your ${dest.name} proposal is ready to review.`, link: `/app/custom/${r.id}` })
      } else return fail('Nothing for staff to do on this request.')
      set({ data })
      return ok(r.status)
    }
    const r = data.rentalRequests.find((x) => x.id === requestId && x.customerId === s.customerId)
    if (!r) return fail('Request not found.')
    if (r.status === 'Submitted') {
      r.status = 'Under review'
      r.events.push({ at, status: 'Under review', note: 'Staff are checking the route and van availability.' })
    } else if (r.status === 'Under review') {
      r.quote = { ...r.estimate, note: 'Confirmed as estimated.', validUntil: addDays(at.slice(0, 10), PROPOSAL_VALID_DAYS), sentAt: at }
      r.status = 'Proposal ready'
      r.events.push({ at, status: 'Proposal ready', note: `Quote sent: ${peso(r.quote.total)}. Accept it to continue to payment.` })
      notify(data, r.customerId, { at, category: 'Requests', title: 'Van rental quote ready', body: `${r.id}: your quote is ${peso(r.quote.total)}.`, link: `/app/rentals/${r.id}` })
    } else return fail('Nothing for staff to do on this request.')
    set({ data })
    return ok(r.status)
  },

  /** Presenter shortcut: plays one staff step on a booking, with the notification the customer would get. */
  simulateBookingStep: (bookingId, step) => {
    const s = get()
    const data = structuredClone(s.data)
    const b = data.bookings.find((x) => x.id === bookingId && x.customerId === s.customerId)
    if (!b) return fail('Booking not found.')
    if (!staffSteps(data, b).includes(step)) return fail('That step is not available for this booking right now.')
    const svc = data.services.find((x) => x.id === b.serviceId)!
    const title = b.label ?? svc.name
    const at = demoNowStamp()
    const link = `/app/trips/${b.id}`
    const pending = data.payments.find((p) => p.bookingId === b.id && p.status === 'Submitted')
    switch (step) {
      case 'verify': {
        pending!.status = 'Verified'
        pending!.reviewedAt = at
        const m = money(b, data.payments)
        notify(data, b.customerId, { at, category: 'Payments', title: 'Payment verified', body: `${peso(pending!.amount)} for ${b.id}. ${m.balance > 0 ? `Balance ${peso(m.balance)}.` : 'Fully paid.'}`, link })
        break
      }
      case 'reject':
        pending!.status = 'Rejected'
        pending!.reviewedAt = at
        pending!.rejectReason = 'The reference number does not match the receipt. Please check it and send the proof again.'
        notify(data, b.customerId, { at, category: 'Payments', title: 'Payment needs a new proof', body: `${b.id}: ${pending!.rejectReason}`, link })
        break
      case 'confirm':
        b.status = 'Confirmed'
        b.confirmedAt = at
        notify(data, b.customerId, { at, category: 'Bookings', title: 'Booking confirmed', body: `${b.id} · ${title}, ${shortRange(b.startDate, b.endDate)}. Your seats are secured.`, link })
        break
      case 'assign': {
        const t = assignableTargets(data).find((x) => (b.departureId ? x.kind === 'departure' && x.id === b.departureId : x.kind === 'booking' && x.id === b.id))!
        const v = data.vehicles.find((x) => !vehicleConflict(data, x, t))
        const dr = data.drivers.find((x) => !driverConflict(data, x, t))
        if (!v || !dr) return fail('No van and driver are free on these dates.')
        data.assignments.push({ id: nextId(data, 'assignment'), target: { kind: t.kind, id: t.id }, from: t.from, to: t.to, vehicleId: v.id, driverId: dr.id, origin: 'local' })
        notify(data, b.customerId, { at, category: 'Travel', title: 'Van and driver assigned', body: `${title}: ${v.name} (${v.plate}) with ${dr.name}.`, link })
        break
      }
      case 'remind': {
        const m = money(b, data.payments)
        notify(data, b.customerId, {
          at, category: 'Travel', title: 'Trip reminder',
          body: `${title} on ${shortRange(b.startDate, b.endDate)}. Pickup ${b.rental ? b.rental.pickup : svc.pickup}.${m.balance > 0 ? ` Balance of ${peso(m.balance)} is due before the trip.` : ''}`, link,
        })
        break
      }
      case 'approveCancel':
        b.status = 'Cancelled'
        b.cancelledAt = at
        b.cancelReason = 'Cancelled at your request'
        b.cancellationRequested = false
        data.assignments = data.assignments.filter((a) => !(a.target.kind === 'booking' && a.target.id === b.id))
        notify(data, b.customerId, { at, category: 'Bookings', title: 'Booking cancelled', body: `${b.id} · ${title}. Staff will contact you about any refund.`, link })
        break
      case 'declineCancel':
        b.cancellationRequested = false
        notify(data, b.customerId, { at, category: 'Bookings', title: 'Cancellation not approved', body: `${b.id} stays booked. The trip is too close to change; message staff if you need help.`, link })
        break
      case 'complete':
        b.status = 'Completed'
        b.completedAt = at
        notify(data, b.customerId, { at, category: 'Bookings', title: 'Trip completed', body: `Thanks for travelling with us on ${title}! Rate your trip to help other travellers.`, link: `/app/reviews?trip=${b.id}` })
        break
    }
    set({ data })
    return ok(STEP_DONE[step])
  },

  // ---------- Assistant and messages ----------

  addChat: (entry) => {
    const chat = get().chat
    set({ chat: [...chat, { ...entry, id: (chat.at(-1)?.id ?? 0) + 1 }] })
  },
  clearChat: () => set({ chat: [] }),
  removeChat: (id) => set({ chat: get().chat.filter((m) => m.id !== id) }),

  escalate: ({ subject, text, relatedRef }) => {
    const s = get()
    if (!s.customerId) return fail('Please log in so staff can reply to you.')
    if (!subject.trim() || !text.trim()) return fail('Add a short subject and your question.')
    const data = structuredClone(s.data)
    if (relatedRef && !ownsRecord(data, s.customerId, relatedRef)) return fail('That reference is not in your account.')
    const at = demoNowStamp()
    const q: Inquiry = {
      id: nextId(data, 'inquiry'), customerId: s.customerId, subject: subject.trim(), status: 'Awaiting staff', relatedRef: relatedRef || undefined,
      messages: [{ from: 'customer', at, text: text.trim() }], origin: 'local',
    }
    data.inquiries.push(q)
    notify(data, s.customerId, { at, category: 'Messages', title: 'Question sent to staff', body: `${q.id} · ${q.subject}. Staff reply here and in Messages.`, link: `/app/messages/${q.id}` })
    alertStaff(data, s.customerId, { at, category: 'Messages', title: 'New question from a customer', body: `${q.id} (${nameOf(data, s.customerId)}) · ${q.subject}`, link: `/admin/inquiries?id=${q.id}` })
    set({ data })
    return ok(q)
  },

  sendMessage: (inquiryId, text) => {
    const s = get()
    if (!text.trim()) return fail('Write a message first.')
    const data = structuredClone(s.data)
    const q = data.inquiries.find((x) => x.id === inquiryId && x.customerId === s.customerId)
    if (!q) return fail('Conversation not found.')
    const at = demoNowStamp()
    q.messages.push({ from: 'customer', at, text: text.trim() })
    q.status = 'Awaiting staff'
    alertStaff(data, q.customerId, { at, category: 'Messages', title: 'New message', body: `${q.id} (${nameOf(data, q.customerId)}) · ${q.subject}`, link: `/admin/inquiries?id=${q.id}` })
    set({ data })
    return ok(undefined)
  },

  resolveInquiry: (inquiryId) => {
    const s = get()
    const data = structuredClone(s.data)
    const q = data.inquiries.find((x) => x.id === inquiryId && x.customerId === s.customerId)
    if (!q) return fail('Conversation not found.')
    q.status = 'Resolved'
    set({ data })
    return ok(undefined)
  },

  /** Demo control: shows the prepared staff reply. Clearly labelled as simulated; nothing is sent. */
  showSampleReply: (inquiryId) => {
    const s = get()
    const data = structuredClone(s.data)
    const q = data.inquiries.find((x) => x.id === inquiryId && x.customerId === s.customerId)
    if (!q) return fail('Conversation not found.')
    if (q.status !== 'Awaiting staff') return fail('There is no question waiting for a reply.')
    const at = demoNowStamp()
    const text = q.sampleReply ?? `Thanks for your message! We’ve noted your question${q.relatedRef ? ` about ${q.relatedRef}` : ''} and will get back to you with the details. You can also reach us at hello@tamsap.example.com.`
    q.messages.push({ from: 'staff', at, text, simulated: true })
    q.sampleReply = undefined
    q.status = 'Staff replied'
    notify(data, q.customerId, { at, category: 'Messages', title: 'Staff replied', body: `${q.subject}`, link: `/app/messages/${q.id}` })
    set({ data })
    return ok(undefined)
  },

  submitReview: (input) => {
    const s = get()
    if (!s.customerId) return fail('Log in to rate a trip.')
    const trip = reviewableTrips(s.data, s.customerId).find((b) => b.id === input.bookingId)
    // Only travellers with a completed TAMS AP trip can rate it, once per trip.
    if (!trip) return fail('You can rate a trip after you complete it with TAMS AP.')
    const errors = validateReview(input)
    const first = errors.rating ?? errors.title ?? errors.text ?? errors.suggestion
    if (first) return fail(first)
    const data = structuredClone(s.data)
    const me = data.customers.find((c) => c.id === s.customerId)!
    const review: Review = {
      id: nextId(data, 'review'),
      serviceId: trip.serviceId,
      customerId: me.id,
      bookingId: trip.id,
      name: publicName(me.name),
      city: me.city.split(',')[0],
      rating: Math.round(input.rating) as Review['rating'],
      title: (input.title ?? '').trim(),
      text: (input.text ?? '').trim(),
      suggestion: input.suggestion?.trim() || undefined,
      party: input.party,
      travelDate: trip.startDate,
      createdAt: demoNowStamp(),
      origin: 'local',
    }
    data.reviews.unshift(review)
    const tour = data.services.find((x) => x.id === trip.serviceId)?.type === 'tour'
    notify(data, me.id, { at: review.createdAt, category: 'Bookings', title: 'Review posted', body: tour ? 'Thanks for rating your trip. Your review is now on the tour page.' : 'Thanks for rating your trip.', link: tour ? `/app/tours/${trip.serviceId}` : '/app/reviews' })
    alertStaff(data, me.id, { at: review.createdAt, category: 'Bookings', title: 'New review', body: `${review.rating}★ from ${review.name} for ${trip.label ?? data.services.find((x) => x.id === trip.serviceId)?.name} (${trip.id}).`, link: '/admin/reviews' })
    set({ data })
    return ok(review)
  },

  toggleChecklist: (bookingId, itemId) => {
    const cl = get().checklist
    const cur = cl[bookingId] ?? []
    set({ checklist: { ...cl, [bookingId]: cur.includes(itemId) ? cur.filter((x) => x !== itemId) : [...cur, itemId] } })
  },

  reset: () => {
    writeSession({ customerId: null })
    set(initial(true))
  },
}))

function ownsRecord(d: Dataset, customerId: string, ref: string) {
  return (
    d.bookings.some((x) => x.id === ref && x.customerId === customerId) ||
    d.customRequests.some((x) => x.id === ref && x.customerId === customerId) ||
    d.rentalRequests.some((x) => x.id === ref && x.customerId === customerId)
  )
}

/** Records of the active customer only. Screens and the assistant read personal data through this. */
export function myRecords(d: Dataset, customerId: string | null) {
  if (!customerId) return { bookings: [], customRequests: [], rentalRequests: [], inquiries: [], saved: [] as SavedItem[], prefs: undefined }
  return {
    bookings: d.bookings.filter((x) => x.customerId === customerId),
    customRequests: d.customRequests.filter((x) => x.customerId === customerId),
    rentalRequests: d.rentalRequests.filter((x) => x.customerId === customerId),
    inquiries: d.inquiries.filter((x) => x.customerId === customerId),
    saved: d.saved[customerId] ?? [],
    prefs: d.preferences[customerId] as TravelPreferences | undefined,
  }
}

export const useMe = () => {
  const { data, customerId } = useCustomer()
  return customerId ? data.customers.find((c) => c.id === customerId) ?? null : null
}
