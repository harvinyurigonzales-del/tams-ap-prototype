import { addDays, DEMO_TODAY, weekday } from '../lib/demoClock'
import type { Dataset, Departure, Service } from './types'

// Seasonal and occasion packages. The occasion is a marketing label kept apart from the departure dates, which are
// ordinary editable schedules: nothing here claims a date is an official holiday. Dates are picked relative to today
// so the examples stay upcoming whenever the prototype is opened.

const PICKUP = 'SM North EDSA, Quezon City'

/** First date on or after `from` that falls on `day` (0 = Sunday). */
const onOrAfter = (from: string, day: number) => addDays(from, (day - weekday(from) + 7) % 7)

/** The next `MM-DD` that is at least `lead` days away. */
function upcoming(mmdd: string, lead = 10) {
  const year = +DEMO_TODAY.slice(0, 4)
  for (const y of [year, year + 1, year + 2]) {
    const d = `${y}-${mmdd}`
    if (d >= addDays(DEMO_TODAY, lead)) return d
  }
  return `${year + 1}-${mmdd}`
}

/** Easter Sunday (Gregorian), used only to place the Holy Week example near the right week. */
export function easter(y: number) {
  const a = y % 19
  const b = Math.floor(y / 100)
  const c = y % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function nextEaster(lead = 10) {
  const y = +DEMO_TODAY.slice(0, 4)
  return [y, y + 1, y + 2].map(easter).find((d) => addDays(d, -6) >= addDays(DEMO_TODAY, lead))!
}

const base = (x: Omit<Service, 'type' | 'unit' | 'tint' | 'pickup' | 'priceBasis' | 'capacity'> & Partial<Service>): Service => ({
  type: 'tour', unit: 'person', priceBasis: 'person', capacity: 12, pickup: PICKUP, tint: ['#1D3A7A', '#C8282F'], ...x,
})

export function seasonalPackages(): { services: Service[]; departures: Departure[] } {
  const dec = upcoming('12-10')
  const bagFri = [onOrAfter(dec, 5), addDays(onOrAfter(dec, 5), 7)]
  const jan = upcoming('01-02', 7)
  const zamb = onOrAfter(upcoming('04-15', 14), 6)
  const holy = nextEaster()
  const lu = onOrAfter(addDays(DEMO_TODAY, 18), 5)

  const services: Service[] = [
    base({
      id: 'SVC-XBAG', destinationId: 'DST-BAGUIO', name: 'Paskong Baguio Getaway', destination: 'Baguio City, Benguet', season: 'Christmas season',
      duration: '3 days / 2 nights', days: 3, price: 7499, pickupTime: '04:00', status: 'Active', interests: ['Cool weather', 'Family', 'Food', 'Photography'],
      summary: 'Three cool December days in Baguio with the Christmas lights, Night Market and a strawberry farm morning.',
      description: 'A relaxed holiday-season trip for families and barkadas. Evenings are free for the lights at Burnham Park and the Session Road night market; days follow a light, unhurried route.',
      itinerary: [
        'Day 1: Depart Manila, lunch stop in Tarlac, hotel check-in, evening at Burnham Park lights',
        'Day 2: Mines View Park, Wright Park, Baguio Cathedral, Night Market on Harrison Road',
        'Day 3: La Trinidad strawberry farm, BenCab Museum stop, return to Manila by evening',
      ],
      inclusions: ['Round-trip van', 'Hotel, twin sharing (2 nights)', 'Daily breakfast', 'Tour coordinator', 'Driver, fuel and tolls'],
      exclusions: ['Lunch and dinner', 'Entrance fees', 'Personal expenses'],
    }),
    base({
      id: 'SVC-XTNY', destinationId: 'DST-TANAY', name: 'New Year, New Views', destination: 'Tanay, Rizal', season: 'New Year',
      duration: '1 day', days: 1, price: 2299, pickupTime: '02:30', status: 'Active', interests: ['Nature', 'Photography', 'Cool weather', 'Adventure'],
      summary: 'Start the year above the clouds: an early sunrise at Tanay’s viewpoints, a falls stop and a hearty lunch.',
      description: 'An early-morning day trip for the first days of January. Sea-of-clouds views depend on the weather, so the guide picks the viewpoint on the day.',
      itinerary: ['Sunrise at a Marilaque viewpoint', 'Breakfast at a roadside café', 'Daranak Falls swim stop', 'Late lunch, return to Manila by mid-afternoon'],
      inclusions: ['Round-trip van', 'Breakfast and lunch', 'Guide', 'Driver, fuel and tolls'],
      exclusions: ['Environmental and entrance fees', 'Personal expenses'],
    }),
    base({
      id: 'SVC-XZAM', destinationId: 'DST-ZAMBALES', name: 'Zambales Summer Escape', destination: 'San Antonio, Zambales', season: 'Summer',
      duration: '2 days / 1 night', days: 2, price: 3999, pickupTime: '03:00', status: 'Active', interests: ['Beach', 'Adventure', 'Nature', 'Relaxation'],
      summary: 'A summer weekend of cove camping, island hopping to Capones and a sunset on the Zambales coast.',
      itinerary: ['Day 1: Depart Manila, Pundaquit boat to Anawangin Cove, set up camp, sunset by the beach', 'Day 2: Capones Island lighthouse, Camara Island sandbar, return to Manila by evening'],
      inclusions: ['Round-trip van', 'Boat transfers and island hopping', 'Tent (2 per tent)', 'Dinner and breakfast', 'Driver and fuel'],
      exclusions: ['Environmental fees', 'Lunch', 'Personal expenses'],
    }),
    base({
      id: 'SVC-XTAL', destinationId: 'DST-TAAL', name: 'Holy Week Family Getaway', destination: 'Taal, Batangas', season: 'Holy Week',
      duration: '1 day', days: 1, price: 2499, pickupTime: '05:00', status: 'Draft', interests: ['Heritage', 'Family', 'Food'],
      summary: 'A gentle family day in heritage Taal: the basilica, ancestral houses, a long lunch and a Tagaytay stop on the way home.',
      description: 'Paced for families with children and seniors, with short walks and air-conditioned breaks. The departure dates are a draft: check them against this year’s calendar before activating.',
      itinerary: ['Taal Basilica and Our Lady of Caysasay', 'Ancestral houses walk with a local guide', 'Lunch of Batangas lomi and tapang Taal', 'Coffee stop in Tagaytay, return to Manila by early evening'],
      inclusions: ['Round-trip van', 'Lunch', 'Local guide', 'Driver, fuel and tolls'],
      exclusions: ['Museum and house entrance fees', 'Personal expenses'],
      datesUnreviewed: true,
    }),
    base({
      id: 'SVC-XLU', destinationId: 'DST-LAUNION', name: 'La Union Long Weekend Escape', destination: 'San Juan, La Union', season: 'Long weekend',
      duration: '3 days / 2 nights', days: 3, price: 6499, pickupTime: '04:00', status: 'Active', interests: ['Beach', 'Food', 'Relaxation'],
      summary: 'Three easy days in San Juan: a beginner surf lesson, food crawls and a waterfall morning, timed for a three-day weekend.',
      itinerary: [
        'Day 1: Depart Manila, check in near Urbiztondo, sunset on the beach',
        'Day 2: Beginner surf lesson, Tangadan Falls, evening food crawl',
        'Day 3: Grape farm or Halo-halo stop in Bauang, return to Manila by evening',
      ],
      inclusions: ['Round-trip van', 'Beach hotel, twin sharing (2 nights)', 'Daily breakfast', 'One surf lesson with board', 'Driver and fuel'],
      exclusions: ['Lunch and dinner', 'Environmental fees', 'Personal expenses'],
    }),
  ]
  for (const s of services) s.inactive = s.status !== 'Active'

  const dep = (serviceId: string, startDate: string, days: number): Departure => ({
    id: `DEP-${serviceId.slice(4)}-${startDate.slice(5, 7)}${startDate.slice(8, 10)}`, serviceId, startDate, endDate: addDays(startDate, days - 1), capacity: 12,
  })
  const departures = [
    ...bagFri.map((d) => dep('SVC-XBAG', d, 3)),
    dep('SVC-XTNY', jan, 1),
    dep('SVC-XTNY', addDays(jan, 1), 1),
    dep('SVC-XZAM', zamb, 2),
    dep('SVC-XZAM', addDays(zamb, 14), 2),
    dep('SVC-XTAL', addDays(holy, -6), 1),
    dep('SVC-XTAL', addDays(holy, -5), 1),
    dep('SVC-XLU', lu, 3),
    dep('SVC-XLU', addDays(lu, 21), 3),
  ]
  return { services, departures }
}

/** Adds the seasonal examples to a dataset, skipping any that already exist. */
export function addSeasonal(d: Dataset) {
  const { services, departures } = seasonalPackages()
  const add = services.filter((s) => !d.services.some((x) => x.id === s.id))
  const ids = new Set(add.map((s) => s.id))
  // Keep the special services (van rental, custom trip) last, as the catalog lists them.
  const at = d.services.findIndex((s) => s.type !== 'tour')
  d.services.splice(at < 0 ? d.services.length : at, 0, ...add)
  d.departures.push(...departures.filter((x) => ids.has(x.serviceId) && !d.departures.some((y) => y.id === x.id)))
}
