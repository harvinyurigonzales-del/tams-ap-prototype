import type { Booking, Dataset, Payment } from './types'

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

export const canonical: Dataset = Object.freeze({
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
  ],
  services: [
    {
      id: 'SVC-BAG', name: 'Baguio Weekend Escape', type: 'tour', destination: 'Baguio City, Benguet', duration: '2 days / 1 night', days: 2,
      price: 2699, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '04:00',
      summary: 'Cool-weather weekend in the Summer Capital with a guided city tour.',
      itinerary: ['Day 1: Depart Manila, Mines View Park, Burnham Park, hotel check-in', 'Day 2: Strawberry farm, BenCab Museum stop, return to Manila by evening'],
      inclusions: ['Round-trip van', 'Hotel, twin sharing (1 night)', 'Guided city tour', 'Driver and fuel'],
      exclusions: ['Meals not listed', 'Entrance fees', 'Personal expenses'],
      tint: ['#6F4FD8', '#2E9E6B'],
    },
    {
      id: 'SVC-TAG', name: 'Tagaytay Day Tour', type: 'tour', destination: 'Tagaytay City, Cavite', duration: '1 day', days: 1,
      price: 1299, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '06:00',
      summary: 'Ridge views of Taal Volcano, a relaxed lunch and pasalubong stops.',
      itinerary: ['Morning: Picnic Grove and People’s Park in the Sky', 'Afternoon: lunch with Taal view, pasalubong stop, return by 7 PM'],
      inclusions: ['Round-trip van', 'Lunch', 'Driver and fuel'],
      exclusions: ['Entrance fees', 'Personal expenses'],
      tint: ['#5B3CC4', '#E08A3C'],
    },
    {
      id: 'SVC-VIG', name: 'Vigan Heritage Tour', type: 'tour', destination: 'Vigan City, Ilocos Sur', duration: '3 days / 2 nights', days: 3,
      price: 4800, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '21:00',
      summary: 'Overnight trip to Calle Crisologo with a kalesa ride and Ilocano food stops.',
      itinerary: ['Day 1: Overnight travel, arrive Vigan, hotel check-in', 'Day 2: Calle Crisologo, kalesa tour, Baluarte', 'Day 3: Bantay Bell Tower, return to Manila'],
      inclusions: ['Round-trip van', 'Hotel, twin sharing (2 nights)', 'Kalesa tour', 'Driver and fuel'],
      exclusions: ['Meals not listed', 'Entrance fees'],
      tint: ['#4A2FA3', '#C2563B'],
    },
    {
      id: 'SVC-PAG', name: 'Pagsanjan Falls Day Tour', type: 'tour', destination: 'Cavinti, Laguna', duration: '1 day', days: 1,
      price: 1650, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '05:00',
      summary: 'Boat ride up the gorge to the falls, with lunch by the river.',
      itinerary: ['Morning: travel to Laguna, boat ride to the falls', 'Afternoon: lunch, return to Manila by evening'],
      inclusions: ['Round-trip van', 'Boat ride', 'Lunch', 'Driver and fuel'],
      exclusions: ['Life vest rental', 'Personal expenses'],
      tint: ['#3A2580', '#2E9E9E'],
    },
    {
      id: 'SVC-BAT', name: 'Batangas Beach Getaway', type: 'tour', destination: 'San Juan, Batangas', duration: '1 day', days: 1,
      price: 2950, unit: 'person', pickup: 'SM North EDSA, Quezon City', pickupTime: '04:30',
      summary: 'A full beach day at a partner resort with lunch included.',
      itinerary: ['Morning: travel to San Juan, resort day use', 'Afternoon: lunch, free time, return to Manila by night'],
      inclusions: ['Round-trip van', 'Resort day-use fee', 'Lunch', 'Driver and fuel'],
      exclusions: ['Cottage upgrade', 'Personal expenses'],
      tint: ['#6F4FD8', '#2B8FD6'],
    },
    {
      id: 'SVC-VAN', name: 'Van Rental with Driver', type: 'van', destination: 'Anywhere in Luzon', duration: 'Per day', days: 1,
      price: 6500, unit: 'day', pickup: 'Your address in Metro Manila or Bulacan', pickupTime: '06:00',
      summary: 'A private van and driver for family trips, outings and transfers.',
      itinerary: ['You choose the route and schedule within 12 hours per day'],
      inclusions: ['Toyota Hiace (12 seats) or Hyundai Staria (10 seats)', 'Driver', 'Fuel'],
      exclusions: ['Tolls and parking', 'Driver meals and lodging for overnight trips'],
      tint: ['#261854', '#6F4FD8'],
    },
  ],
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
      contactName: 'Joel Manalo', contactMobile: '0900 555 0108', rental: { pickup: 'Caloocan City', destination: 'Baler, Aurora' }, origin: 'seed',
    },
    tour('BK-2026-0131', 'CUS-0002', 'DEP-BAG-1017', 'SVC-BAG', '2026-10-17', '2026-10-18', 2, 2699, 200, 'Confirmed', t('2026-09-28', '21:30'), 'Juan Dela Cruz', '0900 555 0102', { confirmedAt: t('2026-09-29', '10:00') }),
    tour('BK-2026-0135', 'CUS-0003', 'DEP-BAG-1017', 'SVC-BAG', '2026-10-17', '2026-10-18', 2, 2699, 200, 'Confirmed', t('2026-10-01', '09:40'), 'Angelica Reyes', '0900 555 0103', { confirmedAt: t('2026-10-02', '10:15') }),
    tour('BK-2026-0139', 'CUS-0008', 'DEP-BAG-1031', 'SVC-BAG', '2026-10-31', '2026-11-01', 6, 2699, 0, 'Confirmed', t('2026-10-02', '17:25'), 'Joel Manalo', '0900 555 0108', { confirmedAt: t('2026-10-03', '09:30') }),
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
    pay('PAY-2026-0186', 'BK-2026-0122', 5398, 'Maya', 'Balance', 'Verified', t('2026-10-06', '12:10'), t('2026-10-07', '09:20'), 'MY-881902'),
    pay('PAY-2026-0188', 'BK-2026-0128', 4800, 'GCash', 'Down payment', 'Rejected', t('2026-10-05', '20:15'), t('2026-10-07', '16:40'), '1009 0000 1234', {
      rejectReason: 'Reference number does not match the GCash statement.',
    }),
    pay('PAY-2026-0190', 'BK-2026-0130', 6500, 'Bank transfer', 'Down payment', 'Verified', t('2026-10-06', '10:15'), t('2026-10-07', '14:15'), 'BT-55377'),
    pay('PAY-2026-0192', 'BK-2026-0148', 2499, 'GCash', 'Down payment', 'Submitted', t('2026-10-08', '09:32'), undefined, '1009 8822 5531', { scenario: MARIA_SCENARIO }),
  ],
  vehicles: [
    { id: 'VAN-01', name: 'Van 01', model: 'Toyota Hiace (2023)', plate: 'TMS 1001', seats: 12, blocks: [] },
    { id: 'VAN-02', name: 'Van 02', model: 'Toyota Hiace (2022)', plate: 'TMS 1002', seats: 12, blocks: [] },
    { id: 'VAN-03', name: 'Van 03', model: 'Hyundai Staria (2023)', plate: 'TMS 1003', seats: 10, blocks: [{ from: '2026-10-08', to: '2026-10-10', kind: 'maintenance', note: 'Scheduled maintenance' }] },
    { id: 'VAN-04', name: 'Van 04', model: 'Toyota Hiace (2022)', plate: 'TMS 1004', seats: 12, blocks: [] },
    { id: 'VAN-05', name: 'Van 05', model: 'Toyota Hiace (2021)', plate: 'TMS 1005', seats: 12, blocks: [] },
    { id: 'VAN-06', name: 'Van 06', model: 'Hyundai Staria (2022)', plate: 'TMS 1006', seats: 10, blocks: [{ from: '2026-10-01', to: '2026-10-20', kind: 'unavailable', note: 'Under repair' }] },
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
  ],
  notifications: [
    { id: 'NTF-0107', at: t('2026-10-08', '09:32'), category: 'Payments', title: 'Payment needs verification', body: 'BK-2026-0148 (Maria Santos) submitted ₱2,499 via GCash.', link: '/admin/bookings?id=BK-2026-0148', read: false, origin: 'seed', scenario: MARIA_SCENARIO },
    { id: 'NTF-0106', at: t('2026-10-08', '09:31'), category: 'Bookings', title: 'New booking request', body: 'Maria Santos booked Baguio Weekend Escape for Oct 17, 2 pax.', link: '/admin/bookings?id=BK-2026-0148', read: false, origin: 'seed', scenario: MARIA_SCENARIO },
    { id: 'NTF-0105', at: t('2026-10-08', '08:00'), category: 'Travel', title: 'Trip departing tomorrow', body: 'Batangas Beach Getaway, Oct 9 · Van 02 with Eduardo Villanueva.', link: '/admin/calendar', read: false, origin: 'seed' },
    { id: 'NTF-0104', at: t('2026-10-08', '07:30'), category: 'Fleet', title: 'Van maintenance', body: 'Van 03 is in scheduled maintenance Oct 8–10.', link: '/admin/vehicles', read: true, origin: 'seed' },
    { id: 'NTF-0103', at: t('2026-10-07', '16:40'), category: 'Payments', title: 'Payment rejected', body: 'BK-2026-0128 (Mark Flores): reference number does not match the GCash statement.', link: '/admin/bookings?id=BK-2026-0128', read: true, origin: 'seed' },
    { id: 'NTF-0102', at: t('2026-10-07', '14:15'), category: 'Payments', title: 'Payment verified', body: 'BK-2026-0130 (Joel Manalo) down payment of ₱6,500.', link: '/admin/bookings?id=BK-2026-0130', read: true, origin: 'seed' },
    { id: 'NTF-0101', at: t('2026-10-02', '11:15'), category: 'Bookings', title: 'Booking cancelled', body: 'BK-2026-0116 (Carlo Aquino) cancelled at the customer’s request.', link: '/admin/bookings?id=BK-2026-0116', read: true, origin: 'seed' },
    { id: 'NTF-0001', at: t('2026-09-19', '19:00'), category: 'Travel', title: 'Thanks for travelling with us', body: 'Your Tagaytay Day Tour is complete. We hope to see you again!', link: '/app/trips/BK-2026-0098', read: true, customerId: 'CUS-0001', origin: 'seed' },
  ],
  inquiries: [
    {
      id: 'INQ-001', customerId: 'CUS-0001', subject: 'Baguio packages',
      messages: [
        { from: 'customer', at: t('2026-10-06', '10:24'), text: 'Hi! Do you have tour packages for Baguio?' },
        { from: 'staff', at: t('2026-10-06', '10:31'), text: 'Yes! Our Baguio Weekend Escape is 2 days / 1 night from ₱2,699 per person, with ₱200 off the Oct 17 departure if you book by Oct 10.' },
        { from: 'customer', at: t('2026-10-06', '10:35'), text: 'What’s included?' },
      ],
    },
    { id: 'INQ-002', customerId: 'CUS-0002', subject: 'Van rental rate', messages: [{ from: 'customer', at: t('2026-10-07', '09:50'), text: 'How much is the van rental per day?' }] },
    { id: 'INQ-003', customerId: 'CUS-0007', subject: 'Pickup point', messages: [{ from: 'customer', at: t('2026-10-07', '18:05'), text: 'Where is the pickup point for the Batangas trip?' }] },
  ],
  replies: [
    { id: 'RPL-1', title: 'Package inclusions', text: 'The Baguio Weekend Escape includes a round-trip van, one night of hotel (twin sharing) and a guided city tour. Meals not listed and entrance fees are not included.' },
    { id: 'RPL-2', title: 'Payment methods', text: 'You can pay by GCash, Maya or bank transfer. A 50% down payment holds your booking; the balance is due 3 days before travel.' },
    { id: 'RPL-3', title: 'Booking process', text: 'Choose a trip and date in the app, submit your booking, then send your payment proof. We confirm once the payment is verified.' },
    { id: 'RPL-4', title: 'Van rental rate', text: 'Van rental with driver is ₱6,500 per day, including fuel. Tolls and parking are not included.' },
    { id: 'RPL-5', title: 'Pickup point', text: 'Joiner tours depart from SM North EDSA, Quezon City. The pickup time is shown on your booking.' },
  ],
  next: { booking: 149, payment: 193, assignment: 6, notification: 108, customer: 11 },
}) as Dataset
