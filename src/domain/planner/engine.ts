import { addDays, daysBetween, DEMO_TODAY } from '../../lib/demoClock'
import { peso } from '../../lib/format'
import { areaOfCity } from '../places'
import { CUSTOM_GUIDE_FEE, CUSTOM_ROOM_RATE, CUSTOM_VAN_RATE, DRIVER_OVERNIGHT_ALLOWANCE, MAX_GROUP, STOPS_PER_DAY } from '../requests'
import type { Destination, PlannedTrip, TripPace } from '../../seed/types'
import { PICKUP_OFFSET, PLACES, placeFor, type Attraction, type PlaceMeta, type PlannerInterest } from './data'

// The AI planner demo. Everything here is deterministic: answers are matched against curated data and sample
// rates, so the same answers always give the same plan. Nothing is live (no hotel availability, traffic or
// reservations); staff confirm every plan before a proposal is sent.

// ---------- Answers ----------

export type GroupType = 'Barkada' | 'Family' | 'Couple' | 'Officemates' | 'Other'
export const GROUP_TYPES: GroupType[] = ['Barkada', 'Family', 'Couple', 'Officemates', 'Other']
export type Lodging = 'No preference' | 'Budget' | 'Standard' | 'Comfort'
export const LODGING: Lodging[] = ['No preference', 'Budget', 'Standard', 'Comfort']
export const ROOM_RATE: Record<Lodging, number> = { 'No preference': CUSTOM_ROOM_RATE, Budget: 1800, Standard: CUSTOM_ROOM_RATE, Comfort: 3500 }

export interface PlannerAnswers {
  destination: { mode: '' | 'chosen' | 'suggest' | 'other'; id: string; text: string }
  interests: PlannerInterest[]
  group: { type: GroupType | ''; size: number; children: number; seniors: number }
  /** exact: start and end; flexible: a window plus days; undecided: days only. */
  dates: { mode: '' | 'exact' | 'flexible' | 'undecided'; start: string; end: string; days: number; window: string }
  /** person or group: amount in pesos; help: no amount, we estimate one. */
  budget: { basis: '' | 'person' | 'group' | 'help'; amount: number | null }
  pickup: { city: string; landmark: string }
  pace: TripPace | ''
  prefs: { mustVisit: string; lodging: Lodging; accessibility: string; dietary: string; notes: string }
}

export const emptyAnswers = (): PlannerAnswers => ({
  destination: { mode: '', id: '', text: '' },
  interests: [],
  group: { type: '', size: 0, children: 0, seniors: 0 },
  dates: { mode: '', start: '', end: '', days: 2, window: '' },
  budget: { basis: '', amount: null },
  pickup: { city: '', landmark: '' },
  pace: '',
  prefs: { mustVisit: '', lodging: 'No preference', accessibility: '', dietary: '', notes: '' },
})

/** Custom trips need a week to plan, like the regular request form. */
export const earliestStart = (today = DEMO_TODAY) => addDays(today, 7)
export const MAX_DAYS = 10

export const tripDays = (a: PlannerAnswers) =>
  a.dates.mode === 'exact' && a.dates.start && a.dates.end && a.dates.end >= a.dates.start ? daysBetween(a.dates.start, a.dates.end) + 1 : Math.max(1, a.dates.days || 1)

export const pickupArea = (a: Pick<PlannerAnswers, 'pickup'>) => areaOfCity(a.pickup.city) ?? 'Metro Manila'
export const pickupLabel = (a: Pick<PlannerAnswers, 'pickup'>) => [a.pickup.landmark.trim(), a.pickup.city.trim()].filter(Boolean).join(', ')

/** Flexible-date windows offered in the dates question: the next three months, plus "any weekend". */
export function dateWindows(today = DEMO_TODAY): string[] {
  const names = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  const m = +today.slice(5, 7) - 1
  const out = ['Any weekend in the next two months']
  for (let i = 1; i <= 3; i++) out.push(`Sometime in ${names[(m + i) % 12]}`)
  return out
}

// ---------- Validation, one question at a time ----------

export type QuestionId = 'destination' | 'interests' | 'group' | 'dates' | 'budget' | 'pickup' | 'pace' | 'prefs'
export const QUESTIONS: QuestionId[] = ['destination', 'interests', 'group', 'dates', 'budget', 'pickup', 'pace', 'prefs']

export function validateQuestion(q: QuestionId, a: PlannerAnswers, today = DEMO_TODAY): Record<string, string> {
  const e: Record<string, string> = {}
  if (q === 'destination') {
    if (!a.destination.mode) e.destination = 'Pick a destination, type a place, or let us suggest one.'
    else if (a.destination.mode === 'chosen' && !a.destination.id) e.destination = 'Choose a destination from the list.'
    else if (a.destination.mode === 'other' && a.destination.text.trim().length < 3) e.destination = 'Type the place you want to visit.'
  }
  if (q === 'interests' && a.interests.length === 0) e.interests = 'Pick at least one kind of getaway.'
  if (q === 'group') {
    if (!a.group.type) e.type = 'Choose who is coming.'
    const n = a.group.size
    if (!Number.isInteger(n) || n < 1) e.size = 'Enter how many are travelling.'
    else if (n > MAX_GROUP) e.size = `For groups over ${MAX_GROUP}, message our staff and we’ll plan it with you.`
    else if (a.group.type === 'Couple' && n !== 2) e.size = 'A couple trip is for 2. Choose “Other” for a different group.'
    if (a.group.children < 0 || a.group.seniors < 0) e.extra = 'Counts cannot be negative.'
    else if (n >= 1 && a.group.children + a.group.seniors > n) e.extra = 'Children and seniors are part of the total, so they cannot add up to more than the group.'
  }
  if (q === 'dates') {
    const d = a.dates
    const earliest = earliestStart(today)
    if (!d.mode) e.mode = 'Choose how set your dates are.'
    else if (d.mode === 'exact') {
      if (!d.start) e.start = 'Choose a start date.'
      else if (d.start < earliest) e.start = `Custom trips need at least a week to plan. The earliest start is ${earliest}.`
      if (!d.end) e.end = 'Choose an end date.'
      else if (d.start && d.end < d.start) e.end = 'The end date must be on or after the start date.'
      else if (d.start && daysBetween(d.start, d.end) + 1 > MAX_DAYS) e.end = `Online plans are up to ${MAX_DAYS} days.`
    } else {
      if (d.mode === 'flexible' && !d.window) e.window = 'Choose roughly when.'
      if (!Number.isInteger(d.days) || d.days < 1) e.days = 'Choose how many days.'
      else if (d.days > MAX_DAYS) e.days = `Online plans are up to ${MAX_DAYS} days.`
    }
  }
  if (q === 'budget') {
    if (!a.budget.basis) e.basis = 'Choose how you want to set the budget.'
    else if (a.budget.basis !== 'help') {
      const v = a.budget.amount
      const min = a.budget.basis === 'person' ? 500 : 500 * Math.max(1, a.group.size)
      if (v === null || !Number.isFinite(v)) e.amount = 'Enter an amount, or choose “Help me estimate”.'
      else if (v < min) e.amount = `Enter at least ${peso(min)}${a.budget.basis === 'person' ? ' per person' : ' for the group'}.`
    }
  }
  if (q === 'pickup' && a.pickup.city.trim().length < 3) e.city = 'Enter the city or town you’ll leave from.'
  if (q === 'pace' && !a.pace) e.pace = 'Choose a pace.'
  return e
}

export const firstInvalid = (a: PlannerAnswers) => QUESTIONS.find((q) => Object.keys(validateQuestion(q, a)).length > 0)

// ---------- Plans ----------

export interface PlanStop {
  key: string
  /** Curated attraction, or undefined for a stop the customer added. */
  attractionId?: string
  name: string
  minutes: number
  /** Per person; null when unknown (custom stops) and staff will quote it. */
  fee: number | null
  tags: PlannerInterest[]
  effort: Attraction['effort']
  meal?: boolean
  when?: Attraction['when']
  confirm?: string
  /** Kept when the plan is regenerated or preferences change. */
  locked?: boolean
  custom?: boolean
}

export interface TripPlan {
  destinationId: string
  destinationName: string
  /** Stops for each day, in visiting order. */
  days: PlanStop[][]
  lodging: Lodging
  /** Extra free time per day added with the "More free time" action, in minutes. */
  freeBonus: number
  /** The customer reordered or edited stops, so the order is theirs. */
  edited: boolean
  variant: number
}

const toStop = (x: Attraction): PlanStop => ({
  key: x.id, attractionId: x.id, name: x.name, minutes: x.minutes, fee: x.fee, tags: x.tags, effort: x.effort, meal: x.meal, when: x.when, confirm: x.confirm,
})

export const CUSTOM_STOP_MINUTES = 60
let customSeq = 0
export const customStop = (name: string): PlanStop => ({
  key: `custom-${++customSeq}-${name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 24)}`,
  name: name.trim(), minutes: CUSTOM_STOP_MINUTES, fee: null, tags: [], effort: 'easy', custom: true, confirm: 'For staff review',
})

/** Van minutes from the pickup area, one way, including a short rest stop on long drives. */
export function driveMinutes(place: Pick<PlaceMeta, 'driveMin' | 'direction'>, a: Pick<PlannerAnswers, 'pickup'>) {
  const base = Math.max(30, place.driveMin + (PICKUP_OFFSET[pickupArea(a)]?.[place.direction] ?? 0))
  return base + (base > 180 ? 20 : 0)
}

const hasSensitiveGroup = (a: PlannerAnswers) => a.group.seniors > 0 || a.group.children > 0 || a.prefs.accessibility.trim().length > 0

function mustWords(a: PlannerAnswers) {
  return a.prefs.mustVisit.split(/[,\n;]+/).map((s) => s.trim()).filter((s) => s.length >= 3)
}

// Words too common to identify a place on their own.
const GENERIC = new Set(['beach', 'falls', 'church', 'museum', 'market', 'resort', 'river', 'lunch', 'dinner', 'island', 'islands', 'garden', 'mountain', 'viewpoint', 'tour'])
const mentions = (phrase: string, name: string) => {
  const p = phrase.toLowerCase()
  const n = name.toLowerCase()
  return n.includes(p) || p.split(/\s+/).filter((w) => w.length >= 5 && !GENERIC.has(w)).some((w) => n.includes(w))
}

/** How well a stop matches the answers. Higher is better. */
export function scoreStop(x: Attraction, a: PlannerAnswers) {
  let s = 1
  s += x.tags.filter((t) => a.interests.includes(t)).length * 3
  if (mustWords(a).some((w) => mentions(w, x.name))) s += 12
  const notes = a.prefs.notes.toLowerCase()
  if (notes && x.name.toLowerCase().split(/\s+/).some((w) => w.length >= 5 && notes.includes(w))) s += 3
  if (x.effort === 'hard' && hasSensitiveGroup(a)) s -= 8
  if (x.effort === 'moderate' && (a.group.seniors > 0 || a.prefs.accessibility.trim())) s -= 2
  if (a.pace === 'Relaxed' && x.tags.includes('Relaxation')) s += 1
  if (x.meal) s += 1.5
  return s
}

// ---------- Day timing ----------

const PACE_END: Record<TripPace, number> = { Relaxed: 19 * 60 + 30, Balanced: 20 * 60 + 30, Packed: 21 * 60 + 30 }
const PACE_FREE: Record<TripPace, number> = { Relaxed: 120, Balanced: 60, Packed: 0 }
const DAYTRIP_END: Record<TripPace, number> = { Relaxed: 17 * 60 + 30, Balanced: 18 * 60, Packed: 18 * 60 + 30 }
const HOME_BY = 22 * 60
export const TRANSFER_MIN = 20
const paceOf = (a: PlannerAnswers): TripPace => a.pace || 'Balanced'

/** When the van leaves on day 1: early enough to arrive mid-morning, never before 3:00 AM or after 8:00 AM. */
export const departureTime = (drive: number) => Math.min(8 * 60, Math.max(3 * 60, 10 * 60 - drive))

/** Minutes a day can give to stops, after travel, meals, check-in and free time. Mirrors `schedule`. */
function dayCapacity(i: number, days: number, drive: number, a: PlannerAnswers, freeBonus: number) {
  const pace = paceOf(a)
  const last = i === days - 1
  const free = PACE_FREE[pace] + freeBonus
  if (days === 1) {
    const start = departureTime(drive) + drive
    const end = Math.min(DAYTRIP_END[pace], HOME_BY - drive)
    return end - start - 60
  }
  if (i === 0) {
    const start = departureTime(drive) + drive
    return PACE_END[pace] - start - (start < 13 * 60 ? 60 : 0) - 30 - 75 - free
  }
  if (last) return Math.min(17 * 60, HOME_BY - drive) - (8 * 60 + 30) - 60
  return PACE_END[pace] - (pace === 'Relaxed' ? 8 * 60 + 30 : 8 * 60) - 60 - 75 - free
}

// ---------- Building a plan ----------

export interface BuildOptions {
  /** Locked stops from the current plan, kept on their day. */
  keep?: PlanStop[][]
  /** Attraction ids to avoid when possible (the previous suggestion, for "Suggest another plan"). */
  avoid?: string[]
  variant?: number
  lodging?: Lodging
  freeBonus?: number
}

const routeIndex = (place: PlaceMeta, s: PlanStop) => {
  const i = s.attractionId ? place.attractions.findIndex((x) => x.id === s.attractionId) : -1
  return i < 0 ? place.attractions.length : i
}

/** Route order, with a lunch stop second (around midday) and sunset and evening stops last. */
function orderDay(place: PlaceMeta, stops: PlanStop[]) {
  const late = (s: PlanStop) => (s.when === 'evening' ? 2 : s.when === 'sunset' ? 1 : 0)
  const out = [...stops].sort((x, y) => late(x) - late(y) || routeIndex(place, x) - routeIndex(place, y))
  const meal = out.findIndex((s) => s.meal && !s.when)
  const day = out.filter((s) => !s.when).length
  if (meal >= 0 && day >= 2 && meal !== 1) out.splice(1, 0, ...out.splice(meal, 1))
  return out
}

export function buildPlan(a: PlannerAnswers, dest: Pick<Destination, 'id' | 'name'>, o: BuildOptions = {}): TripPlan {
  const days = tripDays(a)
  const place = placeFor(dest.id)
  const lodging = o.lodging ?? a.prefs.lodging
  const freeBonus = o.freeBonus ?? 0
  const out: PlanStop[][] = Array.from({ length: days }, () => [])
  const keep = o.keep ?? []
  keep.forEach((d, i) => d.filter((s) => s.locked).forEach((s) => out[Math.min(i, days - 1)].push(s)))
  const kept = new Set(out.flat().map((s) => s.key))

  // Must-visits we have no data for become custom stops for staff to review.
  const known = place?.attractions ?? []
  for (const w of mustWords(a)) {
    if (known.some((x) => mentions(w, x.name)) || out.flat().some((s) => mentions(w, s.name))) continue
    out[0].push({ ...customStop(w), locked: true })
  }

  if (!place) return { destinationId: dest.id, destinationName: dest.name, days: out, lodging, freeBonus, edited: false, variant: o.variant ?? 0 }

  const drive = driveMinutes(place, a)
  const pace = paceOf(a)
  const cap = Array.from({ length: days }, (_, i) => dayCapacity(i, days, drive, a, freeBonus))
  const count = out.map((d) => d.length)
  out.forEach((d, i) => d.forEach((s) => (cap[i] -= s.minutes + TRANSFER_MIN)))

  const avoid = new Set(o.avoid ?? [])
  const v = o.variant ?? 0
  const candidates = place.attractions
    .filter((x) => !kept.has(x.id))
    .map((x, i) => ({ x, i, score: scoreStop(x, a) - (avoid.has(x.id) ? 5 : 0) + (v ? (((i + 1) * 7 + v * 3) % 5) * 0.3 : 0) }))
    .sort((p, q) => q.score - p.score || p.i - q.i)

  // Pick the best stops that fit, then lay them out in route order across the days.
  const totalCap = cap.reduce((n, c) => n + Math.max(0, c), 0)
  const maxCount = days * STOPS_PER_DAY[pace] - count.reduce((n, c) => n + c, 0)
  const chosen: Attraction[] = []
  let used = 0
  for (const c of candidates) {
    if (chosen.length >= maxCount) break
    if (c.score <= 0) continue
    // Sunset and evening stops need a night there.
    if (c.x.when && days === 1) continue
    if (used + c.x.minutes + TRANSFER_MIN > totalCap) continue
    chosen.push(c.x)
    used += c.x.minutes + TRANSFER_MIN
  }
  chosen.sort((p, q) => known.indexOf(p) - known.indexOf(q))
  // Sunset and evening stops first, so each overnight day keeps an evening slot.
  for (const x of chosen.filter((y) => y.when)) {
    const d = out.slice(0, days - 1).findIndex((stops, i) => count[i] < STOPS_PER_DAY[pace] && !stops.some((s) => s.when === x.when))
    if (d < 0) continue
    out[d].push(toStop(x))
    count[d]++
  }
  let day = 0
  for (const x of chosen.filter((y) => !y.when)) {
    while (day < days - 1 && (count[day] >= STOPS_PER_DAY[pace] || cap[day] < x.minutes + TRANSFER_MIN)) day++
    out[day].push(toStop(x))
    count[day]++
    cap[day] -= x.minutes + TRANSFER_MIN
  }
  return { destinationId: dest.id, destinationName: dest.name, days: out.map((d) => orderDay(place, d)), lodging, freeBonus, edited: false, variant: v }
}

/** Fits the plan to a new number of days, keeping every stop: extra days get new suggestions, removed days move their stops forward. */
export function refitDays(plan: TripPlan, a: PlannerAnswers): TripPlan {
  const days = tripDays(a)
  if (plan.days.length === days) return plan
  const flat = plan.days.flat()
  const shaped: PlanStop[][] = Array.from({ length: days }, (_, i) => (i < plan.days.length ? [...plan.days[i]] : []))
  if (plan.days.length > days) plan.days.slice(days).forEach((d) => shaped[days - 1].push(...d))
  if (days > plan.days.length) {
    const fresh = buildPlan(a, { id: plan.destinationId, name: plan.destinationName }, { keep: shaped.map((d) => d.map((s) => ({ ...s, locked: true }))), lodging: plan.lodging, freeBonus: plan.freeBonus })
    const lockedBefore = new Set(flat.filter((s) => s.locked).map((s) => s.key))
    return { ...plan, days: fresh.days.map((d) => d.map((s) => ({ ...s, locked: lockedBefore.has(s.key) || undefined }))) }
  }
  return { ...plan, days: shaped }
}

// ---------- Schedule ----------

export type ItemKind = 'pickup' | 'travel' | 'stop' | 'meal' | 'checkin' | 'free' | 'return'
export interface ScheduleItem {
  start: number
  end: number
  kind: ItemKind
  title: string
  note?: string
  stopKey?: string
  review?: string
}
export interface DaySchedule {
  day: number
  date?: string
  items: ScheduleItem[]
  /** Minutes the day runs past a sensible end, when it does. */
  overflow: number
  label: string
}

export const clock = (m: number) => {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
export const hoursText = (m: number) => {
  const h = Math.floor(m / 60)
  const r = m % 60
  if (!h) return `${r} min`
  return r ? `${h} hr ${r} min` : `${h} ${h === 1 ? 'hr' : 'hrs'}`
}

export function schedule(plan: TripPlan, a: PlannerAnswers): DaySchedule[] {
  const place = placeFor(plan.destinationId)
  const days = plan.days.length
  const pace = paceOf(a)
  const drive = place ? driveMinutes(place, a) : 0
  const from = pickupLabel(a) || 'your pickup point'
  const dateOf = (i: number) => (a.dates.mode === 'exact' && a.dates.start ? addDays(a.dates.start, i) : undefined)

  return plan.days.map((stops, i) => {
    const items: ScheduleItem[] = []
    const last = i === days - 1
    const overnight = days > 1 && !last
    if (!place) {
      // No planning data: list the stops without times and leave the route to staff.
      stops.forEach((s) => items.push({ start: 0, end: 0, kind: 'stop', title: s.name, stopKey: s.key, review: s.confirm ?? 'For staff review' }))
      return { day: i + 1, date: dateOf(i), items, overflow: 0, label: stops.length ? 'Stops for staff to plan' : 'To be planned with staff' }
    }
    let t: number
    let lunch = false
    let dinner = false
    let checkin = !(days > 1 && i === 0)
    let freeLeft = overnight ? PACE_FREE[pace] + plan.freeBonus : 0
    if (i === 0) {
      const dep = departureTime(drive)
      items.push({ start: dep, end: dep, kind: 'pickup', title: `Pickup at ${from}`, note: 'Staff confirm the exact pickup point and time.' })
      const arrive = dep + drive
      const viaLunch = dep < 12 * 60 && arrive > 12 * 60 + 30
      items.push({ start: dep, end: arrive, kind: 'travel', title: `Drive to ${plan.destinationName}`, note: `About ${hoursText(drive)}${drive > 200 ? ', with a rest stop' : ''}${viaLunch ? ' and lunch on the way' : ''}` })
      lunch = viaLunch
      t = arrive
    } else {
      const start = last ? 8 * 60 + 30 : pace === 'Relaxed' ? 8 * 60 + 30 : 8 * 60
      items.push({ start: start - 60, end: start, kind: 'meal', title: last ? 'Breakfast and check-out' : 'Breakfast' })
      t = start
    }
    const endOfDay = days === 1 ? Math.min(DAYTRIP_END[pace], HOME_BY - drive) : last ? Math.min(17 * 60, HOME_BY - drive) : PACE_END[pace]
    const free = (to: number, title = 'Free time', note = 'Rest, swim or explore on your own') => {
      const prev = items[items.length - 1]
      if (prev?.kind === 'free' && prev.end === t) prev.end = to
      else items.push({ start: t, end: to, kind: 'free', title, note })
      t = to
    }
    const gap = (to: number) => {
      if (to - t >= 30) free(to)
      t = Math.max(t, to)
    }
    const addLunch = () => {
      items.push({ start: t, end: t + 60, kind: 'meal', title: 'Lunch', note: a.prefs.dietary.trim() ? `Noted: ${a.prefs.dietary.trim()}` : undefined })
      t += 60
      lunch = true
    }
    const addCheckin = () => {
      gap(14 * 60)
      const at = t
      items.push({ start: at, end: at + 30, kind: 'checkin', title: 'Check in and rest', note: plan.lodging === 'No preference' ? 'Hotel chosen by staff' : `${plan.lodging} hotel, chosen by staff` })
      t = at + 30
      checkin = true
    }
    const addFree = () => {
      if (freeLeft <= 0) return
      free(t + freeLeft)
      freeLeft = 0
    }
    stops.forEach((s, k) => {
      if (!lunch && (t >= 11 * 60 + 30 || s.when) && !(s.meal && s.when !== 'evening')) {
        gap(11 * 60 + 30)
        addLunch()
      }
      if (!checkin && (t >= 14 * 60 + 30 || s.when)) addCheckin()
      if (s.when) addFree()
      const travel = k === 0 && i > 0 ? 15 : TRANSFER_MIN
      if (s.when === 'sunset' && overnight) gap(17 * 60 - travel)
      if (s.when === 'evening' && overnight) gap(18 * 60 + 30 - travel)
      items.push({ start: t, end: t + travel, kind: 'travel', title: 'Short drive', note: `About ${travel} min` })
      t += travel
      items.push({ start: t, end: t + s.minutes, kind: 'stop', title: s.name, stopKey: s.key, review: s.confirm })
      t += s.minutes
      if (s.meal && s.when !== 'evening' && t >= 11 * 60 && !lunch) lunch = true
      if (s.meal && s.when === 'evening') dinner = true
    })
    if (!lunch && endOfDay > 12 * 60 + 30 && t < 15 * 60) {
      gap(11 * 60 + 30)
      addLunch()
    }
    if (!checkin) addCheckin()
    addFree()
    if (overnight && !dinner) {
      gap(18 * 60 + 30)
      const at = t
      items.push({ start: at, end: at + 75, kind: 'meal', title: 'Dinner', note: a.prefs.dietary.trim() ? `Noted: ${a.prefs.dietary.trim()}` : undefined })
      t = at + 75
    }
    let overflow = Math.max(0, t - (overnight ? PACE_END[pace] : endOfDay) - 15)
    if (last) {
      const leave = Math.max(t, Math.min(endOfDay, 15 * 60))
      if (leave - t >= 30) free(leave, 'Free time before the trip home', 'Pasalubong shopping or one more look around')
      t = leave
      items.push({ start: leave, end: leave + drive, kind: 'return', title: `Drive back to ${from}`, note: `About ${hoursText(drive)}${leave + drive > 20 * 60 ? ', with a dinner stop on the way' : ''}` })
      overflow = Math.max(overflow, leave + drive - HOME_BY - 15)
    }
    const shown = stops.length
    const label = i === 0 ? (days === 1 ? 'Day trip' : 'Travel day') : last ? 'Last day and trip home' : shown ? 'Full day' : 'Free day'
    return { day: i + 1, date: dateOf(i), items, overflow: Math.max(0, overflow), label }
  })
}

// ---------- Cost estimate ----------

export type CostGroup = 'shared' | 'person' | 'optional' | 'quote'
export interface CostLine {
  group: CostGroup
  label: string
  /** Total for the group in pesos; undefined when staff will quote it. */
  amount?: number
  detail?: string
  unitPrice?: number
  qty?: number
  unit?: string
}
export interface Estimate {
  lines: CostLine[]
  /** Included lines (shared and per person) for the whole group. */
  total: number
  perPerson: number
  optionalPerPerson: number
  vans: number
  rooms: number
}

export const MEAL_RATE = { lunch: 300, dinner: 400 }

export function estimate(plan: TripPlan, a: PlannerAnswers): Estimate {
  const size = Math.max(1, a.group.size || 1)
  const days = plan.days.length
  const nights = days - 1
  const vans = Math.ceil(size / 12)
  const rooms = nights > 0 ? Math.ceil(size / (a.group.type === 'Family' ? 3 : 2)) : 0
  const lines: CostLine[] = []
  lines.push({ group: 'shared', label: `Private van with driver and fuel${vans > 1 ? ` (${vans} vans)` : ''}`, amount: CUSTOM_VAN_RATE * vans * days, unitPrice: CUSTOM_VAN_RATE * vans, qty: days, unit: 'day', detail: `${peso(CUSTOM_VAN_RATE)} a day × ${days} ${days === 1 ? 'day' : 'days'}${vans > 1 ? ` × ${vans}` : ''}` })
  if (nights > 0) {
    lines.push({ group: 'shared', label: 'Driver overnight allowance', amount: DRIVER_OVERNIGHT_ALLOWANCE * vans * nights, unitPrice: DRIVER_OVERNIGHT_ALLOWANCE * vans, qty: nights, unit: 'night', detail: `${peso(DRIVER_OVERNIGHT_ALLOWANCE)} a night × ${nights}` })
    const rate = ROOM_RATE[plan.lodging]
    lines.push({ group: 'shared', label: `${plan.lodging === 'No preference' ? 'Standard' : plan.lodging} hotel, ${rooms} ${rooms === 1 ? 'room' : 'rooms'}`, amount: rate * rooms * nights, unitPrice: rate * rooms, qty: nights, unit: 'night', detail: `${peso(rate)} a room a night × ${nights} ${nights === 1 ? 'night' : 'nights'}${a.group.type === 'Family' ? ', family rooms for 3' : ', twin sharing'}` })
  }
  lines.push({ group: 'person', label: 'Local guide and environmental fees', amount: CUSTOM_GUIDE_FEE * size, unitPrice: CUSTOM_GUIDE_FEE, qty: size, unit: 'person', detail: `${peso(CUSTOM_GUIDE_FEE)} × ${size}` })
  const stops = plan.days.flat()
  const fees = stops.reduce((n, s) => n + (s.fee ?? 0), 0)
  if (fees > 0) lines.push({ group: 'person', label: 'Entrance and activity fees for your stops', amount: fees * size, unitPrice: fees, qty: size, unit: 'person', detail: `${peso(fees)} × ${size}` })
  const mealsPP = MEAL_RATE.lunch * days + MEAL_RATE.dinner * nights
  lines.push({ group: 'optional', label: 'Meals, if you want us to arrange them', amount: mealsPP * size, detail: `About ${peso(mealsPP)} a person (lunches${nights ? ' and dinners' : ''}; breakfast usually comes with the room)` })
  lines.push({ group: 'quote', label: 'Tolls and parking', detail: 'Depends on the final route' })
  const place = placeFor(plan.destinationId)
  if (place?.confirm) lines.push({ group: 'quote', label: place.confirm })
  for (const s of stops) {
    if (s.custom) lines.push({ group: 'quote', label: `${s.name}: entry and timing`, detail: 'A stop you added, for staff review' })
    else if (s.confirm) lines.push({ group: 'quote', label: `${s.name}: ${s.confirm.toLowerCase()}` })
  }
  if (!place) lines.push({ group: 'quote', label: 'Route and travel time', detail: 'We have no planning data for this place yet' })
  const total = lines.filter((l) => l.group === 'shared' || l.group === 'person').reduce((n, l) => n + (l.amount ?? 0), 0)
  return { lines, total, perPerson: Math.ceil(total / size), optionalPerPerson: mealsPP, vans, rooms }
}

/** The customer's budget for the group and per person, or null when they asked us to estimate. */
export function budgetOf(a: PlannerAnswers): { perPerson: number; group: number } | null {
  const size = Math.max(1, a.group.size || 1)
  if (a.budget.basis === 'person' && a.budget.amount) return { perPerson: a.budget.amount, group: a.budget.amount * size }
  if (a.budget.basis === 'group' && a.budget.amount) return { perPerson: Math.floor(a.budget.amount / size), group: a.budget.amount }
  return null
}

// ---------- Issues ----------

export type FixId = 'add-day' | 'fewer-stops' | 'cheaper' | 'raise-budget' | 'nearer' | 'replace-hard' | 'staff'
export interface Fix {
  id: FixId
  label: string
}
export interface PlanIssue {
  id: string
  title: string
  detail: string
  fixes: Fix[]
}

export function checkPlan(plan: TripPlan, a: PlannerAnswers, sched = schedule(plan, a), est = estimate(plan, a)): PlanIssue[] {
  const out: PlanIssue[] = []
  const place = placeFor(plan.destinationId)
  const days = plan.days.length
  if (!place) {
    out.push({
      id: 'unknown-place', title: `We don’t have planning data for ${plan.destinationName} yet`,
      detail: 'We can’t suggest stops or travel times for this place, so we won’t guess them. Send it as a request and staff will check whether we can take you there and plan the route with you.',
      fixes: [{ id: 'nearer', label: 'See places we can plan' }, { id: 'staff', label: 'Send for staff review' }],
    })
    return out
  }
  const drive = driveMinutes(place, a)
  if (place.minDays > days) {
    out.push({
      id: 'too-short', title: `${plan.destinationName} usually needs ${place.minDays} days`,
      detail: `It’s about ${hoursText(drive)} each way from ${a.pickup.city || 'your pickup'}, so ${days === 1 ? 'a day trip' : `${days} days`} leaves little time there.`,
      fixes: [{ id: 'add-day', label: `Make it ${place.minDays} days` }, { id: 'nearer', label: 'Suggest a nearer place' }],
    })
  } else if (days === 1 && drive * 2 > 8 * 60) {
    out.push({
      id: 'long-day', title: 'A long day on the road',
      detail: `About ${hoursText(drive * 2)} of driving in one day. It works, but an overnight stay is more comfortable.`,
      fixes: [{ id: 'add-day', label: 'Add a night' }, { id: 'nearer', label: 'Suggest a nearer place' }],
    })
  }
  sched.forEach((d) => {
    if (d.overflow > 0)
      out.push({
        id: `overflow-${d.day}`, title: `Day ${d.day} runs about ${hoursText(d.overflow)} too long`,
        detail: 'The stops plus travel time don’t fit comfortably in the day.',
        fixes: [{ id: 'fewer-stops', label: 'Remove a stop' }, { id: 'add-day', label: 'Add a day' }],
      })
  })
  const hard = plan.days.flat().filter((s) => s.effort === 'hard')
  if (hard.length && hasSensitiveGroup(a)) {
    const who = [a.group.seniors ? 'seniors' : '', a.group.children ? 'children' : '', a.prefs.accessibility.trim() ? 'your accessibility note' : ''].filter(Boolean).join(' and ')
    out.push({
      id: 'effort', title: `${hard.map((s) => s.name).join(', ')} ${hard.length === 1 ? 'is' : 'are'} physically demanding`,
      detail: `You mentioned ${who}. Staff can check whether ${hard.length === 1 ? 'it' : 'they'} suit your group, or you can swap for an easier stop.`,
      fixes: [{ id: 'replace-hard', label: 'Swap for easier stops' }, { id: 'staff', label: 'Keep it, staff will check' }],
    })
  }
  const b = budgetOf(a)
  if (b && est.perPerson > b.perPerson * 1.05) {
    out.push({
      id: 'budget', title: `About ${peso(est.perPerson - b.perPerson)} a person over your budget`,
      detail: `The estimate is ${peso(est.perPerson)} a person (${peso(est.total)} for the group) against your ${peso(b.perPerson)} a person.`,
      fixes: [{ id: 'cheaper', label: 'Make it cheaper' }, { id: 'fewer-stops', label: 'Remove a stop' }, { id: 'raise-budget', label: `Set budget to ${peso(Math.ceil(est.perPerson / 100) * 100)}` }, { id: 'nearer', label: 'Suggest a nearer place' }],
    })
  }
  return out
}

// ---------- Matching destinations ----------

const INTEREST_ALIAS: Partial<Record<PlannerInterest, string>> = { Mountains: 'Cool weather' }

export interface Suggestion {
  destination: Destination
  score: number
  reasons: string[]
  perPerson: number
  drive: number
}

export function rankDestinations(a: PlannerAnswers, catalog: Destination[]): Suggestion[] {
  const days = tripDays(a)
  const b = budgetOf(a)
  const list: Suggestion[] = []
  for (const place of PLACES) {
    const dest = catalog.find((d) => d.id === place.destinationId)
    if (!dest) continue
    const drive = driveMinutes(place, a)
    const tags = new Set(place.attractions.flatMap((x) => x.tags))
    const matched = a.interests.filter((t) => tags.has(t) || dest.interests.includes((INTEREST_ALIAS[t] ?? t) as never))
    let score = matched.length * 4 + a.interests.filter((t) => dest.interests.includes((INTEREST_ALIAS[t] ?? t) as never)).length * 2
    if (place.minDays > days) score -= 6 * (place.minDays - days)
    else score += 2
    if (days === 1) score -= Math.max(0, drive - 180) / 30
    else score -= Math.max(0, drive - 150 * days) / 45
    if (a.pace === 'Relaxed' && drive > 300) score -= 2
    const hard = place.attractions.filter((x) => x.effort === 'hard').length / place.attractions.length
    if (hasSensitiveGroup(a)) score -= hard * 6
    const plan = buildPlan(a, dest)
    const est = estimate(plan, a)
    if (b) score -= Math.max(0, est.perPerson - b.perPerson) / 400
    if (place.confirm) score -= 1
    const reasons: string[] = []
    if (matched.length) reasons.push(`Good for ${lower(matched)}`)
    reasons.push(`About ${hoursText(drive)} from ${a.pickup.city || 'Metro Manila'}`)
    if (place.minDays <= days) reasons.push(days === 1 ? 'Works as a day trip' : `Fits ${days} days`)
    else reasons.push(`Best with ${place.minDays} days`)
    if (b) reasons.push(est.perPerson <= b.perPerson ? `Around ${peso(est.perPerson)} a person, within budget` : `Around ${peso(est.perPerson)} a person`)
    list.push({ destination: dest, score, reasons, perPerson: est.perPerson, drive })
  }
  return list.sort((x, y) => y.score - x.score || x.drive - y.drive)
}

export const listText = (xs: string[]) => (xs.length <= 1 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`)
const lower = (xs: string[]) => listText(xs.map((x) => x.toLowerCase()))

// ---------- Why it fits ----------

export function whyItFits(plan: TripPlan, a: PlannerAnswers, est = estimate(plan, a)): string[] {
  const place = placeFor(plan.destinationId)
  const out: string[] = []
  const stops = plan.days.flat()
  if (a.interests.length) {
    const hits = stops.filter((s) => s.tags.some((t) => a.interests.includes(t)))
    if (hits.length) out.push(`You picked ${lower(a.interests)}, so the plan includes ${listText(hits.slice(0, 3).map((s) => s.name))}.`)
  }
  if (place) {
    const drive = driveMinutes(place, a)
    out.push(`It’s about ${hoursText(drive)} from ${a.pickup.city || 'your pickup'}, so we leave at ${clock(departureTime(drive))} and arrive at ${clock(departureTime(drive) + drive)}.`)
  }
  if (a.pace) out.push(`${a.pace} pace: up to ${STOPS_PER_DAY[a.pace]} stops a day${PACE_FREE[a.pace] + plan.freeBonus ? ` and about ${hoursText(PACE_FREE[a.pace] + plan.freeBonus)} of free time on full days` : ''}.`)
  if (a.group.size) out.push(`A private van for ${a.group.size}${a.group.type ? ` (${a.group.type.toLowerCase()})` : ''}${est.rooms ? `, with ${est.rooms} hotel ${est.rooms === 1 ? 'room' : 'rooms'}` : ''}.`)
  const b = budgetOf(a)
  if (b) out.push(est.perPerson <= b.perPerson ? `About ${peso(est.perPerson)} a person, within your ${peso(b.perPerson)} a person.` : `About ${peso(est.perPerson)} a person, above your ${peso(b.perPerson)} a person. See the adjustments below.`)
  else if (a.budget.basis === 'help') out.push(`You asked us to estimate: about ${peso(est.perPerson)} a person before meals.`)
  if (a.group.seniors || a.group.children) out.push('Stops are mostly easy walks, chosen with your seniors and children in mind.')
  return out
}

// ---------- Editing ----------

const touch = (p: TripPlan, days: PlanStop[][]): TripPlan => ({ ...p, days, edited: true })

export function findStop(plan: TripPlan, key: string) {
  for (let d = 0; d < plan.days.length; d++) {
    const i = plan.days[d].findIndex((s) => s.key === key)
    if (i >= 0) return { day: d, index: i, stop: plan.days[d][i] }
  }
  return undefined
}

export function removeStop(plan: TripPlan, key: string): TripPlan {
  return touch(plan, plan.days.map((d) => d.filter((s) => s.key !== key)))
}

export function toggleLock(plan: TripPlan, key: string): TripPlan {
  return { ...plan, days: plan.days.map((d) => d.map((s) => (s.key === key ? { ...s, locked: !s.locked || undefined } : s))) }
}

/** Moves a stop one place up or down; at the edge of a day it moves to the next or previous day. */
export function moveStop(plan: TripPlan, key: string, dir: -1 | 1): TripPlan {
  const at = findStop(plan, key)
  if (!at) return plan
  const days = plan.days.map((d) => [...d])
  const { day, index, stop } = at
  const j = index + dir
  if (j >= 0 && j < days[day].length) {
    ;[days[day][index], days[day][j]] = [days[day][j], days[day][index]]
  } else {
    const nd = day + dir
    if (nd < 0 || nd >= days.length) return plan
    days[day].splice(index, 1)
    if (dir < 0) days[nd].push(stop)
    else days[nd].unshift(stop)
  }
  return touch(plan, days)
}

export function canMove(plan: TripPlan, key: string, dir: -1 | 1) {
  const at = findStop(plan, key)
  if (!at) return false
  if (dir < 0) return at.index > 0 || at.day > 0
  return at.index < plan.days[at.day].length - 1 || at.day < plan.days.length - 1
}

export function replaceStop(plan: TripPlan, key: string, attractionId: string): TripPlan {
  const place = placeFor(plan.destinationId)
  const x = place?.attractions.find((y) => y.id === attractionId)
  // A place already in the plan is never added a second time.
  if (!x || plan.days.flat().some((s) => s.attractionId === x.id && s.key !== key)) return plan
  return touch(plan, plan.days.map((d) => d.map((s) => (s.key === key ? { ...toStop(x), locked: s.locked } : s))))
}

/** Swaps a stop for a place the customer names; staff check its timing and fees. */
export function replaceWithCustom(plan: TripPlan, key: string, name: string): TripPlan {
  if (name.trim().length < 3) return plan
  return touch(plan, plan.days.map((d) => d.map((s) => (s.key === key ? { ...customStop(name), locked: s.locked } : s))))
}

export function addAttraction(plan: TripPlan, attractionId: string, day: number): TripPlan {
  const place = placeFor(plan.destinationId)
  const x = place?.attractions.find((y) => y.id === attractionId)
  if (!x || plan.days.flat().some((s) => s.attractionId === x.id)) return plan
  const days = plan.days.map((d) => [...d])
  const d = Math.min(Math.max(0, day), days.length - 1)
  days[d] = plan.edited ? [...days[d], toStop(x)] : orderDay(place!, [...days[d], toStop(x)])
  return touch(plan, days)
}

export function addCustomStop(plan: TripPlan, name: string, day: number): TripPlan {
  if (name.trim().length < 3) return plan
  const days = plan.days.map((d) => [...d])
  days[Math.min(Math.max(0, day), days.length - 1)].push(customStop(name))
  return touch(plan, days)
}

/** Stops not in the plan yet, best match first, with what they change. */
export function alternativesFor(plan: TripPlan, a: PlannerAnswers, key?: string) {
  const place = placeFor(plan.destinationId)
  if (!place) return []
  const used = new Set(plan.days.flat().map((s) => s.attractionId))
  const current = key ? findStop(plan, key)?.stop : undefined
  return place.attractions
    .filter((x) => !used.has(x.id))
    .map((x) => ({
      attraction: x,
      score: scoreStop(x, a),
      matches: x.tags.filter((t) => a.interests.includes(t)),
      minutesDelta: current ? x.minutes - current.minutes : x.minutes,
      feeDelta: current ? x.fee - (current.fee ?? 0) : x.fee,
    }))
    .sort((p, q) => q.score - p.score)
}

// ---------- Quick actions ----------

export type QuickAction = 'cheaper' | 'beach' | 'fewer' | 'free'
export interface ActionResult {
  plan: TripPlan
  changed: boolean
  message: string
}

/** The unlocked stop that matters least to these answers. */
function weakest(plan: TripPlan, a: PlannerAnswers) {
  const place = placeFor(plan.destinationId)
  const score = (s: PlanStop) => {
    const x = place?.attractions.find((y) => y.id === s.attractionId)
    return x ? scoreStop(x, a) : 100
  }
  return plan.days.flat().filter((s) => !s.locked && !s.custom).sort((x, y) => score(x) - score(y) || y.minutes - x.minutes)[0]
}

export function quickAction(plan: TripPlan, a: PlannerAnswers, action: QuickAction): ActionResult {
  const place = placeFor(plan.destinationId)
  if (action === 'fewer') {
    const w = weakest(plan, a)
    if (!w) return { plan, changed: false, message: 'Every stop is locked or one you added, so we left them all in. Unlock a stop to let us remove it.' }
    return { plan: removeStop(plan, w.key), changed: true, message: `Removed ${w.name}, the stop that matched your answers least.` }
  }
  if (action === 'free') {
    const w = weakest(plan, a)
    const more = { ...plan, freeBonus: plan.freeBonus + 60 }
    if (!w) return { plan: more, changed: true, message: 'Added an hour of free time to each full day.' }
    return { plan: { ...removeStop(more, w.key) }, changed: true, message: `Removed ${w.name} and added an hour of free time to each full day.` }
  }
  if (action === 'beach') {
    const beach = place?.attractions.filter((x) => x.tags.includes('Beach') && !plan.days.flat().some((s) => s.attractionId === x.id)) ?? []
    if (!beach.length) return { plan, changed: false, message: place?.attractions.some((x) => x.tags.includes('Beach')) ? 'All the beach stops we know here are already in your plan.' : `${plan.destinationName} has no beach stops in our planning data. Try a beach destination such as La Union or Batangas.` }
    const add = beach[0]
    const w = plan.days.flat().filter((s) => !s.locked && !s.custom && !s.tags.includes('Beach'))
    const swap = w.sort((x, y) => (place ? scoreStop(place.attractions.find((z) => z.id === x.attractionId)!, a) - scoreStop(place.attractions.find((z) => z.id === y.attractionId)!, a) : 0))[0]
    if (swap) return { plan: replaceStop(plan, swap.key, add.id), changed: true, message: `Swapped ${swap.name} for ${add.name}.` }
    const day = plan.days.reduce((best, d, i) => (d.length < plan.days[best].length ? i : best), 0)
    return { plan: addAttraction(plan, add.id, day), changed: true, message: `Added ${add.name} on day ${day + 1}.` }
  }
  // cheaper: drop to budget rooms first, then swap the priciest unlocked stop for a cheaper one.
  if (plan.days.length > 1 && plan.lodging !== 'Budget') {
    return { plan: { ...plan, lodging: 'Budget', edited: true }, changed: true, message: `Switched to budget rooms (${peso(ROOM_RATE.Budget)} a room a night).` }
  }
  const pricey = plan.days.flat().filter((s) => !s.locked && !s.custom && (s.fee ?? 0) > 0).sort((x, y) => (y.fee ?? 0) - (x.fee ?? 0))[0]
  if (pricey) {
    const alt = alternativesFor(plan, a, pricey.key).filter((x) => x.attraction.fee < (pricey.fee ?? 0)).sort((x, y) => y.score - x.score)[0]
    if (alt) return { plan: replaceStop(plan, pricey.key, alt.attraction.id), changed: true, message: `Swapped ${pricey.name} for ${alt.attraction.name}, which costs ${peso((pricey.fee ?? 0) - alt.attraction.fee)} less a person.` }
    return { plan: removeStop(plan, pricey.key), changed: true, message: `Removed ${pricey.name} (${peso(pricey.fee ?? 0)} a person). No cheaper stop like it was left.` }
  }
  return { plan, changed: false, message: 'The van and rooms are already at the lowest sample rates and the stops are free. A shorter trip or a nearer place would cost less.' }
}

// ---------- Suggest another ----------

export interface AnotherResult {
  plan: TripPlan
  changed: boolean
  message: string
  /** Set when the other plan is for a different destination. */
  destinationId?: string
}

const stopSet = (p: TripPlan) => p.days.flat().map((s) => s.key).sort().join('|')

/**
 * Another plan. Locked stops and a chosen destination stay; when we picked the destination and nothing is locked,
 * the next best destination is offered instead. Explains when there is no meaningful alternative.
 */
export function suggestAnother(plan: TripPlan, a: PlannerAnswers, catalog: Destination[], shown: string[]): AnotherResult {
  const anyLocked = plan.days.flat().some((s) => s.locked)
  if (a.destination.mode === 'suggest' && !anyLocked) {
    const next = rankDestinations(a, catalog).slice(0, 4).find((s) => !shown.includes(s.destination.id))
    if (next) {
      const p = buildPlan(a, next.destination, { lodging: plan.lodging })
      return { plan: p, changed: true, destinationId: next.destination.id, message: `Here’s a plan for ${next.destination.name} instead. ${next.reasons[0] ?? ''}.`.replace('..', '.') }
    }
  }
  const prev = plan.days.flat().filter((s) => !s.locked && s.attractionId).map((s) => s.attractionId!)
  for (let v = plan.variant + 1; v <= plan.variant + 4; v++) {
    const p = buildPlan(a, { id: plan.destinationId, name: plan.destinationName }, { keep: plan.days, avoid: prev, variant: v, lodging: plan.lodging, freeBonus: plan.freeBonus })
    if (stopSet(p) !== stopSet(plan)) {
      return { plan: p, changed: true, message: anyLocked ? 'New stops around the ones you locked.' : `A different mix of stops in ${plan.destinationName}.` }
    }
  }
  return {
    plan, changed: false,
    message: placeFor(plan.destinationId)
      ? `We don’t have a meaningfully different plan for ${plan.destinationName} with these answers. Unlock some stops, change your interests, or try another destination.`
      : `We can’t suggest stops for ${plan.destinationName}. Staff will plan it with you.`,
  }
}

// ---------- Sample trip ----------

/** Six friends from Malolos to La Union, two days, beach and food, relaxed. Dates stay flexible. */
export const sampleAnswers = (): PlannerAnswers => ({
  destination: { mode: 'chosen', id: 'DST-LAUNION', text: '' },
  interests: ['Beach', 'Food'],
  group: { type: 'Barkada', size: 6, children: 0, seniors: 0 },
  dates: { mode: 'flexible', start: '', end: '', days: 2, window: dateWindows()[0] },
  budget: { basis: 'person', amount: 6000 },
  pickup: { city: 'Malolos, Bulacan', landmark: 'Malolos Cathedral' },
  pace: 'Relaxed',
  prefs: { mustVisit: '', lodging: 'Standard', accessibility: '', dietary: '', notes: 'Our first barkada trip in a while. We’d love a sunset by the beach.' },
})

/** A few starting points for "Suggest somewhere", near the pickup when possible. */
export const otherIdeas = (a: PlannerAnswers, catalog: Destination[]) => rankDestinations(a, catalog).slice(0, 3)

// ---------- Sending ----------

/** Dates for the request: the exact dates, or placeholders two weeks out when dates are still open. */
export function requestDates(a: PlannerAnswers, today = DEMO_TODAY) {
  const days = tripDays(a)
  if (a.dates.mode === 'exact') return { startDate: a.dates.start, endDate: a.dates.end, tbd: false }
  const start = addDays(today, 14)
  return { startDate: start, endDate: addDays(start, days - 1), tbd: true }
}

/** The plan as stored on the custom request, so staff see exactly what the customer saw. */
export function toPlannedTrip(plan: TripPlan, a: PlannerAnswers): PlannedTrip {
  const sched = schedule(plan, a)
  const est = estimate(plan, a)
  const timed = !!placeFor(plan.destinationId)
  return {
    source: 'planner',
    datesTbd: a.dates.mode !== 'exact' || undefined,
    datesNote: a.dates.mode === 'flexible' ? a.dates.window : a.dates.mode === 'undecided' ? 'Dates not decided yet' : undefined,
    days: plan.days.length,
    groupType: a.group.type || 'Other',
    children: a.group.children,
    seniors: a.group.seniors,
    budgetBasis: (a.budget.basis || 'help') as PlannedTrip['budgetBasis'],
    budgetAmount: a.budget.basis === 'help' ? undefined : (a.budget.amount ?? undefined),
    pace: paceOf(a),
    interests: [...a.interests],
    lodging: plan.lodging,
    mustVisit: a.prefs.mustVisit.trim() || undefined,
    accessibility: a.prefs.accessibility.trim() || undefined,
    dietary: a.prefs.dietary.trim() || undefined,
    reasons: whyItFits(plan, a, est),
    itinerary: sched.map((d) => ({
      day: d.day, date: d.date, label: d.label,
      items: d.items.filter((i) => !(i.kind === 'travel' && i.title === 'Short drive')).map((i) => ({ time: timed ? clock(i.start) : undefined, title: i.title, kind: i.kind, note: i.note, review: i.review })),
    })),
    stops: plan.days.flatMap((d, i) => d.map((s) => ({ name: s.name, day: i + 1, locked: s.locked || undefined, custom: s.custom || undefined }))),
    estimate: est.lines,
    total: est.total,
    perPerson: est.perPerson,
    issues: checkPlan(plan, a, sched, est).map((i) => i.title),
  }
}
