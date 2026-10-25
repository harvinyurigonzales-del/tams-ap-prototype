import { DEMO_TODAY } from '../lib/demoClock'
import { fmtDate, fmtRange, fmtTime, peso } from '../lib/format'
import type { Dataset, Destination, Service } from '../seed/types'
import { bookableDeparture, catalogTours, fromPrice } from './recommend'
import { requestDestination, requestStatusLabel } from './requests'
import { BALANCE_DUE_DAYS_BEFORE, BOOKING_CUTOFF_DAYS, DOWN_PAYMENT_RATE, departureAvailability, money } from './rules'

// Ask TAMS. Developer note: questions are matched to a fixed list of intents by keywords, and every answer is
// assembled from the catalog data and the policies in rules.ts. Anything outside those intents is offered to
// staff instead of guessed. This note is for developers only; customer copy never describes how it works.

export const ASSISTANT_DISCLOSURE = 'Quick answers about trips, prices and payments'
export const STAFF_EMAIL = 'hello@tamsap.example.com'

export type Intent =
  | 'greeting' | 'human' | 'personal' | 'cancellation' | 'what_to_bring' | 'payment_methods' | 'down_payment' | 'pickup'
  | 'inclusions' | 'custom_trip' | 'van_rental' | 'promo' | 'availability' | 'price' | 'recommend' | 'destination'
  | 'clarify' | 'login_needed' | 'unknown' | 'upload_receipt' | 'verification' | 'custom_price' | 'proposal_time' | 'preset'

/** An answer an admin wrote in Manage chatbot, used when a question contains one of its trigger phrases. */
export interface ChatPreset {
  id: string
  title: string
  keywords: string[]
  answer: string
  link?: AssistantLink
  active: boolean
}

/** The active preset whose phrase appears in the question, preferring the longest (most specific) phrase. */
export function matchPreset(presets: ChatPreset[], question: string): ChatPreset | undefined {
  const q = ` ${question.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()} `
  let best: { p: ChatPreset; len: number } | undefined
  for (const p of presets) {
    if (!p.active) continue
    for (const k of p.keywords) {
      const kw = k.toLowerCase().trim()
      if (kw && q.includes(` ${kw} `.replace(/\s+/g, ' ')) && (!best || kw.length > best.len)) best = { p, len: kw.length }
    }
  }
  return best?.p
}

export interface AssistantContext {
  kind: 'tour' | 'destination' | 'booking' | 'custom' | 'rental'
  id: string
}

export interface AssistantLink {
  label: string
  to: string
}

export interface AssistantAnswer {
  intent: Intent
  text: string
  links?: AssistantLink[]
  /** Follow-up questions shown as chips, used for clarifications. */
  options?: string[]
  /** Offer to send the question to staff. */
  escalate?: boolean
  /** The tour or destination this answer was about, so a follow-up like "What's included?" knows what "it" is. */
  about?: AssistantContext
}

const has = (q: string, ...words: string[]) => words.some((w) => q.includes(w))
const REF = /\b(BK|CR|VR|INQ)-\d{4}-\d{4}\b/i

/** Aliases customers might type for each destination. "San Juan" alone is ambiguous on purpose. */
const ALIASES: Record<string, string[]> = {
  'DST-BAGUIO': ['baguio', 'benguet'],
  'DST-TAGAYTAY': ['tagaytay', 'taal'],
  'DST-VIGAN': ['vigan', 'ilocos', 'calle crisologo'],
  'DST-CAVINTI': ['pagsanjan', 'cavinti', 'laguna'],
  'DST-BATANGAS': ['batangas', 'laiya'],
  'DST-SAGADA': ['sagada', 'mountain province'],
  'DST-BANAUE': ['banaue', 'ifugao', 'rice terraces', 'batad'],
  'DST-BALER': ['baler', 'aurora'],
  'DST-LAUNION': ['la union', 'elyu', 'urbiztondo'],
}

function findDestinations(d: Dataset, q: string): Destination[] {
  return d.destinations.filter((x) => (ALIASES[x.id] ?? [x.name.toLowerCase()]).some((a) => q.includes(a)))
}

const toursAt = (d: Dataset, destId: string) => catalogTours(d).filter((s) => s.destinationId === destId)

function tourLine(d: Dataset, s: Service) {
  const next = bookableDeparture(d, s.id)
  return next
    ? `${s.name}: from ${peso(fromPrice(d, s))} per person, next departure ${fmtDate(next.dep.startDate, { year: false })} with ${next.avail.left} seats left.`
    : `${s.name}: ${peso(s.price)} per person, no open dates right now.`
}

export interface AskInput {
  question: string
  customerId: string | null
  context?: AssistantContext
}

/** Answers one question. Pure: the same data, question and context always give the same answer. */
export function answerQuestion(d: Dataset, { question, customerId, context }: AskInput, today = DEMO_TODAY): AssistantAnswer {
  const q = ` ${question.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()} `
  if (!question.trim()) return { intent: 'clarify', text: 'Type a question, or pick one of the suggestions below.' }

  // Ambiguous place name: two destinations share it.
  if (q.includes('san juan') && !has(q, 'batangas', 'la union', 'laiya', 'elyu')) {
    return {
      intent: 'clarify',
      text: 'There are two San Juans in our trips. Which one do you mean?',
      options: ['Tell me about San Juan, Batangas', 'Tell me about San Juan, La Union'],
    }
  }

  const dests = findDestinations(d, q)
  const ctxTour = context?.kind === 'tour' ? d.services.find((s) => s.id === context.id) : undefined
  const ctxDest = context?.kind === 'destination' ? d.destinations.find((x) => x.id === context.id) : ctxTour ? d.destinations.find((x) => x.id === ctxTour.destinationId) : undefined
  const dest = dests[0] ?? ctxDest
  const tour = dests[0] ? toursAt(d, dests[0].id)[0] : ctxTour ?? (ctxDest ? toursAt(d, ctxDest.id)[0] : undefined)
  const ref = question.match(REF)?.[0].toUpperCase()
  const onRecord = !!context && ['booking', 'custom', 'rental'].includes(context.kind)
  const personal =
    !!ref ||
    has(q, 'my booking', 'my trip', 'my request', 'my reservation', 'my payment', 'my balance', 'my rental', 'my proposal', 'my quote', 'am i confirmed', 'status of my', 'i booked') ||
    (onRecord && has(q, 'status', 'confirmed', 'balance', 'paid', 'update', 'proposal', 'quote'))

  if (has(q, 'staff', 'human', 'agent', 'real person', 'talk to someone', 'customer service')) {
    return {
      intent: 'human',
      text: 'I can pass your question to our staff. They reply in Messages, usually within one business day.',
      escalate: true,
    }
  }

  // Topics the sample policies do not cover: never guess, offer staff instead.
  if (has(q, ' dog', ' cat ', ' cats', ' pet', 'animal', 'insurance', 'visa', 'wheelchair', 'weather', 'forecast', 'typhoon')) {
    return {
      intent: 'unknown',
      text: 'I don’t have the agency’s policy on that, so I won’t guess. I can send your question to our staff so a person can reply.',
      escalate: true,
    }
  }

  if (has(q, 'upload', 'receipt', 'proof of payment', 'screenshot')) {
    return {
      intent: 'upload_receipt',
      text: 'Open your booking in My Trips and choose Pay. Pick GCash, Maya or bank transfer, enter the reference number from your payment, and add a photo or screenshot of the receipt. Staff then verify it.',
      links: customerId ? [{ label: 'Open My Trips', to: '/app/trips' }] : [{ label: 'Log in to see your trips', to: '/app/login?next=/app/trips' }],
    }
  }

  if (has(q, 'verified', 'verify', 'verification', 'confirm my payment', 'payment confirmed', 'approved')) {
    return {
      intent: 'verification',
      text: 'Staff check each payment against its reference number and receipt. Until then it shows as “Awaiting verification” on your booking. Once it’s verified you get a notification and the booking updates. If something doesn’t match, staff message you in Messages.',
      links: customerId ? [{ label: 'Open My Trips', to: '/app/trips' }] : undefined,
    }
  }

  if (personal && !has(q, 'cancel', 'to bring', 'pack')) return personalAnswer(d, customerId, ref, context, today)

  if (has(q, 'cancel', 'refund')) {
    return {
      intent: 'cancellation',
      text: `You can request a cancellation for a pending or confirmed booking any time before the travel date, from the booking page in My Trips. Staff review each request and contact you about any refund. Custom-trip and van-rental requests can be withdrawn until you accept them.`,
      links: customerId ? [{ label: 'Open My Trips', to: '/app/trips' }] : [{ label: 'Log in to see your trips', to: '/app/login?next=/app/trips' }],
    }
  }

  if (has(q, 'what to bring', 'should i bring', 'do i bring', 'need to bring', 'pack', 'wear', 'prepare')) {
    const cool = dest?.interests.includes('Cool weather')
    const beach = dest?.interests.includes('Beach')
    return {
      intent: 'what_to_bring',
      text: `Bring a valid ID, your booking reference, cash for meals and fees not included, a refillable water bottle and any personal medicine.${cool ? ` ${dest!.name} gets cold, so pack a jacket.` : ''}${beach ? ` For ${dest!.name}, add swimwear, sunscreen and a change of clothes.` : ''} Confirmed trips also have a pre-travel checklist in My Trips.`,
    }
  }

  if (has(q, 'gcash', 'maya', 'bank', 'payment method', 'how do i pay', 'how to pay', 'pay with', 'mode of payment')) {
    return {
      intent: 'payment_methods',
      text: 'You can pay by GCash, Maya or bank transfer, then upload your receipt in the app. Staff verify each payment before your booking is confirmed.',
    }
  }

  if (has(q, 'down payment', 'downpayment', 'deposit', 'balance due', 'reservation fee', '50%', 'installment')) {
    return {
      intent: 'down_payment',
      text: `A ${DOWN_PAYMENT_RATE * 100}% down payment holds your booking. The balance is due ${BALANCE_DUE_DAYS_BEFORE} days before travel. For custom trips and van rentals, you pay only after you accept the proposal or quote.`,
    }
  }

  if (has(q, 'pickup', 'pick up', 'pick-up', 'meeting point', 'where do we meet', 'departure point', 'call time')) {
    if (tour) {
      return { intent: 'pickup', text: `${tour.name} picks up at ${tour.pickup}, ${fmtTime(tour.pickupTime)}. Please arrive 15 minutes early.`, links: [{ label: `View ${tour.name}`, to: `/app/tours/${tour.id}` }] }
    }
    return {
      intent: 'pickup',
      text: 'Joiner tours leave from SM North EDSA, Quezon City; the time depends on the tour and is shown on your booking. Van rentals and custom trips pick you up at the address you give us.',
    }
  }

  if (has(q, 'include', 'inclusion', "what's covered", 'covered', 'exclusion', 'not included')) {
    if (!tour) {
      return {
        intent: 'clarify',
        text: 'Which tour do you mean? Inclusions differ per tour.',
        options: catalogTours(d).slice(0, 4).map((s) => `What's included in ${s.name}?`),
      }
    }
    return {
      intent: 'inclusions',
      text: `${tour.name} includes: ${tour.inclusions.join(', ')}. Not included: ${tour.exclusions.join(', ')}.`,
      links: [{ label: `View ${tour.name}`, to: `/app/tours/${tour.id}` }],
    }
  }

  if (has(q, 'custom', 'private trip', 'private tour', 'own itinerary', 'tailor', 'personalized trip', 'family trip')) {
    if (has(q, 'price', 'cost', 'how much', 'magkano')) {
      return {
        intent: 'custom_price',
        text: 'Custom trips are priced for your group: a private van with driver per day, hotel rooms per night, and guide and entrance fees per person. The trip planner shows an estimate as you plan, and staff send the final quotation in your proposal.',
        links: [{ label: 'Plan a custom trip', to: dest ? `/app/custom/new?destination=${dest.id}` : '/app/custom/new' }],
      }
    }
    if (has(q, ' pay', 'free', 'charge')) {
      return {
        intent: 'custom_trip',
        text: 'No. Sending a custom-trip request is free and nothing is reserved. You pay a down payment only after you accept the proposal staff send you.',
        links: [{ label: 'Plan a custom trip', to: '/app/custom/new' }],
      }
    }
    return {
      intent: 'custom_trip',
      text: `Tell us where, when, your group size and budget, and staff prepare a proposal with an itinerary and price. Requests need at least 7 days' notice. A request is not a booking: you pay only if you accept the proposal.${dest ? ` You can start one for ${dest.name} now.` : ''}`,
      links: [{ label: 'Plan a custom trip', to: dest ? `/app/custom/new?destination=${dest.id}` : '/app/custom/new' }],
    }
  }

  if (has(q, 'proposal') || (has(q, 'how long', 'when will i get') && has(q, 'request', 'custom'))) {
    return {
      intent: 'proposal_time',
      text: 'Staff review each request, check hotels, guides and timing, and then send a proposal. You get a notification when it’s ready, and you can follow the status in My Trips. A proposal is valid for 7 days.',
      links: customerId ? [{ label: 'Open My Trips', to: '/app/trips?tab=custom' }] : undefined,
    }
  }

  if (has(q, ' van', 'rent', 'driver', 'vehicle', 'hiace', 'staria')) {
    const cats = d.vehicleCategories.map((c) => `${c.name} (${c.models}, up to ${c.seats} passengers) at ${peso(c.ratePerDay)} per service day`).join('; ')
    return {
      intent: 'van_rental',
      text: `Vans come with a driver and fuel: ${cats}. A service day is up to 12 hours. Multi-day trips add a driver overnight allowance, and tolls and parking are extra. Send a request for an estimate; staff confirm the final quote.`,
      links: [{ label: 'See van rental', to: '/app/rental' }],
    }
  }

  if (has(q, 'promo', 'discount', 'sale', 'voucher', 'deal')) {
    const promos = d.departures
      .filter((x) => x.promo && x.promo.bookBy >= today && departureAvailability(x, d.bookings, today).state === 'open')
      .map((x) => `${d.services.find((s) => s.id === x.serviceId)!.name} on ${fmtDate(x.startDate, { year: false })}: ${peso(x.promo!.amountOff)} off per person if you book by ${fmtDate(x.promo!.bookBy, { year: false })}`)
    return { intent: 'promo', text: promos.length ? `Current promo: ${promos.join('; ')}.` : 'There are no open promos right now.' }
  }

  if (has(q, 'available', 'availability', 'slot', 'seat', 'schedule', 'dates', 'when is', 'next trip', 'departure')) {
    if (tour) {
      const next = bookableDeparture(d, tour.id, today)
      return {
        intent: 'availability',
        text: next
          ? `${tour.name}: the next bookable departure is ${fmtRange(next.dep.startDate, next.dep.endDate)} with ${next.avail.left} seats left. Online booking closes ${BOOKING_CUTOFF_DAYS} days before departure.`
          : `${tour.name} has no open dates right now.${dest ? ` You can plan a custom trip to ${dest.name} instead.` : ''}`,
        links: next ? [{ label: 'Choose a date', to: `/app/tours/${tour.id}/dates` }] : dest ? [{ label: 'Plan a custom trip', to: `/app/custom/new?destination=${dest.id}` }] : undefined,
      }
    }
    if (dest) return noTourAt(dest)
    const soon = catalogTours(d)
      .map((s) => ({ s, next: bookableDeparture(d, s.id, today) }))
      .filter((x) => x.next)
      .sort((a, b) => a.next!.dep.startDate.localeCompare(b.next!.dep.startDate))
      .slice(0, 3)
      .map((x) => `${x.s.name}, ${fmtDate(x.next!.dep.startDate, { year: false })} (${x.next!.avail.left} seats)`)
    return { intent: 'availability', text: `Soonest departures with open seats: ${soon.join('; ')}.`, links: [{ label: 'Explore tours', to: '/app/tours' }] }
  }

  if (has(q, 'price', 'how much', 'cost', 'rate', 'magkano', 'fee', 'budget', 'cheap')) {
    if (tour) return { intent: 'price', text: tourLine(d, tour), links: [{ label: `View ${tour.name}`, to: `/app/tours/${tour.id}` }] }
    if (dest) return noTourAt(dest)
    if (has(q, 'tour', 'package')) {
      return { intent: 'price', text: catalogTours(d).map((s) => tourLine(d, s)).join('\n'), links: [{ label: 'Explore tours', to: '/app/tours' }] }
    }
    return {
      intent: 'clarify',
      text: 'Happy to help with prices. Which one do you mean?',
      options: ['Tour package prices', 'How much is a van rental?', 'How are custom trips priced?'],
    }
  }

  if (has(q, 'recommend', 'suggest', 'where should', 'where to go', 'best place', 'ideas')) {
    return {
      intent: 'recommend',
      text: 'Your home page shows suggestions based on your travel preferences, saved items and past trips, with the reason for each. Set your preferences to change them.',
      links: customerId ? [{ label: 'Travel preferences', to: '/app/preferences' }] : [{ label: 'Browse destinations', to: '/app/destinations' }],
    }
  }

  // Only when the place is named: a vague question on a tour page gets a clarification, not a brochure.
  if (dests[0]) {
    const dest = dests[0]
    const tours = toursAt(d, dest.id)
    return {
      intent: 'destination',
      text: `${dest.name}, ${dest.province}: ${dest.summary} Best months: ${dest.bestMonths}. ${dest.travelTime.replace(/^./, (c) => c.toUpperCase())} from Manila.${tours.length ? ` ${tours.map((s) => tourLine(d, s)).join(' ')}` : ' We have no joiner tour there yet, but you can request a custom trip.'}`,
      links: [{ label: `About ${dest.name}`, to: `/app/destinations/${dest.id}` }],
    }
  }

  if (has(q, ' hi ', ' hello', ' hey', 'good morning', 'good afternoon', 'thank', 'salamat')) {
    return { intent: 'greeting', text: 'Hello! Ask me about tours, prices, payments, van rental or custom trips. If I can’t answer, I can pass your question to our staff.' }
  }

  return {
    intent: 'unknown',
    text: 'I’m not sure I understood that. Try asking it another way, pick one of the questions below, or send it to our staff so a person can reply.',
    escalate: true,
  }
}

const norm = (s: string) => s.toLowerCase().replace(/[’']/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim()

/** The tour or destination an answer was about, read from the links it offers. */
function aboutOf(a: AssistantAnswer): AssistantContext | undefined {
  for (const l of a.links ?? []) {
    const t = l.to.match(/^\/app\/tours\/([^/?]+)/)
    if (t) return { kind: 'tour', id: t[1] }
    const dst = l.to.match(/^\/app\/destinations\/([^/?]+)/) ?? l.to.match(/destination=([^&]+)/)
    if (dst) return { kind: 'destination', id: dst[1] }
  }
  return undefined
}

const PAYMENT = ['How much is the down payment?', 'How do I upload my receipt?', 'When will my payment be verified?', 'Which payment methods are accepted?']
const TOUR = ["What's included?", 'Where is the pickup point?', 'Which dates are available?', 'Can I request a private trip?', 'How much is it?']
const GENERAL = ['What tours have open seats?', 'How do I pay?', 'How do custom trips work?', 'How much is a van rental?', 'Talk to staff']

/**
 * Three or four follow-up questions after every answer, based on its topic and never repeating the question
 * just asked. Each one is a question this assistant can answer.
 */
export function followUps(a: AssistantAnswer, asked: string, loggedIn: boolean, d?: Dataset): string[] {
  if (a.intent === 'clarify' && a.options?.length) return a.options
  const about = a.about
  let list: string[]
  switch (a.intent) {
    case 'payment_methods':
    case 'down_payment':
    case 'upload_receipt':
    case 'verification':
      list = [...PAYMENT, 'Can I cancel?']
      break
    case 'price':
    case 'inclusions':
    case 'pickup':
    case 'availability':
    case 'what_to_bring':
      list = about ? [...TOUR, 'What should I bring?'] : [...GENERAL]
      break
    case 'destination': {
      const name = about && d ? d.destinations.find((x) => x.id === about.id)?.name : undefined
      list = about?.kind === 'tour' ? [...TOUR] : ['What should I bring?', 'Can I request a private trip?', name ? `How much is a custom trip to ${name}?` : 'How are custom trips priced?', 'What tours have open seats?']
      break
    }
    case 'custom_trip':
    case 'custom_price':
    case 'proposal_time':
      list = ['How are custom trips priced?', 'How long does a proposal take?', 'Do I pay for a custom trip request?', 'Talk to staff']
      break
    case 'van_rental':
      list = ['Where does the van pick us up?', 'How do I pay?', 'Can I request a custom trip instead?', 'Talk to staff']
      break
    case 'personal':
      list = ['How do I upload my receipt?', 'When will my payment be verified?', 'Can I cancel?', 'Talk to staff']
      break
    case 'cancellation':
      list = [loggedIn ? 'What is the status of my bookings?' : 'What tours have open seats?', 'How does the down payment work?', 'Talk to staff']
      break
    case 'human':
    case 'login_needed':
      list = ['What tours have open seats?', 'How do I pay?', 'How do custom trips work?']
      break
    case 'promo':
    case 'recommend':
      list = ['What tours have open seats?', 'How do custom trips work?', 'How much is a van rental?', 'How does the down payment work?']
      break
    default:
      list = [loggedIn ? 'What is the status of my bookings?' : 'What tours have open seats?', ...GENERAL]
  }
  const seen = norm(asked)
  const out = [...new Set(list)].filter((x) => norm(x) !== seen)
  for (const g of GENERAL) if (out.length < 3 && !out.includes(g) && norm(g) !== seen) out.push(g)
  return out.slice(0, 4)
}

/** One full reply: the answer, what it was about, and fresh follow-up questions. */
export function respond(d: Dataset, input: AskInput, today = DEMO_TODAY, presets: ChatPreset[] = []): AssistantAnswer {
  // Questions about a booking reference always read the customer's records, never a preset.
  const preset = REF.test(input.question) ? undefined : matchPreset(presets, input.question)
  const a: AssistantAnswer = preset ? { intent: 'preset', text: preset.answer, links: preset.link ? [preset.link] : undefined } : answerQuestion(d, input, today)
  const about = aboutOf(a) ?? (['price', 'inclusions', 'pickup', 'availability', 'what_to_bring'].includes(a.intent) ? input.context : undefined)
  const withAbout = { ...a, about }
  return { ...withAbout, options: followUps(withAbout, input.question, !!input.customerId, d) }
}

function noTourAt(dest: Destination): AssistantAnswer {
  return {
    intent: 'destination',
    text: `We have no joiner tour with open dates in ${dest.name} right now. You can request a custom trip and staff will send a proposal.`,
    links: [{ label: 'Plan a custom trip', to: `/app/custom/new?destination=${dest.id}` }],
  }
}

/** Questions about the customer's own records. Only the active customer's records are ever read. */
function personalAnswer(d: Dataset, customerId: string | null, ref: string | undefined, context: AssistantContext | undefined, today: string): AssistantAnswer {
  if (!customerId) {
    return {
      intent: 'login_needed',
      text: 'Please log in so I can look up your bookings and requests. I only show records from your own account.',
      links: [{ label: 'Log in', to: '/app/login' }],
    }
  }
  const target = ref ?? (context && context.kind !== 'tour' && context.kind !== 'destination' ? context.id : undefined)
  const bookings = d.bookings.filter((b) => b.customerId === customerId)
  const customs = d.customRequests.filter((r) => r.customerId === customerId)
  const rentals = d.rentalRequests.filter((r) => r.customerId === customerId)

  if (target) {
    const b = bookings.find((x) => x.id === target)
    if (b) {
      const s = d.services.find((x) => x.id === b.serviceId)!
      const m = money(b, d.payments)
      const pay = m.submitted.length ? ' A payment is awaiting verification.' : m.balance > 0 && b.status !== 'Cancelled' ? ` Balance ${peso(m.balance)}, due ${fmtDate(m.dueDate, { year: false })}.` : ''
      return {
        intent: 'personal',
        text: `${b.id} (${b.label ?? s.name}, ${fmtRange(b.startDate, b.endDate)}): status ${b.status}, ${m.summary.toLowerCase()}.${pay}`,
        links: [{ label: `Open ${b.id}`, to: `/app/trips/${b.id}` }],
      }
    }
    const c = customs.find((x) => x.id === target)
    if (c) {
      const dest = requestDestination(d, c)
      const extra = c.status === 'Proposal ready' && c.proposal ? ` The proposal total is ${peso(c.proposal.total)}, valid until ${fmtDate(c.proposal.validUntil, { year: false })}.` : c.bookingId ? ` It became booking ${c.bookingId}.` : ''
      return { intent: 'personal', text: `${c.id} (${dest.name} custom trip): status ${c.status}.${extra}`, links: [{ label: `Open ${c.id}`, to: `/app/custom/${c.id}` }] }
    }
    const r = rentals.find((x) => x.id === target)
    if (r) {
      const extra = r.status === 'Proposal ready' && r.quote ? ` The quote is ${peso(r.quote.total)}, valid until ${fmtDate(r.quote.validUntil, { year: false })}.` : r.bookingId ? ` It became booking ${r.bookingId}.` : ''
      return { intent: 'personal', text: `${r.id} (van rental to ${r.dropoff}): status ${requestStatusLabel(r.status, 'rental')}.${extra}`, links: [{ label: `Open ${r.id}`, to: `/app/rentals/${r.id}` }] }
    }
    return { intent: 'personal', text: `I couldn’t find ${target} in your account. Check the reference in My Trips.`, links: [{ label: 'Open My Trips', to: '/app/trips' }] }
  }

  const active = [
    ...bookings
      .filter((b) => (b.status === 'Pending' || b.status === 'Confirmed') && b.endDate >= today)
      .map((b) => `${b.id} ${b.label ?? d.services.find((s) => s.id === b.serviceId)!.name}: ${b.status.toLowerCase()}, ${money(b, d.payments).summary.toLowerCase()}`),
    ...customs.filter((r) => r.status !== 'Closed' && r.status !== 'Accepted').map((r) => `${r.id} custom trip: ${r.status.toLowerCase()}`),
    ...rentals.filter((r) => r.status !== 'Closed' && r.status !== 'Accepted').map((r) => `${r.id} van rental: ${requestStatusLabel(r.status, 'rental').toLowerCase()}`),
  ]
  return {
    intent: 'personal',
    text: active.length ? `Here is what’s active in your account: ${active.join('; ')}.` : 'You have no active bookings or requests right now.',
    links: [{ label: 'Open My Trips', to: '/app/trips' }],
  }
}

/** Starter questions, tuned to what the customer is looking at. */
export function suggestedQuestions(d: Dataset, context: AssistantContext | undefined, loggedIn: boolean): string[] {
  if (context?.kind === 'tour') {
    const s = d.services.find((x) => x.id === context.id)
    if (s) return [`What's included in ${s.name}?`, `When is the next ${s.destination.split(',')[0]} departure?`, 'Where is the pickup point?', 'How does the down payment work?']
  }
  if (context?.kind === 'destination') {
    const x = d.destinations.find((y) => y.id === context.id)
    if (x) return [`Tell me about ${x.name}`, `What should I bring to ${x.name}?`, 'How do custom trips work?']
  }
  if (context && ['booking', 'custom', 'rental'].includes(context.kind)) return [`What's the status of ${context.id}?`, 'How do I pay?', 'Can I cancel?', 'Talk to staff']
  return [
    loggedIn ? 'What is the status of my bookings?' : 'What tours have open seats?',
    'How much is a van rental?',
    'How does the down payment work?',
    'How do custom trips work?',
  ]
}

/** Draft text for the "Send to staff" form: the customer's recent questions, which they can edit. */
export function escalationDraft(d: Dataset, questions: string[], context?: AssistantContext) {
  const last = questions.filter((x) => x.trim()).slice(-2)
  const about =
    context?.kind === 'tour' ? d.services.find((s) => s.id === context.id)?.name
    : context?.kind === 'destination' ? d.destinations.find((x) => x.id === context.id)?.name
    : context?.id
  const first = last.at(-1) ?? ''
  const subject = about ? `Question about ${about}` : first.length > 48 ? `${first.slice(0, 45).trim()}…` : first || 'Question for staff'
  const ref = questions.join(' ').match(REF)?.[0].toUpperCase()
  return { subject, text: last.join('\n'), relatedRef: ref ?? (context && ['booking', 'custom', 'rental'].includes(context.kind) ? context.id : undefined) }
}
