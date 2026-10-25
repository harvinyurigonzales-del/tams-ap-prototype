import { draftCustomProposal, PROPOSAL_VALID_DAYS, rentalEstimate } from '../domain/requests'
import { addDays, daysBetween, weekday } from '../lib/demoClock'
import { downPayment, seatUse } from '../domain/rules'
import type { Booking, Customer, CustomRequest, Dataset, Departure, Driver, Payment, RentalRequest, Vehicle } from './types'

// More sample records for the admin side: drivers, vans, other customers and their bookings, payments and
// requests. Everything is generated from a fixed seed, so the data is the same on every load, and every record
// follows the business rules: seats never exceed a departure's capacity, payments match each booking's status and
// total, and requests point to real customers. Maria (CUS-0001) gets nothing here; she starts with a clean account.
//
// Dates are written around the canonical "today" (2026-10-08) and move with the rest of the seed.

const TODAY = '2026-10-08'
const t = (date: string, time = '09:00') => `${date}T${time}:00+08:00`

/** Small deterministic random generator (mulberry32). */
function rng(seed: number) {
  let a = seed
  return () => {
    a = (a + 0x6d2b79f5) | 0
    let x = Math.imul(a ^ (a >>> 15), 1 | a)
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

const FIRST = [
  'Andrea', 'Bryan', 'Camille', 'Daniel', 'Erika', 'Francis', 'Gabriel', 'Hannah', 'Ivan', 'Jasmine', 'Kevin', 'Lea', 'Miguel', 'Nina', 'Oscar',
  'Pia', 'Rafael', 'Sofia', 'Tristan', 'Ursula', 'Vince', 'Wendy', 'Xavier', 'Yna', 'Zandro', 'Bea', 'Carlo', 'Diane', 'Enzo', 'Faith',
]
const LAST = [
  'Bautista', 'Castillo', 'Dizon', 'Espiritu', 'Fernandez', 'Gonzales', 'Hernandez', 'Ignacio', 'Javier', 'Lopez', 'Mercado', 'Navarro', 'Ocampo',
  'Perez', 'Quiambao', 'Rivera', 'Santiago', 'Tolentino', 'Umali', 'Valdez', 'Wenceslao', 'Yap', 'Zamora', 'Aguilar', 'Bernardo', 'Cabrera',
  'De Leon', 'Estrada', 'Francisco', 'Gatchalian',
]
const CITIES = [
  'Malolos, Bulacan', 'Meycauayan, Bulacan', 'Marilao, Bulacan', 'Bocaue, Bulacan', 'Baliwag, Bulacan', 'Plaridel, Bulacan', 'Quezon City',
  'Caloocan City', 'Valenzuela City', 'Manila', 'San Fernando, Pampanga', 'Santa Maria, Bulacan',
]

const DRIVERS: [string, string, string, string][] = [
  ['Noel Garcia', 'N02-18-551203', '2028-02-14', '2021-06-01'],
  ['Romeo Santiago', 'N01-16-330981', '2027-05-09', '2018-11-12'],
  ['Alvin Dizon', 'N03-19-774410', '2029-03-30', '2022-01-17'],
  ['Mario Lacson', 'N01-20-118254', '2028-09-21', '2023-02-06'],
  ['Felix Rosales', 'N04-17-902337', '2027-12-02', '2020-04-20'],
  ['Joseph Tan', 'N02-21-661049', '2030-01-11', '2024-03-04'],
  ['Ricardo Medina', 'N01-15-245780', '2027-07-27', '2017-08-28'],
]

const VANS: Omit<Vehicle, 'id' | 'name' | 'blocks'>[] = [
  { categoryId: 'CAT-STD', model: 'Toyota Hiace (2024)', plate: 'TMS 1007', seats: 12, color: 'White', odometer: 12840 },
  { categoryId: 'CAT-STD', model: 'Toyota Hiace (2024)', plate: 'TMS 1008', seats: 12, color: 'Silver', odometer: 15230 },
  { categoryId: 'CAT-PRM', model: 'Hyundai Staria (2024)', plate: 'TMS 1009', seats: 10, color: 'Black', odometer: 9870 },
  { categoryId: 'CAT-STD', model: 'Nissan Urvan (2023)', plate: 'TMS 1010', seats: 12, color: 'White', odometer: 33410 },
  { categoryId: 'CAT-STD', model: 'Toyota Hiace (2023)', plate: 'TMS 1011', seats: 12, color: 'Gray', odometer: 28760 },
  { categoryId: 'CAT-PRM', model: 'Hyundai Staria (2023)', plate: 'TMS 1012', seats: 10, color: 'White', odometer: 24120 },
  { categoryId: 'CAT-STD', model: 'Nissan Urvan (2022)', plate: 'TMS 1013', seats: 12, color: 'Silver', odometer: 47390 },
  { categoryId: 'CAT-STD', model: 'Toyota Hiace (2021)', plate: 'TMS 1014', seats: 12, color: 'White', odometer: 69850 },
  { categoryId: 'CAT-PRM', model: 'Toyota Granvia (2024)', plate: 'TMS 1015', seats: 8, color: 'Pearl white', odometer: 7410 },
]

const METHODS: Payment['method'][] = ['GCash', 'Maya', 'Bank transfer']
const PARTIES = [2, 2, 3, 4, 2, 5, 1, 3, 2, 4, 6, 2]

/** Adds the generated records to a copy of the canonical seed. */
export function expandDataset(src: Dataset): Dataset {
  const d = structuredClone(src) as Dataset
  const rand = rng(20261008)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]

  // ---------- People and fleet ----------
  const customers: Customer[] = FIRST.map((first, i) => {
    const n = 12 + i
    const last = LAST[i]
    return {
      id: `CUS-${String(n).padStart(4, '0')}`, name: `${first} ${last}`, email: `${first}.${last.replace(/\s/g, '')}@example.com`.toLowerCase(),
      mobile: `0900 555 ${String(100 + n).padStart(4, '0')}`, city: CITIES[i % CITIES.length], registered: addDays(TODAY, -40 - ((i * 23) % 420)), origin: 'seed',
    }
  })
  d.customers.push(...customers)
  d.next.customer = 12 + customers.length

  DRIVERS.forEach(([name, license, licenseExpiry, since], i) => {
    const id = `DRV-${String(6 + i).padStart(2, '0')}`
    const dr: Driver = { id, name, mobile: `0900 555 ${String(206 + i).padStart(4, '0')}`, blocks: [], license, licenseExpiry, since }
    d.drivers.push(dr)
  })
  // One driver is on leave over a weekend, so the assignment screen shows a real constraint.
  d.drivers.find((x) => x.id === 'DRV-09')!.blocks.push({ from: '2026-10-24', to: '2026-10-25', kind: 'leave', note: 'On leave' })
  VANS.forEach((v, i) => {
    const n = 7 + i
    d.vehicles.push({ id: `VAN-${String(n).padStart(2, '0')}`, name: `Van ${String(n).padStart(2, '0')}`, blocks: [], ...v })
  })

  // ---------- IDs ----------
  const used = (prefix: string, ids: string[]) => new Set(ids.filter((x) => x.startsWith(prefix)).map((x) => Number(x.slice(prefix.length))))
  const pool = (taken: Set<number>, below: number) => {
    let n = 0
    return () => {
      do n += 1
      while (taken.has(n) && n < below)
      if (n >= below) throw new Error('Sample data ran out of free IDs.')
      return n
    }
  }
  const bookingNo = pool(used('BK-2026-', d.bookings.map((b) => b.id)), d.next.booking)
  const paymentNo = pool(used('PAY-2026-', d.payments.map((p) => p.id)), d.next.payment)
  const customNo = pool(used('CR-2026-', d.customRequests.map((r) => r.id)), d.next.customRequest)
  const rentalNo = pool(used('VR-2026-', d.rentalRequests.map((r) => r.id)), d.next.rentalRequest)
  const bkId = () => `BK-2026-${String(bookingNo()).padStart(4, '0')}`
  const payId = () => `PAY-2026-${String(paymentNo()).padStart(4, '0')}`

  const tours = d.services.filter((s) => s.type === 'tour')
  const svc = (id: string) => d.services.find((s) => s.id === id)!
  const bookings: Booking[] = []
  const payments: Payment[] = []
  let who = 0
  const nextCustomer = () => customers[who++ % customers.length]

  const book = (dep: Departure, status: Booking['status'], pax: number, createdDaysBefore: number) => {
    const s = svc(dep.serviceId)
    const c = nextCustomer()
    const createdDate = addDays(dep.startDate, -createdDaysBefore) < TODAY ? addDays(dep.startDate, -createdDaysBefore) : addDays(TODAY, -1)
    const promoOff = dep.promo && createdDate <= dep.promo.bookBy ? dep.promo.amountOff : 0
    const total = (s.price - promoOff) * pax
    const hh = String(8 + Math.floor(rand() * 12)).padStart(2, '0')
    const mm = String(Math.floor(rand() * 60)).padStart(2, '0')
    const b: Booking = {
      id: bkId(), customerId: c.id, serviceId: s.id, departureId: dep.id, startDate: dep.startDate, endDate: dep.endDate, pax, unitPrice: s.price, promoOff, total,
      status, createdAt: t(createdDate, `${hh}:${mm}`), contactName: c.name, contactMobile: c.mobile, origin: 'seed',
    }
    bookings.push(b)
    return b
  }

  const paid = (b: Booking, kind: 'full' | 'down' | 'split' | 'submitted' | 'rejected') => {
    const day = b.createdAt.slice(0, 10)
    const method = pick(METHODS)
    const ref = () => (method === 'Bank transfer' ? `BT-${56000 + Math.floor(rand() * 3999)}` : method === 'Maya' ? `MY-${882000 + Math.floor(rand() * 9999)}` : `1009 ${4800 + Math.floor(rand() * 999)} ${1000 + Math.floor(rand() * 8999)}`)
    const p = (amount: number, type: Payment['type'], status: Payment['status'], on: string, extra: Partial<Payment> = {}): Payment => ({
      id: payId(), bookingId: b.id, amount, method, type, status, reference: ref(), submittedAt: t(on, '10:15'),
      reviewedAt: status === 'Submitted' ? undefined : t(addDays(on, 1) > TODAY ? on : addDays(on, 1), '14:00'), proof: 'sample', origin: 'seed', ...extra,
    })
    const down = downPayment(b.total)
    if (kind === 'full') payments.push(p(b.total, 'Full', 'Verified', day))
    if (kind === 'down') payments.push(p(down, 'Down payment', 'Verified', day))
    if (kind === 'split') {
      payments.push(p(down, 'Down payment', 'Verified', day))
      const bal = addDays(b.startDate, -4) < TODAY ? addDays(b.startDate, -4) : addDays(TODAY, -1)
      payments.push(p(b.total - down, 'Balance', 'Verified', bal > day ? bal : day))
    }
    if (kind === 'submitted') payments.push(p(down, 'Down payment', 'Submitted', addDays(TODAY, -1)))
    if (kind === 'rejected') payments.push(p(down, 'Down payment', 'Rejected', day, { rejectReason: 'The amount on the receipt does not match the down payment.' }))
    if (b.status !== 'Pending' && b.status !== 'Cancelled') b.confirmedAt = t(addDays(day, 1) > TODAY ? day : addDays(day, 1), '14:00')
  }

  // ---------- Past trips on their own departures ----------
  // Saturdays from July to early October, one tour each, with completed and a few cancelled bookings.
  const departures: Departure[] = []
  let sat = '2026-07-04'
  let k = 0
  while (sat <= '2026-10-03') {
    const s = tours[(k * 7) % tours.length]
    const id = `DEP-${s.id.slice(4)}-${sat.slice(5, 7)}${sat.slice(8, 10)}`
    if (!d.departures.some((x) => x.id === id) && addDays(sat, s.days - 1) < TODAY) {
      const dep: Departure = { id, serviceId: s.id, startDate: sat, endDate: addDays(sat, s.days - 1), capacity: 12 }
      departures.push(dep)
      const n = 2
      for (let j = 0; j < n; j++) {
        const cancelled = (k + j) % 9 === 4
        const b = book(dep, cancelled ? 'Cancelled' : 'Completed', PARTIES[(k + j) % PARTIES.length], 10 + ((k + j) * 5) % 20)
        if (cancelled) {
          b.cancelReason = 'Customer request: change of plans'
          b.cancelledAt = t(addDays(b.startDate, -5), '11:30')
        } else paid(b, (k + j) % 3 === 0 ? 'split' : 'full')
      }
    }
    sat = addDays(sat, 7)
    k += 1
  }
  d.departures.push(...departures)

  // ---------- Upcoming trips on the published departures ----------
  // Leave room on every departure (at most 8 of 12 seats held) and skip the dates the customer journey uses.
  const KEEP_FREE = new Set(['DEP-BAG-1017', 'DEP-TAG-1107'])
  const upcoming = d.departures.filter((x) => x.startDate > TODAY && !KEEP_FREE.has(x.id) && !departures.includes(x)).sort((a, b) => a.startDate.localeCompare(b.startDate))
  upcoming.forEach((dep, i) => {
    if (i % 3 !== 0 && i % 3 !== 1) return
    const held = () => seatUse(dep.id, [...d.bookings, ...bookings]).held
    const lead = daysBetween(TODAY, dep.startDate)
    const plan: Booking['status'][] = i % 6 === 0 ? ['Pending'] : ['Confirmed']
    for (const status of plan) {
      const pax = PARTIES[(i * 3) % PARTIES.length]
      if (held() + pax > 8) break
      const b = book(dep, status, pax, 6 + (i % 10))
      if (status === 'Confirmed') paid(b, lead <= 5 || i % 5 === 0 ? 'split' : i % 2 ? 'down' : 'full')
      else if (lead > 7) paid(b, i % 8 === 0 ? 'rejected' : 'submitted')
      else {
        // Too close to travel to still be waiting on a payment.
        b.status = 'Confirmed'
        paid(b, 'full')
      }
    }
  })

  // ---------- Van rentals ----------
  const rentals: [string, number, number, string, string, Booking['status']][] = [
    ['2026-07-18', 2, 9, 'Baliwag, Bulacan', 'Baguio City, Benguet', 'Completed'],
    ['2026-08-08', 1, 11, 'Quezon City', 'Nasugbu, Batangas', 'Completed'],
    ['2026-08-29', 3, 8, 'Malolos, Bulacan', 'Vigan City, Ilocos Sur', 'Completed'],
    ['2026-09-26', 1, 12, 'Valenzuela City', 'Subic Bay Freeport, Zambales', 'Completed'],
    ['2026-10-31', 2, 10, 'Marilao, Bulacan', 'San Juan, La Union', 'Confirmed'],
    ['2026-11-21', 1, 7, 'Manila', 'Tagaytay City, Cavite', 'Confirmed'],
  ]
  const van = svc('SVC-VAN')
  for (const [start, days, pax, pickup, destination, status] of rentals) {
    const c = nextCustomer()
    const created = addDays(start, -14) < TODAY ? addDays(start, -14) : addDays(TODAY, -3)
    const b: Booking = {
      id: bkId(), customerId: c.id, serviceId: van.id, startDate: start, endDate: addDays(start, days - 1), pax, unitPrice: van.price, promoOff: 0,
      total: van.price * days, status, createdAt: t(created, '15:20'), contactName: c.name, contactMobile: c.mobile, rental: { pickup, destination },
      label: `Standard van to ${destination}`, origin: 'seed',
    }
    bookings.push(b)
    paid(b, status === 'Completed' ? 'split' : 'down')
  }

  // ---------- Requests from other customers ----------
  const std = d.vehicleCategories[0]
  const custom = (destId: string, start: string, nights: number, size: number, status: CustomRequest['status'], daysAgo: number, note: string): CustomRequest => {
    const c = nextCustomer()
    const dest = d.destinations.find((x) => x.id === destId)!
    const at = t(addDays(TODAY, -daysAgo), '19:30')
    const r: CustomRequest = {
      id: `CR-2026-${String(customNo()).padStart(4, '0')}`, customerId: c.id, destinationId: destId, startDate: start, endDate: addDays(start, nights),
      flexibility: 'Exact dates', groupSize: size, pickup: c.city, budgetMin: 2500, budgetMax: 6000, interests: dest.interests.slice(0, 2), requests: note,
      contactName: c.name, contactMobile: c.mobile, status, createdAt: at, origin: 'seed', events: [{ at, status: 'Submitted', note: 'Request received.' }],
    }
    if (status !== 'Submitted') r.events.push({ at: t(addDays(TODAY, -daysAgo + 1), '09:20'), status: 'Under review', note: `Staff are checking lodging in ${dest.name}.` })
    if (status === 'Proposal ready') {
      const sent = t(addDays(TODAY, -1), '16:10')
      r.proposal = draftCustomProposal(r, dest, sent)
      r.events.push({ at: sent, status: 'Proposal ready', note: 'Proposal sent. Review it and accept or request changes.' })
    }
    if (status === 'Closed') r.events.push({ at: t(addDays(TODAY, -daysAgo + 3), '11:00'), status: 'Closed', note: 'Closed: the group postponed the trip to next year.' })
    return r
  }
  d.customRequests.push(
    custom('DST-SAGADA', '2026-11-27', 2, 5, 'Submitted', 1, 'Barkada trip, first time in Sagada.'),
    custom('DST-PAGUDPUD', '2026-12-26', 3, 7, 'Under review', 3, 'Family holiday after Christmas.'),
    custom('DST-LAUNION', '2026-11-13', 1, 4, 'Proposal ready', 6, 'Beginner surf lessons for two of us.'),
    custom('DST-BATANGAS', '2026-09-12', 1, 10, 'Closed', 40, 'Company outing.'),
  )

  const rental = (start: string, days: number, pax: number, pickup: string, dropoff: string, area: string, status: RentalRequest['status'], daysAgo: number): RentalRequest => {
    const c = nextCustomer()
    const w = { tripType: days > 1 ? ('Multi-day' as const) : ('Round trip (same day)' as const), startDate: start, startTime: '06:00', endDate: addDays(start, days - 1), endTime: '18:00' }
    const estimate = rentalEstimate(std, w)
    const at = t(addDays(TODAY, -daysAgo), '20:05')
    const r: RentalRequest = {
      id: `VR-2026-${String(rentalNo()).padStart(4, '0')}`, customerId: c.id, categoryId: std.id, ...w, pickupArea: 'Bulacan', pickup, dropoff, destinationArea: area,
      stops: [], passengers: pax, requests: '', contactName: c.name, contactMobile: c.mobile, estimate, status, createdAt: at, origin: 'seed',
      events: [{ at, status: 'Submitted', note: 'Request received.' }],
    }
    if (status !== 'Submitted') r.events.push({ at: t(addDays(TODAY, -daysAgo + 1), '10:00'), status: 'Under review', note: 'Staff are checking the route and van availability.' })
    if (status === 'Proposal ready') {
      const sent = t(addDays(TODAY, -1), '11:45')
      r.quote = { ...estimate, note: 'Confirmed as estimated.', validUntil: addDays(TODAY, PROPOSAL_VALID_DAYS - 1), sentAt: sent }
      r.events.push({ at: sent, status: 'Proposal ready', note: 'Quote sent. Accept it to continue to payment.' })
    }
    return r
  }
  d.rentalRequests.push(
    rental('2026-11-28', 2, 11, 'Plaridel, Bulacan', 'Baler, Aurora', 'Aurora', 'Submitted', 0),
    rental('2026-11-07', 1, 9, 'Quezon City', 'Tanay, Rizal', 'Rizal', 'Under review', 2),
    rental('2026-12-05', 2, 12, 'Meycauayan, Bulacan', 'Alaminos, Pangasinan', 'Pangasinan', 'Proposal ready', 4),
  )

  d.bookings.push(...bookings.sort((a, b) => a.id.localeCompare(b.id)))
  d.payments.push(...payments)

  // Staff alerts for the payments still waiting to be checked.
  for (const p of payments.filter((x) => x.status === 'Submitted')) {
    const b = bookings.find((x) => x.id === p.bookingId)!
    const c = customers.find((x) => x.id === b.customerId)!
    d.notifications.push({
      id: `NTF-${String(200 + d.notifications.length).padStart(4, '0')}`, at: p.submittedAt, category: 'Payments', title: 'Payment needs verification',
      body: `${b.id} (${c.name}) submitted ₱${p.amount.toLocaleString('en-PH')} via ${p.method}.`, link: `/admin/bookings?id=${b.id}`, read: false, origin: 'seed',
    })
  }
  d.notifications.sort((a, b) => b.at.localeCompare(a.at))
  d.next.notification = Math.max(d.next.notification, 200 + d.notifications.length + 1)
  // Saturdays only, so weekend tours stay on weekends after the seed is moved forward.
  if (departures.some((x) => weekday(x.startDate) !== 6)) throw new Error('Generated departures must fall on Saturdays.')
  return d
}
