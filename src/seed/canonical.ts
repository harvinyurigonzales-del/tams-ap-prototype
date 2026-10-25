import { draftCustomProposal, rentalEstimate } from '../domain/requests'
import { REVIEWS, SALES_HISTORY } from './reviews'
import type { Booking, CustomRequest, Dataset, Destination, Payment, RentalRequest, VehicleCategory } from './types'

// The one canonical definition of fictional data (spec section 9). Everything here is invented:
// emails use the reserved example.com domain and mobiles use the visibly fake 0900 555 range.

/** Records tagged with this scenario exist pre-seeded in the admin demo and are created live in the customer demo. */
export const MARIA_SCENARIO = 'maria-baguio-oct17'

const t = (date: string, time = '09:00') => `${date}T${time}:00+08:00`

function tour(
  id: string,
  customerId: string,
  departureId: string,
  serviceId: string,
  startDate: string,
  endDate: string,
  pax: number,
  unitPrice: number,
  promoOff: number,
  status: Booking['status'],
  createdAt: string,
  contactName: string,
  contactMobile: string,
  extra: Partial<Booking> = {},
): Booking {
  return {
    id, customerId, departureId, serviceId, startDate, endDate, pax, unitPrice, promoOff,
    total: (unitPrice - promoOff) * pax, status, createdAt, contactName, contactMobile, origin: 'seed', ...extra,
  }
}

function pay(
  id: string, bookingId: string, amount: number, method: Payment['method'], type: Payment['type'],
  status: Payment['status'], submittedAt: string, reviewedAt: string | undefined, reference: string,
  extra: Partial<Payment> = {},
): Payment {
  return { id, bookingId, amount, method, type, status, submittedAt, reviewedAt, reference, proof: 'sample', origin: 'seed', ...extra }
}

const ill = (slug: string, alt: string) => ({ src: `/images/destinations/${slug}.svg`, alt, kind: 'illustration' as const })

/** Luzon destinations. Two use photos supplied in the team's design file; the rest use bundled illustrations. */
const DESTINATIONS: Destination[] = [
  {
    id: 'DST-BAGUIO', name: 'Baguio', province: 'Benguet', interests: ['Cool weather', 'Nature', 'Food', 'Family'], bestMonths: 'November to April', travelTime: 'about 5 hours', suggestedDays: 2,
    summary: 'The Summer Capital: pine trees, cool air and strawberry farms.',
    overview: 'Baguio sits about 1,500 metres up in the Cordillera, so it stays cool all year. It is an easy first trip for families, with parks, markets and food stops close together.',
    highlights: ['Burnham Park boating', 'Mines View Park', 'Strawberry farm in La Trinidad', 'Session Road food crawl', 'BenCab Museum'],
    image: { src: '/images/destinations/baguio.jpg', alt: 'Boats on the lake at Burnham Park, Baguio', kind: 'supplied' },
  },
  {
    id: 'DST-TAGAYTAY', name: 'Tagaytay', province: 'Cavite', interests: ['Food', 'Nature', 'Relaxation', 'Family'], bestMonths: 'All year', travelTime: 'about 2 hours', suggestedDays: 1,
    summary: 'Ridge-top views of Taal Volcano, bulalo and cool breezes.',
    overview: 'Tagaytay is the classic day trip south of Manila. The ridge looks over Taal Lake and its volcano, with cafés, gardens and pasalubong shops along the way.',
    highlights: ['Taal Volcano viewpoints', 'Picnic Grove', 'People’s Park in the Sky', 'Bulalo lunch with a view', 'Sky Ranch'],
    image: ill('tagaytay', 'Illustration of Taal Volcano and lake seen from the Tagaytay ridge'),
  },
  {
    id: 'DST-VIGAN', name: 'Vigan', province: 'Ilocos Sur', interests: ['Heritage', 'Food', 'Photography'], bestMonths: 'November to May', travelTime: 'about 8 hours', suggestedDays: 3,
    summary: 'Cobblestone Calle Crisologo, kalesa rides and Ilocano food.',
    overview: 'Vigan is a UNESCO World Heritage city with Spanish-colonial houses that are still lived in. Evenings are best for walking Calle Crisologo and the dancing fountain show.',
    highlights: ['Calle Crisologo walk', 'Kalesa city tour', 'Bantay Bell Tower', 'Empanada and bagnet stops', 'Baluarte'],
    image: ill('vigan', 'Illustration of heritage houses and a kalesa on a cobblestone street in Vigan'),
  },
  {
    id: 'DST-CAVINTI', name: 'Pagsanjan Falls', province: 'Laguna', interests: ['Adventure', 'Nature'], bestMonths: 'June to February', travelTime: 'about 3 hours', suggestedDays: 1,
    summary: 'A boat ride up a gorge to one of Luzon’s best-known falls.',
    overview: 'Boatmen paddle visitors up the river gorge to Cavinti’s falls, where you can raft under the curtain of water. It makes a full, active day trip.',
    highlights: ['Gorge boat ride', 'Raft under the falls', 'Riverside lunch', 'Cavinti Underground River'],
    image: ill('cavinti', 'Illustration of a waterfall in a green gorge with a small boat'),
  },
  {
    id: 'DST-BATANGAS', name: 'San Juan, Batangas', province: 'Batangas', interests: ['Beach', 'Relaxation', 'Family'], bestMonths: 'March to June', travelTime: 'about 3 hours', suggestedDays: 1,
    summary: 'Long sandy beaches within a day trip of Manila.',
    overview: 'San Juan’s Laiya coast has wide beaches and resorts that take day guests. It suits families and barkadas who want an easy beach day.',
    highlights: ['Laiya beach day', 'Resort pools', 'Sunset by the shore', 'Seafood lunch'],
    image: ill('batangas', 'Illustration of a palm-lined beach with calm water'),
  },
  {
    id: 'DST-SAGADA', name: 'Sagada', province: 'Mountain Province', interests: ['Adventure', 'Nature', 'Cool weather', 'Photography'], bestMonths: 'November to April', travelTime: 'about 12 hours', suggestedDays: 3,
    summary: 'Sea of clouds, caves and pine forests in the Cordillera.',
    overview: 'Sagada rewards early risers with clouds filling the valleys at Kiltepan. Days are for caving, waterfalls and walks through pine forest; nights are cold.',
    highlights: ['Kiltepan sunrise', 'Sumaguing Cave', 'Echo Valley', 'Bomod-ok Falls', 'Lake Danum'],
    image: ill('sagada', 'Illustration of a sunrise over a sea of clouds and pine-covered mountains'),
  },
  {
    id: 'DST-BANAUE', name: 'Banaue', province: 'Ifugao', interests: ['Heritage', 'Nature', 'Photography', 'Adventure'], bestMonths: 'March to May, and October', travelTime: 'about 9 hours', suggestedDays: 3,
    summary: 'The Ifugao rice terraces, carved into the mountains by hand.',
    overview: 'Banaue is the gateway to the Ifugao rice terraces, part of a UNESCO World Heritage site. Viewpoints are an easy drive; Batad needs a guided hike.',
    highlights: ['Banaue viewpoint', 'Batad terraces hike', 'Tappiya Falls', 'Ifugao village visit', 'Hapao terraces'],
    image: { src: '/images/destinations/banaue.jpg', alt: 'Green rice terraces stepping down a mountainside', kind: 'supplied' },
  },
  {
    id: 'DST-BALER', name: 'Baler', province: 'Aurora', interests: ['Beach', 'Adventure', 'Heritage'], bestMonths: 'October to February for surf', travelTime: 'about 6 hours', suggestedDays: 2,
    summary: 'Surf breaks, the Balete tree and a quiet Pacific coast.',
    overview: 'Baler is where Philippine surfing began. Beginners can take lessons at Sabang Beach, and the town has heritage sites from the Spanish era.',
    highlights: ['Surf lesson at Sabang Beach', 'Millennium Balete Tree', 'Ditumabo Mother Falls', 'Museo de Baler'],
    image: ill('baler', 'Illustration of surf waves rolling onto a beach with mountains behind'),
  },
  {
    id: 'DST-LAUNION', name: 'San Juan, La Union', province: 'La Union', interests: ['Beach', 'Food', 'Relaxation'], bestMonths: 'October to March', travelTime: 'about 5 hours', suggestedDays: 2,
    summary: 'Relaxed surf town with cafés and sunsets over the West Philippine Sea.',
    overview: 'San Juan, La Union mixes surf schools, beach cafés and night markets. It is a favourite weekend escape for groups of friends.',
    highlights: ['Surf lesson at Urbiztondo', 'Sunset at the beach', 'Night market food', 'Tangadan Falls'],
    image: ill('launion', 'Illustration of a sunset over the sea with surfboards on the sand'),
  },
  {
    id: 'DST-HUNDRED', name: 'Hundred Islands', province: 'Pangasinan', interests: ['Beach', 'Nature', 'Family', 'Photography'], bestMonths: 'November to May', travelTime: 'about 5 hours', suggestedDays: 1,
    summary: 'Island-hopping among 124 limestone islets in the Lingayen Gulf.',
    overview: 'Hundred Islands National Park off Alaminos is best seen by bangka. Boats stop at Governor’s, Quezon and Children’s Island for swimming, snorkelling and the view deck.',
    highlights: ['Bangka island hopping', 'Governor’s Island view deck', 'Snorkelling at Quezon Island', 'Children’s Island shallows', 'Alaminos longganisa lunch'],
    image: ill('hundred-islands', 'Illustration of mushroom-shaped limestone islets in turquoise water with a bangka'),
  },
  {
    id: 'DST-ZAMBALES', name: 'Anawangin Cove', province: 'Zambales', interests: ['Beach', 'Adventure', 'Nature'], bestMonths: 'November to May', travelTime: 'about 4 hours', suggestedDays: 2,
    summary: 'A pine-fringed cove of grey sand, reached only by boat from Pundaquit.',
    overview: 'Anawangin is a camping cove backed by agoho trees and bare mountains near San Antonio, Zambales. There is no electricity, so nights are for bonfires and stars.',
    highlights: ['Boat ride from Pundaquit', 'Overnight beach camping', 'Capones Island lighthouse', 'Nagsasa Cove side trip', 'Bonfire and stargazing'],
    image: ill('zambales', 'Illustration of a cove with feathery pine trees, mountains and two tents'),
  },
  {
    id: 'DST-PGALERA', name: 'Puerto Galera', province: 'Oriental Mindoro', interests: ['Beach', 'Relaxation', 'Food', 'Adventure'], bestMonths: 'November to May', travelTime: 'about 4 hours, with a ferry from Batangas Port', suggestedDays: 3,
    summary: 'White Beach, coral reefs and bay views just across the Verde Island Passage.',
    overview: 'Puerto Galera is a ferry hop from Batangas Port. White Beach has the restaurants and nightlife; quieter coves and some of Luzon’s best snorkelling are a short boat ride away.',
    highlights: ['White Beach sunset', 'Snorkelling at Coral Garden', 'Tamaraw Falls', 'Muelle Bay', 'Island-hopping by bangka'],
    image: ill('puerto-galera', 'Illustration of a turquoise bay with outrigger boats, palms and green hills'),
  },
  {
    id: 'DST-PULAG', name: 'Mt. Pulag', province: 'Benguet', interests: ['Adventure', 'Nature', 'Cool weather', 'Photography'], bestMonths: 'November to March', travelTime: 'about 8 hours', suggestedDays: 3,
    summary: 'Luzon’s highest peak, famous for its sunrise over a sea of clouds.',
    overview: 'Mt. Pulag rises 2,926 metres above sea level in Kabayan, Benguet. The Ambangeg trail is beginner-friendly but cold: summit temperatures can drop near freezing before dawn. Park orientation is required.',
    highlights: ['Summit sunrise above the clouds', 'Dwarf-bamboo grasslands', 'DENR park orientation', 'Camp 2 overnight', 'Stargazing at the summit'],
    image: ill('pulag', 'Illustration of hikers on a grassy summit above a sea of clouds at dawn'),
  },
  {
    id: 'DST-PAGUDPUD', name: 'Pagudpud and Laoag', province: 'Ilocos Norte', interests: ['Beach', 'Heritage', 'Food', 'Photography'], bestMonths: 'November to May', travelTime: 'about 10 hours', suggestedDays: 4,
    summary: 'Bangui windmills, white rock formations and Paoay’s baroque church.',
    overview: 'The Ilocos Norte loop pairs the beaches of Pagudpud with heritage stops in Laoag and Paoay. Expect long drives with big rewards: the Bangui windmills, Kapurpurawan rocks and Saud Beach.',
    highlights: ['Bangui windmills', 'Kapurpurawan rock formation', 'Saud Beach', 'Paoay Church', 'Paoay sand dunes'],
    image: ill('pagudpud', 'Illustration of a coastline with white wind turbines and pale rock formations'),
  },
  {
    id: 'DST-BATAAN', name: 'Bataan', province: 'Bataan', interests: ['Heritage', 'Nature', 'Family'], bestMonths: 'All year', travelTime: 'about 3 hours', suggestedDays: 1,
    summary: 'Mt. Samat’s Shrine of Valor and the restored houses of Las Casas Filipinas.',
    overview: 'Bataan is a short drive from Manila with a lot of history. The Dambana ng Kagitingan on Mt. Samat honours the soldiers of World War II, and Las Casas Filipinas de Acuzar rebuilds Spanish-era houses by the sea.',
    highlights: ['Dambana ng Kagitingan on Mt. Samat', 'Las Casas Filipinas de Acuzar', 'Bataan World War II Museum', 'Balanga Cathedral', 'Seaside lunch'],
    image: ill('bataan', 'Illustration of a mountain topped by a large white cross above a bay with heritage houses'),
  },
]

/** Rental categories customers choose from. Staff assign the actual van after the booking is confirmed. */
const VEHICLE_CATEGORIES: VehicleCategory[] = [
  {
    id: 'CAT-STD', name: 'Standard van', models: 'Toyota Hiace or similar', seats: 12, ratePerDay: 6500,
    luggage: 'About 8 medium bags with a full group; more with fewer passengers',
    features: ['Air-conditioning', 'Reclining seats', 'Professional driver', 'Fuel included'],
    image: { src: '/images/vehicles/standard-van.svg', alt: 'Illustration of a white high-roof passenger van', kind: 'illustration' },
  },
  {
    id: 'CAT-PRM', name: 'Premium van', models: 'Hyundai Staria or similar', seats: 10, ratePerDay: 7500,
    luggage: 'About 6 medium bags with a full group',
    features: ['Air-conditioning', 'Captain seats in the second row', 'USB charging', 'Professional driver', 'Fuel included'],
    image: { src: '/images/vehicles/premium-van.svg', alt: 'Illustration of a modern people carrier', kind: 'illustration' },
  },
]

const dest = (id: string) => DESTINATIONS.find((d) => d.id === id)!

const CUSTOM_REQUESTS: CustomRequest[] = [
  {
    id: 'CR-2026-0004', customerId: 'CUS-0001', destinationId: 'DST-SAGADA', startDate: '2026-09-25', endDate: '2026-09-27', flexibility: 'Exact dates',
    groupSize: 2, pickup: 'Malolos, Bulacan', budgetMin: 3000, budgetMax: 5000, interests: ['Adventure', 'Nature'], requests: '',
    contactName: 'Maria Santos', contactMobile: '0900 555 0101', status: 'Closed', createdAt: t('2026-09-02', '18:30'), origin: 'seed',
    events: [
      { at: t('2026-09-02', '18:30'), status: 'Submitted', note: 'Request received.' },
      { at: t('2026-09-04', '10:00'), status: 'Closed', note: 'Closed at your request. You joined the Tagaytay Day Tour instead.' },
    ],
  },
  {
    id: 'CR-2026-0009', customerId: 'CUS-0001', destinationId: 'DST-VIGAN', startDate: '2026-12-12', endDate: '2026-12-14', flexibility: '± 3 days',
    groupSize: 6, pickup: 'Malolos, Bulacan', budgetMin: 4000, budgetMax: 6000, interests: ['Heritage', 'Food'], requests: 'Family reunion trip. Two children aged 7 and 10.',
    contactName: 'Maria Santos', contactMobile: '0900 555 0101', status: 'Under review', createdAt: t('2026-10-07', '19:40'), origin: 'seed',
    events: [
      { at: t('2026-10-07', '19:40'), status: 'Submitted', note: 'Request received.' },
      { at: t('2026-10-08', '08:15'), status: 'Under review', note: 'Staff are checking hotel rooms for six in Vigan.' },
    ],
  },
  {
    id: 'CR-2026-0011', customerId: 'CUS-0002', destinationId: 'DST-BALER', startDate: '2026-11-14', endDate: '2026-11-15', flexibility: 'Any weekend this month',
    groupSize: 8, pickup: 'San Jose del Monte, Bulacan', budgetMin: 3000, budgetMax: 4500, interests: ['Beach', 'Adventure'], requests: 'Surf lessons for beginners.',
    contactName: 'Juan Dela Cruz', contactMobile: '0900 555 0102', status: 'Submitted', createdAt: t('2026-10-08', '07:50'), origin: 'seed',
    events: [{ at: t('2026-10-08', '07:50'), status: 'Submitted', note: 'Request received.' }],
  },
  {
    id: 'CR-2026-0012', customerId: 'CUS-0001', destinationId: 'DST-BANAUE', startDate: '2026-11-20', endDate: '2026-11-22', flexibility: 'Exact dates',
    groupSize: 4, pickup: 'Malolos, Bulacan', budgetMin: 6000, budgetMax: 9000, interests: ['Nature', 'Photography', 'Heritage'],
    requests: 'Senior-friendly pace for Lola, with a rest stop about every two hours.',
    contactName: 'Maria Santos', contactMobile: '0900 555 0101', status: 'Proposal ready', createdAt: t('2026-10-01', '14:20'), origin: 'seed',
    events: [
      { at: t('2026-10-01', '14:20'), status: 'Submitted', note: 'Request received.' },
      { at: t('2026-10-02', '09:00'), status: 'Under review', note: 'Staff are checking lodging and guides in Banaue.' },
      { at: t('2026-10-06', '16:00'), status: 'Proposal ready', note: 'Proposal sent. Review it and accept or request changes.' },
    ],
  },
]
// Proposals follow the same pricing rule as the "simulate staff proposal" demo control.
CUSTOM_REQUESTS[3].proposal = draftCustomProposal(CUSTOM_REQUESTS[3], dest('DST-BANAUE'), t('2026-10-06', '16:00'))
CUSTOM_REQUESTS[1].draftProposal = draftCustomProposal(CUSTOM_REQUESTS[1], dest('DST-VIGAN'), t('2026-10-08', '09:30'))

const STD = VEHICLE_CATEGORIES[0]
const RENTAL_REQUESTS: RentalRequest[] = (() => {
  const joel = { tripType: 'Multi-day' as const, startDate: '2026-10-17', startTime: '05:00', endDate: '2026-10-18', endTime: '18:00' }
  const maria = { tripType: 'Multi-day' as const, startDate: '2026-10-24', startTime: '06:00', endDate: '2026-10-25', endTime: '17:00' }
  const joelEstimate = rentalEstimate(STD, joel)
  const mariaEstimate = rentalEstimate(STD, maria)
  return [
    {
      id: 'VR-2026-0001', customerId: 'CUS-0008', categoryId: 'CAT-STD', ...joel, pickupArea: 'Metro Manila', pickup: 'Caloocan City', dropoff: 'Baler, Aurora',
      destinationArea: 'Aurora', stops: [], passengers: 10, requests: 'Barkada surf weekend.', contactName: 'Joel Manalo', contactMobile: '0900 555 0108',
      estimate: joelEstimate,
      quote: {
        lines: [joelEstimate.lines[0]], total: joelEstimate.lines[0].amount, serviceDays: 2, notes: joelEstimate.notes,
        note: 'Driver overnight allowance waived for this returning customer.', validUntil: '2026-10-13', sentAt: t('2026-10-06', '08:30'),
      },
      status: 'Accepted', createdAt: t('2026-10-05', '20:00'), bookingId: 'BK-2026-0130', origin: 'seed',
      events: [
        { at: t('2026-10-05', '20:00'), status: 'Submitted', note: 'Request received.' },
        { at: t('2026-10-05', '21:00'), status: 'Under review', note: 'Staff are checking the route to Baler.' },
        { at: t('2026-10-06', '08:30'), status: 'Proposal ready', note: 'Quote sent: ₱13,000.' },
        { at: t('2026-10-06', '10:00'), status: 'Accepted', note: 'Quote accepted. Booking BK-2026-0130 created.' },
      ],
    },
    {
      id: 'VR-2026-0005', customerId: 'CUS-0001', categoryId: 'CAT-STD', ...maria, pickupArea: 'Bulacan', pickup: 'Malolos, Bulacan', dropoff: 'Morong, Bataan',
      destinationArea: 'Bataan', stops: ['Pasalubong stop in San Fernando, Pampanga'], passengers: 9, requests: 'Family beach weekend.',
      contactName: 'Maria Santos', contactMobile: '0900 555 0101', estimate: mariaEstimate,
      quote: { ...mariaEstimate, note: 'Confirmed as estimated. Tolls are paid along the way.', validUntil: '2026-10-12', sentAt: t('2026-10-07', '10:30') },
      status: 'Proposal ready', createdAt: t('2026-10-05', '21:10'), origin: 'seed',
      events: [
        { at: t('2026-10-05', '21:10'), status: 'Submitted', note: 'Request received.' },
        { at: t('2026-10-06', '09:00'), status: 'Under review', note: 'Staff are checking van availability for Oct 24–25.' },
        { at: t('2026-10-07', '10:30'), status: 'Proposal ready', note: 'Quote sent: ₱14,000. Accept it to continue to payment.' },
      ],
    },
  ]
})()

export const canonical: Dataset = Object.freeze<Dataset>({
  customers: [
    { id: 'CUS-0001', name: 'Maria Santos', email: 'maria.santos@example.com', mobile: '0900 555 0101', city: 'Malolos, Bulacan', registered: '2025-06-12', origin: 'seed' },
    { id: 'CUS-0002', name: 'Juan Dela Cruz', email: 'juan.delacruz@example.com', mobile: '0900 555 0102', city: 'San Jose del Monte, Bulacan', registered: '2025-08-03', origin: 'seed' },
    { id: 'CUS-0003', name: 'Angelica Reyes', email: 'angelica.reyes@example.com', mobile: '0900 555 0103', city: 'Bocaue, Bulacan', registered: '2026-01-15', origin: 'seed' },
    { id: 'CUS-0004', name: 'Mark Flores', email: 'mark.flores@example.com', mobile: '0900 555 0104', city: 'Calumpit, Bulacan', registered: '2026-02-20', origin: 'seed' },
    { id: 'CUS-0005', name: 'Teresa Domingo', email: 'teresa.domingo@example.com', mobile: '0900 555 0105', city: 'Meycauayan, Bulacan', registered: '2025-11-09', origin: 'seed' },
    { id: 'CUS-0006', name: 'Dennis Ramos', email: 'dennis.ramos@example.com', mobile: '0900 555 0106', city: 'Malolos, Bulacan', registered: '2026-03-02', origin: 'seed' },
    { id: 'CUS-0007', name: 'Nicole Pascual', email: 'nicole.pascual@example.com', mobile: '0900 555 0107', city: 'Quezon City', registered: '2026-04-18', origin: 'seed' },
    { id: 'CUS-0008', name: 'Joel Manalo', email: 'joel.manalo@example.com', mobile: '0900 555 0108', city: 'Caloocan City', registered: '2026-05-27', origin: 'seed' },
    { id: 'CUS-0009', name: 'Carlo Aquino', email: 'carlo.aquino@example.com', mobile: '0900 555 0109', city: 'Calumpit, Bulacan', registered: '2025-09-30', origin: 'seed' },
    { id: 'CUS-0010', name: 'Patricia Garcia', email: 'patricia.garcia@example.com', mobile: '0900 555 0110', city: 'San Jose del Monte, Bulacan', registered: '2026-06-05', origin: 'seed' },
    // A new customer with no trips, saved items or preferences, for the "no history" recommendation demo.
    { id: 'CUS-0011', name: 'Paolo Rivera', email: 'paolo.rivera@example.com', mobile: '0900 555 0111', city: 'Quezon City', registered: '2026-10-01', origin: 'seed' },
  ],
  destinations: DESTINATIONS,
  services: [
    {
      id: 'SVC-BAG', destinationId: 'DST-BAGUIO', interests: ['Cool weather', 'Nature', 'Food', 'Family'], name: 'Baguio Weekend Escape', type: 'tour', destination: 'Baguio City, Benguet', duration: '2 days / 1 night', days: 2,
      price: 2699, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '04:00',
      summary: 'Cool-weather weekend in the Summer Capital with a guided city tour.',
      itinerary: ['Day 1: Depart Manila, Mines View Park, Burnham Park, hotel check-in', 'Day 2: Strawberry farm, BenCab Museum stop, return to Manila by evening'],
      inclusions: ['Round-trip van', 'Hotel, twin sharing (1 night)', 'Guided city tour', 'Driver and fuel'],
      exclusions: ['Meals not listed', 'Entrance fees', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-TAG', destinationId: 'DST-TAGAYTAY', interests: ['Food', 'Nature', 'Relaxation', 'Family'], name: 'Tagaytay Day Tour', type: 'tour', destination: 'Tagaytay City, Cavite', duration: '1 day', days: 1,
      price: 1299, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '06:00',
      summary: 'Ridge views of Taal Volcano, a relaxed lunch and pasalubong stops.',
      itinerary: ['Morning: Picnic Grove and People’s Park in the Sky', 'Afternoon: lunch with Taal view, pasalubong stop, return by 7 PM'],
      inclusions: ['Round-trip van', 'Lunch', 'Driver and fuel'],
      exclusions: ['Entrance fees', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-VIG', destinationId: 'DST-VIGAN', interests: ['Heritage', 'Food', 'Photography'], name: 'Vigan Heritage Tour', type: 'tour', destination: 'Vigan City, Ilocos Sur', duration: '3 days / 2 nights', days: 3,
      price: 4800, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '21:00',
      summary: 'Overnight trip to Calle Crisologo with a kalesa ride and Ilocano food stops.',
      itinerary: ['Day 1: Overnight travel, arrive Vigan, hotel check-in', 'Day 2: Calle Crisologo, kalesa tour, Baluarte', 'Day 3: Bantay Bell Tower, return to Manila'],
      inclusions: ['Round-trip van', 'Hotel, twin sharing (2 nights)', 'Kalesa tour', 'Driver and fuel'],
      exclusions: ['Meals not listed', 'Entrance fees'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-PAG', destinationId: 'DST-CAVINTI', interests: ['Adventure', 'Nature'], name: 'Pagsanjan Falls Day Tour', type: 'tour', destination: 'Cavinti, Laguna', duration: '1 day', days: 1,
      price: 1650, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '05:00',
      summary: 'Boat ride up the gorge to the falls, with lunch by the river.',
      itinerary: ['Morning: travel to Laguna, boat ride to the falls', 'Afternoon: lunch, return to Manila by evening'],
      inclusions: ['Round-trip van', 'Boat ride', 'Lunch', 'Driver and fuel'],
      exclusions: ['Life vest rental', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-BAT', destinationId: 'DST-BATANGAS', interests: ['Beach', 'Relaxation', 'Family'], name: 'Batangas Beach Getaway', type: 'tour', destination: 'San Juan, Batangas', duration: '1 day', days: 1,
      price: 2950, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '04:30',
      summary: 'A full beach day at a partner resort with lunch included.',
      itinerary: ['Morning: travel to San Juan, resort day use', 'Afternoon: lunch, free time, return to Manila by night'],
      inclusions: ['Round-trip van', 'Resort day-use fee', 'Lunch', 'Driver and fuel'],
      exclusions: ['Cottage upgrade', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-VAN', name: 'Van Rental with Driver', type: 'van', destination: 'Anywhere in Luzon', duration: 'Per day', days: 1,
      price: 6500, unit: 'day', pickup: 'Your address in Metro Manila or Bulacan', pickupTime: '06:00',
      summary: 'A private van and driver for family trips, outings and transfers.',
      itinerary: ['You choose the route and schedule within 12 hours per day'],
      inclusions: ['Toyota Hiace (12 seats) or Hyundai Staria (10 seats)', 'Driver', 'Fuel'],
      exclusions: ['Tolls and parking', 'Driver meals and lodging for overnight trips'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-SAG', name: 'Sagada Highlands Escape', type: 'tour', destinationId: 'DST-SAGADA', interests: ['Adventure', 'Nature', 'Cool weather', 'Photography'],
      destination: 'Sagada, Mountain Province', duration: '3 days / 2 nights', days: 3,
      price: 4500, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '20:00',
      summary: 'Sunrise at Kiltepan, cave tours and pine-forest walks in the Cordillera.',
      itinerary: ['Day 1: Overnight travel, arrive Sagada, Echo Valley walk', 'Day 2: Kiltepan sunrise, Sumaguing Cave tour', 'Day 3: Lake Danum, return to Manila'],
      inclusions: ['Round-trip van', 'Inn, twin sharing (2 nights)', 'Local guide', 'Driver and fuel'],
      exclusions: ['Meals', 'Environmental fees', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-LU', destinationId: 'DST-LAUNION', interests: ['Beach', 'Food', 'Relaxation'], name: 'La Union Surf Weekend', type: 'tour', destination: 'San Juan, La Union', duration: '2 days / 1 night', days: 2,
      price: 3150, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '03:00',
      summary: 'A beginner surf lesson, sunset on the beach and the San Juan food scene.',
      itinerary: ['Day 1: Arrive San Juan, 1-hour surf lesson, check-in, sunset and night market', 'Day 2: Tangadan Falls, pasalubong stop, return to Manila by evening'],
      inclusions: ['Round-trip van', 'Beach hostel, quad sharing (1 night)', '1-hour surf lesson with board', 'Driver and fuel'],
      exclusions: ['Meals', 'Environmental and falls fees', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-BLR', destinationId: 'DST-BALER', interests: ['Beach', 'Adventure', 'Heritage'], name: 'Baler Surf and Falls', type: 'tour', destination: 'Baler, Aurora', duration: '2 days / 1 night', days: 2,
      price: 3400, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '02:00',
      summary: 'Surf where Philippine surfing began, then the Balete Tree and Ditumabo Falls.',
      itinerary: ['Day 1: Arrive Baler, surf lesson at Sabang Beach, Museo de Baler, check-in', 'Day 2: Ditumabo Mother Falls, Millennium Balete Tree, return to Manila'],
      inclusions: ['Round-trip van', 'Resort, quad sharing (1 night)', 'Surf lesson with board', 'Driver and fuel'],
      exclusions: ['Meals', 'Entrance fees', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-HUN', destinationId: 'DST-HUNDRED', interests: ['Beach', 'Nature', 'Family', 'Photography'], name: 'Hundred Islands Day Trip', type: 'tour', destination: 'Alaminos, Pangasinan', duration: '1 day', days: 1,
      price: 2250, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '02:00',
      summary: 'Early start, a full day of island hopping by bangka, and home by night.',
      itinerary: ['Morning: arrive Lucap Wharf, island hopping to Governor’s and Quezon Island', 'Afternoon: lunch on Children’s Island, swim and snorkel, return to Manila by 10 PM'],
      inclusions: ['Round-trip van', 'Shared island-hopping boat', 'Lunch', 'Driver and fuel'],
      exclusions: ['Snorkel gear rental', 'Environmental fee', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-ZAM', destinationId: 'DST-ZAMBALES', interests: ['Beach', 'Adventure', 'Nature'], name: 'Anawangin Cove Camping', type: 'tour', destination: 'San Antonio, Zambales', duration: '2 days / 1 night', days: 2,
      price: 2850, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '03:00',
      summary: 'Boat to a pine-lined cove, a night in tents and a stop at Capones lighthouse.',
      itinerary: ['Day 1: Boat from Pundaquit to Anawangin, set up camp, swim, bonfire dinner', 'Day 2: Capones Island lighthouse, Nagsasa Cove stop, return to Manila'],
      inclusions: ['Round-trip van', 'Boat transfers', 'Tent and sleeping mat', 'Dinner and breakfast', 'Driver and fuel'],
      exclusions: ['Lunch', 'Environmental fees', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-PGL', destinationId: 'DST-PGALERA', interests: ['Beach', 'Relaxation', 'Food', 'Adventure'], name: 'Puerto Galera Beach Escape', type: 'tour', destination: 'Puerto Galera, Oriental Mindoro', duration: '3 days / 2 nights', days: 3,
      price: 5200, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '04:00',
      summary: 'Ferry across to White Beach, a snorkelling island-hop and two easy nights by the sea.',
      itinerary: ['Day 1: Van to Batangas Port, ferry to Puerto Galera, White Beach check-in', 'Day 2: Island hopping and snorkelling at Coral Garden', 'Day 3: Tamaraw Falls stop, ferry and van back to Manila'],
      inclusions: ['Round-trip van', 'Round-trip ferry', 'Beach resort, twin sharing (2 nights)', 'Island-hopping boat', 'Driver and fuel'],
      exclusions: ['Meals', 'Terminal and environmental fees', 'Snorkel gear rental'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-PUL', destinationId: 'DST-PULAG', interests: ['Adventure', 'Nature', 'Cool weather', 'Photography'], name: 'Mt. Pulag Sea of Clouds Hike', type: 'tour', destination: 'Kabayan, Benguet', duration: '3 days / 2 nights', days: 3,
      price: 4950, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '20:00',
      summary: 'Beginner-friendly Ambangeg trail with a guided pre-dawn summit for sunrise.',
      itinerary: ['Day 1: Overnight travel, DENR orientation, hike to Camp 2', 'Day 2: 2 AM summit push, sunrise above the clouds, descend, homestay', 'Day 3: Breakfast in Kabayan, return to Manila'],
      inclusions: ['Round-trip van', 'Licensed mountain guide', 'Park and camping permits', 'Homestay (1 night) and tent (1 night)', 'Driver and fuel'],
      exclusions: ['Meals', 'Porter fees', 'Cold-weather gear'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-ILN', destinationId: 'DST-PAGUDPUD', interests: ['Beach', 'Heritage', 'Food', 'Photography'], name: 'Ilocos Norte Loop', type: 'tour', destination: 'Pagudpud and Laoag, Ilocos Norte', duration: '4 days / 3 nights', days: 4,
      price: 6800, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '19:00',
      summary: 'Bangui windmills, Kapurpurawan, Saud Beach and Paoay Church in one long-weekend loop.',
      itinerary: ['Day 1: Overnight travel, Paoay Church and sand dunes, Laoag check-in', 'Day 2: Kapurpurawan rocks, Bangui windmills, Pagudpud check-in', 'Day 3: Saud Beach day, Patapat viaduct viewpoint', 'Day 4: Pasalubong stop in Batac, return to Manila'],
      inclusions: ['Round-trip van', 'Hotel, twin sharing (3 nights)', 'Guided heritage stops', 'Driver and fuel'],
      exclusions: ['Meals', 'Entrance and dune buggy fees', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      id: 'SVC-BTN', destinationId: 'DST-BATAAN', interests: ['Heritage', 'Nature', 'Family'], name: 'Bataan Heritage Day Tour', type: 'tour', destination: 'Bataan', duration: '1 day', days: 1,
      price: 1890, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '05:00',
      summary: 'The Shrine of Valor on Mt. Samat and a guided walk through Las Casas Filipinas.',
      itinerary: ['Morning: Dambana ng Kagitingan and its museum on Mt. Samat', 'Afternoon: lunch, Las Casas Filipinas de Acuzar guided tour, return by 8 PM'],
      inclusions: ['Round-trip van', 'Las Casas day tour ticket', 'Lunch', 'Driver and fuel'],
      exclusions: ['Shrine elevator fee', 'Personal expenses'],
      tint: ['#1D3A7A', '#C8282F'],
    },
    {
      // Internal service for bookings created from accepted custom-trip proposals. Not shown in catalogs.
      id: 'SVC-CUSTOM', name: 'Custom trip', type: 'custom', destination: 'Per proposal', duration: 'Per proposal', days: 1,
      price: 0, unit: 'person', pickup: 'Per proposal', pickupTime: '06:00', summary: 'A private trip planned from a custom request.',
      itinerary: [], inclusions: [], exclusions: [], tint: ['#1D3A7A', '#C8282F'],
    },
  ],
  vehicleCategories: VEHICLE_CATEGORIES,
  departures: [
    { id: 'DEP-TAG-0919', serviceId: 'SVC-TAG', startDate: '2026-09-19', endDate: '2026-09-19', capacity: 12 },
    { id: 'DEP-BAG-1003', serviceId: 'SVC-BAG', startDate: '2026-10-03', endDate: '2026-10-04', capacity: 12 },
    { id: 'DEP-BAT-1009', serviceId: 'SVC-BAT', startDate: '2026-10-09', endDate: '2026-10-09', capacity: 12 },
    { id: 'DEP-BAG-1010', serviceId: 'SVC-BAG', startDate: '2026-10-10', endDate: '2026-10-11', capacity: 12 },
    { id: 'DEP-PAG-1011', serviceId: 'SVC-PAG', startDate: '2026-10-11', endDate: '2026-10-11', capacity: 12 },
    { id: 'DEP-VIG-1015', serviceId: 'SVC-VIG', startDate: '2026-10-15', endDate: '2026-10-17', capacity: 12 },
    {
      id: 'DEP-BAG-1017', serviceId: 'SVC-BAG', startDate: '2026-10-17', endDate: '2026-10-18', capacity: 12,
      promo: { amountOff: 200, bookBy: '2026-10-10', label: 'October Getaways' },
    },
    { id: 'DEP-TAG-1024', serviceId: 'SVC-TAG', startDate: '2026-10-24', endDate: '2026-10-24', capacity: 12 },
    { id: 'DEP-BAG-1024', serviceId: 'SVC-BAG', startDate: '2026-10-24', endDate: '2026-10-25', capacity: 12 },
    { id: 'DEP-BAG-1031', serviceId: 'SVC-BAG', startDate: '2026-10-31', endDate: '2026-11-01', capacity: 12 },
    { id: 'DEP-TAG-1107', serviceId: 'SVC-TAG', startDate: '2026-11-07', endDate: '2026-11-07', capacity: 12 },
    // More joiner departures across the new and existing tours.
    { id: 'DEP-BTN-1018', serviceId: 'SVC-BTN', startDate: '2026-10-18', endDate: '2026-10-18', capacity: 12 },
    { id: 'DEP-HUN-1017', serviceId: 'SVC-HUN', startDate: '2026-10-17', endDate: '2026-10-17', capacity: 12 },
    { id: 'DEP-LU-1017', serviceId: 'SVC-LU', startDate: '2026-10-17', endDate: '2026-10-18', capacity: 12 },
    { id: 'DEP-ZAM-1024', serviceId: 'SVC-ZAM', startDate: '2026-10-24', endDate: '2026-10-25', capacity: 12 },
    { id: 'DEP-PAG-1025', serviceId: 'SVC-PAG', startDate: '2026-10-25', endDate: '2026-10-25', capacity: 12 },
    { id: 'DEP-BLR-1031', serviceId: 'SVC-BLR', startDate: '2026-10-31', endDate: '2026-11-01', capacity: 12 },
    {
      id: 'DEP-HUN-1031', serviceId: 'SVC-HUN', startDate: '2026-10-31', endDate: '2026-10-31', capacity: 12,
      promo: { amountOff: 250, bookBy: '2026-10-20', label: 'Undas long weekend' },
    },
    { id: 'DEP-ILN-1030', serviceId: 'SVC-ILN', startDate: '2026-10-30', endDate: '2026-11-02', capacity: 12 },
    { id: 'DEP-PGL-1106', serviceId: 'SVC-PGL', startDate: '2026-11-06', endDate: '2026-11-08', capacity: 12 },
    { id: 'DEP-LU-1107', serviceId: 'SVC-LU', startDate: '2026-11-07', endDate: '2026-11-08', capacity: 12 },
    { id: 'DEP-BAT-1114', serviceId: 'SVC-BAT', startDate: '2026-11-14', endDate: '2026-11-14', capacity: 12 },
    { id: 'DEP-PUL-1113', serviceId: 'SVC-PUL', startDate: '2026-11-13', endDate: '2026-11-15', capacity: 12 },
    { id: 'DEP-BTN-1115', serviceId: 'SVC-BTN', startDate: '2026-11-15', endDate: '2026-11-15', capacity: 12 },
    { id: 'DEP-VIG-1119', serviceId: 'SVC-VIG', startDate: '2026-11-19', endDate: '2026-11-21', capacity: 12 },
    { id: 'DEP-ZAM-1121', serviceId: 'SVC-ZAM', startDate: '2026-11-21', endDate: '2026-11-22', capacity: 12 },
    { id: 'DEP-BAG-1128', serviceId: 'SVC-BAG', startDate: '2026-11-28', endDate: '2026-11-29', capacity: 12 },
    {
      id: 'DEP-PGL-1204', serviceId: 'SVC-PGL', startDate: '2026-12-04', endDate: '2026-12-06', capacity: 12,
      promo: { amountOff: 500, bookBy: '2026-10-31', label: 'Early bird' },
    },
    { id: 'DEP-PUL-1211', serviceId: 'SVC-PUL', startDate: '2026-12-11', endDate: '2026-12-13', capacity: 12 },
    { id: 'DEP-BLR-1212', serviceId: 'SVC-BLR', startDate: '2026-12-12', endDate: '2026-12-13', capacity: 12 },
  ],
  bookings: [
    tour('BK-2026-0098', 'CUS-0001', 'DEP-TAG-0919', 'SVC-TAG', '2026-09-19', '2026-09-19', 2, 1299, 0, 'Completed', t('2026-09-05', '10:20'), 'Maria Santos', '0900 555 0101', { confirmedAt: t('2026-09-05', '15:00') }),
    tour('BK-2026-0110', 'CUS-0007', 'DEP-BAG-1003', 'SVC-BAG', '2026-10-03', '2026-10-04', 3, 2699, 0, 'Completed', t('2026-09-14', '13:05'), 'Nicole Pascual', '0900 555 0107', { confirmedAt: t('2026-09-15', '10:00') }),
    tour('BK-2026-0116', 'CUS-0009', 'DEP-PAG-1011', 'SVC-PAG', '2026-10-11', '2026-10-11', 2, 1650, 0, 'Cancelled', t('2026-09-20', '18:40'), 'Carlo Aquino', '0900 555 0109', { cancelReason: 'Customer request: schedule conflict', cancelledAt: t('2026-10-02', '11:15') }),
    tour('BK-2026-0120', 'CUS-0005', 'DEP-BAG-1010', 'SVC-BAG', '2026-10-10', '2026-10-11', 4, 2699, 0, 'Confirmed', t('2026-09-22', '08:30'), 'Teresa Domingo', '0900 555 0105', { confirmedAt: t('2026-09-22', '14:00') }),
    tour('BK-2026-0122', 'CUS-0006', 'DEP-BAG-1010', 'SVC-BAG', '2026-10-10', '2026-10-11', 4, 2699, 0, 'Confirmed', t('2026-09-24', '19:10'), 'Dennis Ramos', '0900 555 0106', { confirmedAt: t('2026-09-25', '09:00') }),
    tour('BK-2026-0125', 'CUS-0010', 'DEP-BAG-1010', 'SVC-BAG', '2026-10-10', '2026-10-11', 4, 2699, 0, 'Confirmed', t('2026-09-26', '12:45'), 'Patricia Garcia', '0900 555 0110', { confirmedAt: t('2026-09-28', '10:30') }),
    tour('BK-2026-0127', 'CUS-0007', 'DEP-BAT-1009', 'SVC-BAT', '2026-10-09', '2026-10-09', 4, 2950, 0, 'Confirmed', t('2026-09-27', '16:20'), 'Nicole Pascual', '0900 555 0107', { confirmedAt: t('2026-09-28', '11:00') }),
    tour('BK-2026-0128', 'CUS-0004', 'DEP-VIG-1015', 'SVC-VIG', '2026-10-15', '2026-10-17', 2, 4800, 0, 'Pending', t('2026-10-05', '20:05'), 'Mark Flores', '0900 555 0104'),
    {
      id: 'BK-2026-0130', customerId: 'CUS-0008', serviceId: 'SVC-VAN', startDate: '2026-10-17', endDate: '2026-10-18', pax: 10,
      unitPrice: 6500, promoOff: 0, total: 13000, status: 'Confirmed', createdAt: t('2026-10-06', '10:00'), confirmedAt: t('2026-10-07', '14:20'),
      contactName: 'Joel Manalo', contactMobile: '0900 555 0108', rental: { pickup: 'Caloocan City', destination: 'Baler, Aurora' }, requestId: 'VR-2026-0001', origin: 'seed',
    },
    tour('BK-2026-0131', 'CUS-0002', 'DEP-BAG-1017', 'SVC-BAG', '2026-10-17', '2026-10-18', 2, 2699, 200, 'Confirmed', t('2026-09-28', '21:30'), 'Juan Dela Cruz', '0900 555 0102', { confirmedAt: t('2026-09-29', '10:00') }),
    tour('BK-2026-0135', 'CUS-0003', 'DEP-BAG-1017', 'SVC-BAG', '2026-10-17', '2026-10-18', 2, 2699, 200, 'Confirmed', t('2026-10-01', '09:40'), 'Angelica Reyes', '0900 555 0103', { confirmedAt: t('2026-10-02', '10:15') }),
    tour('BK-2026-0139', 'CUS-0008', 'DEP-BAG-1031', 'SVC-BAG', '2026-10-31', '2026-11-01', 6, 2699, 0, 'Confirmed', t('2026-10-02', '17:25'), 'Joel Manalo', '0900 555 0108', { confirmedAt: t('2026-10-03', '09:30') }),
    // Maria's confirmed upcoming trip, used for the pre-travel checklist.
    tour('BK-2026-0141', 'CUS-0001', 'DEP-TAG-1107', 'SVC-TAG', '2026-11-07', '2026-11-07', 2, 1299, 0, 'Confirmed', t('2026-10-05', '10:15'), 'Maria Santos', '0900 555 0101', { confirmedAt: t('2026-10-06', '11:00') }),
    tour('BK-2026-0148', 'CUS-0001', 'DEP-BAG-1017', 'SVC-BAG', '2026-10-17', '2026-10-18', 2, 2699, 200, 'Pending', t('2026-10-08', '09:31'), 'Maria Santos', '0900 555 0101', { scenario: MARIA_SCENARIO }),
  ],
  payments: [
    pay('PAY-2026-0151', 'BK-2026-0098', 2598, 'GCash', 'Full', 'Verified', t('2026-09-05', '10:30'), t('2026-09-05', '15:00'), '1009 4410 2231'),
    pay('PAY-2026-0160', 'BK-2026-0110', 8097, 'Bank transfer', 'Full', 'Verified', t('2026-09-14', '13:20'), t('2026-09-15', '10:00'), 'BT-55102'),
    pay('PAY-2026-0166', 'BK-2026-0120', 10796, 'GCash', 'Full', 'Verified', t('2026-09-22', '08:45'), t('2026-09-22', '14:00'), '1009 4521 7765'),
    pay('PAY-2026-0168', 'BK-2026-0122', 5398, 'Maya', 'Down payment', 'Verified', t('2026-09-24', '19:20'), t('2026-09-25', '09:00'), 'MY-880145'),
    pay('PAY-2026-0170', 'BK-2026-0125', 10796, 'Bank transfer', 'Full', 'Verified', t('2026-09-26', '13:00'), t('2026-09-28', '10:30'), 'BT-55188'),
    pay('PAY-2026-0172', 'BK-2026-0127', 11800, 'GCash', 'Full', 'Verified', t('2026-09-27', '16:40'), t('2026-09-28', '11:00'), '1009 4630 1189'),
    pay('PAY-2026-0174', 'BK-2026-0131', 4998, 'Bank transfer', 'Full', 'Verified', t('2026-09-28', '21:45'), t('2026-09-29', '10:00'), 'BT-55210'),
    pay('PAY-2026-0180', 'BK-2026-0135', 2499, 'GCash', 'Down payment', 'Verified', t('2026-10-01', '10:00'), t('2026-10-02', '10:15'), '1009 4702 5520'),
    pay('PAY-2026-0183', 'BK-2026-0139', 8097, 'GCash', 'Down payment', 'Verified', t('2026-10-02', '17:40'), t('2026-10-03', '09:30'), '1009 4733 0981'),
    pay('PAY-2026-0185', 'BK-2026-0141', 2598, 'GCash', 'Full', 'Verified', t('2026-10-05', '10:30'), t('2026-10-06', '11:00'), '1009 4790 3312'),
    pay('PAY-2026-0186', 'BK-2026-0122', 5398, 'Maya', 'Balance', 'Verified', t('2026-10-06', '12:10'), t('2026-10-07', '09:20'), 'MY-881902'),
    pay('PAY-2026-0188', 'BK-2026-0128', 4800, 'GCash', 'Down payment', 'Rejected', t('2026-10-05', '20:15'), t('2026-10-07', '16:40'), '1009 0000 1234', {
      rejectReason: 'Reference number does not match the GCash statement.',
    }),
    pay('PAY-2026-0190', 'BK-2026-0130', 6500, 'Bank transfer', 'Down payment', 'Verified', t('2026-10-06', '10:15'), t('2026-10-07', '14:15'), 'BT-55377'),
    pay('PAY-2026-0192', 'BK-2026-0148', 2499, 'GCash', 'Down payment', 'Submitted', t('2026-10-08', '09:32'), undefined, '1009 8822 5531', { scenario: MARIA_SCENARIO }),
  ],
  vehicles: [
    { id: 'VAN-01', categoryId: 'CAT-STD', name: 'Van 01', model: 'Toyota Hiace (2023)', plate: 'TMS 1001', seats: 12, blocks: [] },
    { id: 'VAN-02', categoryId: 'CAT-STD', name: 'Van 02', model: 'Toyota Hiace (2022)', plate: 'TMS 1002', seats: 12, blocks: [] },
    { id: 'VAN-03', categoryId: 'CAT-PRM', name: 'Van 03', model: 'Hyundai Staria (2023)', plate: 'TMS 1003', seats: 10, blocks: [{ from: '2026-10-08', to: '2026-10-10', kind: 'maintenance', note: 'Scheduled maintenance' }] },
    { id: 'VAN-04', categoryId: 'CAT-STD', name: 'Van 04', model: 'Toyota Hiace (2022)', plate: 'TMS 1004', seats: 12, blocks: [] },
    { id: 'VAN-05', categoryId: 'CAT-STD', name: 'Van 05', model: 'Toyota Hiace (2021)', plate: 'TMS 1005', seats: 12, blocks: [] },
    { id: 'VAN-06', categoryId: 'CAT-PRM', name: 'Van 06', model: 'Hyundai Staria (2022)', plate: 'TMS 1006', seats: 10, blocks: [{ from: '2026-10-01', to: '2026-10-20', kind: 'unavailable', note: 'Under repair' }] },
  ],
  drivers: [
    { id: 'DRV-01', name: 'Ramon Bautista', mobile: '0900 555 0201', blocks: [] },
    { id: 'DRV-02', name: 'Eduardo Villanueva', mobile: '0900 555 0202', blocks: [] },
    { id: 'DRV-03', name: 'Rogelio Cruz', mobile: '0900 555 0203', blocks: [] },
    { id: 'DRV-04', name: 'Arnel Mendoza', mobile: '0900 555 0204', blocks: [] },
    { id: 'DRV-05', name: 'Jun Pascua', mobile: '0900 555 0205', blocks: [{ from: '2026-10-16', to: '2026-10-18', kind: 'leave', note: 'On leave' }] },
  ],
  assignments: [
    { id: 'ASG-01', target: { kind: 'departure', id: 'DEP-BAT-1009' }, from: '2026-10-09', to: '2026-10-09', vehicleId: 'VAN-02', driverId: 'DRV-02', origin: 'seed' },
    { id: 'ASG-02', target: { kind: 'departure', id: 'DEP-BAG-1010' }, from: '2026-10-10', to: '2026-10-11', vehicleId: 'VAN-05', driverId: 'DRV-04', origin: 'seed' },
    { id: 'ASG-03', target: { kind: 'departure', id: 'DEP-BAG-1017' }, from: '2026-10-17', to: '2026-10-18', vehicleId: 'VAN-01', driverId: 'DRV-01', origin: 'seed' },
    { id: 'ASG-04', target: { kind: 'departure', id: 'DEP-BAG-1003' }, from: '2026-10-03', to: '2026-10-04', vehicleId: 'VAN-01', driverId: 'DRV-01', origin: 'seed' },
    { id: 'ASG-05', target: { kind: 'departure', id: 'DEP-TAG-0919' }, from: '2026-09-19', to: '2026-09-19', vehicleId: 'VAN-04', driverId: 'DRV-03', origin: 'seed' },
    { id: 'ASG-06', target: { kind: 'departure', id: 'DEP-TAG-1107' }, from: '2026-11-07', to: '2026-11-07', vehicleId: 'VAN-02', driverId: 'DRV-02', origin: 'seed' },
  ],
  customRequests: CUSTOM_REQUESTS,
  rentalRequests: RENTAL_REQUESTS,
  preferences: {
    'CUS-0001': { interests: ['Cool weather', 'Nature', 'Food'], budgetMax: 3000, duration: 'Weekend (2–3 days)', style: 'Any' },
  },
  saved: {
    'CUS-0001': [
      { kind: 'destination', id: 'DST-BANAUE' },
      { kind: 'tour', id: 'SVC-VIG' },
    ],
  },
  notifications: [
    { id: 'NTF-0107', at: t('2026-10-08', '09:32'), category: 'Payments', title: 'Payment needs verification', body: 'BK-2026-0148 (Maria Santos) submitted ₱2,499 via GCash.', link: '/admin/bookings?id=BK-2026-0148', read: false, origin: 'seed', scenario: MARIA_SCENARIO },
    { id: 'NTF-0106', at: t('2026-10-08', '09:31'), category: 'Bookings', title: 'New booking request', body: 'Maria Santos booked Baguio Weekend Escape for Oct 17, 2 pax.', link: '/admin/bookings?id=BK-2026-0148', read: false, origin: 'seed', scenario: MARIA_SCENARIO },
    { id: 'NTF-0105', at: t('2026-10-08', '08:00'), category: 'Travel', title: 'Trip departing tomorrow', body: 'Batangas Beach Getaway, Oct 9 · Van 02 with Eduardo Villanueva.', link: '/admin/calendar', read: false, origin: 'seed' },
    { id: 'NTF-0104', at: t('2026-10-08', '07:30'), category: 'Fleet', title: 'Van maintenance', body: 'Van 03 is in scheduled maintenance Oct 8–10.', link: '/admin/vehicles', read: true, origin: 'seed' },
    { id: 'NTF-0103', at: t('2026-10-07', '16:40'), category: 'Payments', title: 'Payment rejected', body: 'BK-2026-0128 (Mark Flores): reference number does not match the GCash statement.', link: '/admin/bookings?id=BK-2026-0128', read: true, origin: 'seed' },
    { id: 'NTF-0102', at: t('2026-10-07', '14:15'), category: 'Payments', title: 'Payment verified', body: 'BK-2026-0130 (Joel Manalo) down payment of ₱6,500.', link: '/admin/bookings?id=BK-2026-0130', read: true, origin: 'seed' },
    { id: 'NTF-0101', at: t('2026-10-02', '11:15'), category: 'Bookings', title: 'Booking cancelled', body: 'BK-2026-0116 (Carlo Aquino) cancelled at the customer’s request.', link: '/admin/bookings?id=BK-2026-0116', read: true, origin: 'seed' },
    { id: 'NTF-0003', at: t('2026-10-07', '10:30'), category: 'Bookings', title: 'Van rental quote ready', body: 'VR-2026-0005: your quote for Oct 24–25 is ₱14,000. Accept it to continue to payment.', link: '/app/rentals/VR-2026-0005', read: false, customerId: 'CUS-0001', origin: 'seed' },
    { id: 'NTF-0002', at: t('2026-10-06', '16:00'), category: 'Bookings', title: 'Custom trip proposal ready', body: 'CR-2026-0012: your Banaue proposal is ready to review.', link: '/app/custom/CR-2026-0012', read: false, customerId: 'CUS-0001', origin: 'seed' },
    { id: 'NTF-0004', at: t('2026-10-06', '11:00'), category: 'Bookings', title: 'Booking confirmed', body: 'BK-2026-0141 · Tagaytay Day Tour, Sat, Nov 7. Your payment is verified.', link: '/app/trips/BK-2026-0141', read: true, customerId: 'CUS-0001', origin: 'seed' },
    { id: 'NTF-0001', at: t('2026-09-19', '19:00'), category: 'Travel', title: 'Thanks for travelling with us', body: 'Your Tagaytay Day Tour is complete. We hope to see you again!', link: '/app/trips/BK-2026-0098', read: true, customerId: 'CUS-0001', origin: 'seed' },
  ],
  inquiries: [
    {
      id: 'INQ-001', customerId: 'CUS-0001', subject: 'Baguio packages', status: 'Awaiting staff', origin: 'seed',
      sampleReply: 'The Baguio Weekend Escape includes a round-trip van, one night of hotel (twin sharing), a guided city tour, and the driver and fuel. Meals not listed and entrance fees are not included.',
      messages: [
        { from: 'customer', at: t('2026-10-06', '10:24'), text: 'Hi! Do you have tour packages for Baguio?' },
        { from: 'staff', at: t('2026-10-06', '10:31'), text: 'Yes! Our Baguio Weekend Escape is 2 days / 1 night from ₱2,699 per person, with ₱200 off the Oct 17 departure if you book by Oct 10.' },
        { from: 'customer', at: t('2026-10-06', '10:35'), text: 'What’s included?' },
      ],
    },
    {
      id: 'INQ-002', customerId: 'CUS-0002', subject: 'Van rental rate', status: 'Awaiting staff', origin: 'seed',
      sampleReply: 'A standard van with driver is ₱6,500 per service day, including fuel. Tolls and parking are not included. Send a rental request and we will confirm the quote for your route.',
      messages: [{ from: 'customer', at: t('2026-10-07', '09:50'), text: 'How much is the van rental per day?' }],
    },
    {
      id: 'INQ-003', customerId: 'CUS-0007', subject: 'Pickup point', status: 'Awaiting staff', origin: 'seed',
      sampleReply: 'Joiner tours depart from SM North EDSA, Quezon City. The pickup time is shown on your booking.',
      messages: [{ from: 'customer', at: t('2026-10-07', '18:05'), text: 'Where is the pickup point for the Batangas trip?' }],
    },
    {
      // Escalated from the assistant about the seeded Banaue proposal.
      id: 'INQ-2026-0004', customerId: 'CUS-0001', subject: 'Senior-friendly pace for the Banaue trip', status: 'Awaiting staff', relatedRef: 'CR-2026-0012', origin: 'seed',
      sampleReply: 'Hi Maria, thanks for the details about your Lola. We can plan a rest stop about every two hours and ask the hotel for a ground-floor room. If anything changes the price, we will update your proposal before you accept.',
      messages: [
        { from: 'customer', at: t('2026-10-07', '20:12'), text: 'Can the Banaue itinerary be slower for my Lola (78)? She needs rest stops and a ground-floor room if possible.' },
      ],
    },
  ],
  replies: [
    { id: 'RPL-1', title: 'Package inclusions', text: 'The Baguio Weekend Escape includes a round-trip van, one night of hotel (twin sharing) and a guided city tour. Meals not listed and entrance fees are not included.' },
    { id: 'RPL-2', title: 'Payment methods', text: 'You can pay by GCash, Maya or bank transfer. A 50% down payment holds your booking; the balance is due 3 days before travel.' },
    { id: 'RPL-3', title: 'Booking process', text: 'Choose a trip and date in the app, submit your booking, then send your payment proof. We confirm once the payment is verified.' },
    { id: 'RPL-4', title: 'Van rental rate', text: 'Van rental with driver is ₱6,500 per day, including fuel. Tolls and parking are not included.' },
    { id: 'RPL-5', title: 'Pickup point', text: 'Joiner tours depart from SM North EDSA, Quezon City. The pickup time is shown on your booking.' },
  ],
  reviews: REVIEWS,
  salesHistory: SALES_HISTORY,
  next: { booking: 149, payment: 193, assignment: 7, notification: 108, customer: 12, customRequest: 13, rentalRequest: 7, inquiry: 5, review: 1501 },
})
