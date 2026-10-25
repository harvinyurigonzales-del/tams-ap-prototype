import type { MonthlySales, Review } from './types'

// Fictional public reviews from earlier departures. Every reviewer is invented. For this demo the seeded
// reviews are all 4 or 5 stars; anyone can still leave a lower rating after a completed trip.

const at = (date: string, time = '19:00') => `${date}T${time}:00+08:00`

type Seed = Omit<Review, 'origin' | 'createdAt'> & { createdAt?: string }

/** Reviews default to being written three days after the trip. */
const after = (date: string, days: number) => new Date(Date.parse(`${date}T12:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10)
const r = (x: Seed): Review => ({ createdAt: at(after(x.travelDate, 3)), origin: 'seed', ...x })

export const REVIEWS: Review[] = [
  // Baguio Weekend Escape
  r({ id: 'RV-0101', serviceId: 'SVC-BAG', name: 'Nicole P.', city: 'Quezon City', customerId: 'CUS-0007', bookingId: 'BK-2026-0110', rating: 5, party: 'Friends', travelDate: '2026-10-03', createdAt: at('2026-10-05', '20:14'),
    title: 'Sulit for a first Baguio trip', text: 'Everything ran on time, from the 4 AM pickup to the hotel check-in. Our guide knew where to park near Mines View so we didn’t waste the morning. The strawberry farm stop was the highlight for us.' }),
  r({ id: 'RV-0102', serviceId: 'SVC-BAG', name: 'Ramil D.', city: 'Malolos', rating: 5, party: 'Family', travelDate: '2026-02-14',
    title: 'Lola enjoyed it too', text: 'We brought my 74-year-old mother and the pace was just right. Driver was patient with bathroom stops. Hotel was clean and walking distance to Session Road.',
    staffReply: { text: 'Salamat, Ramil! Please say hi to Nanay for us. See you on the next family trip.', at: at('2026-03-01', '10:12') } }),
  r({ id: 'RV-0103', serviceId: 'SVC-BAG', name: 'Kat V.', city: 'Caloocan', rating: 4, party: 'Couple', travelDate: '2025-12-06',
    title: 'Great weekend, tight Day 2', text: 'Loved the cool weather and the city tour. Day 2 felt a little rushed because traffic going up Kennon was heavy.',
    suggestion: 'Maybe leave La Trinidad 30 minutes earlier so we can still stop for pasalubong without rushing.',
    staffReply: { text: 'Thanks for this, Kat. We moved the Day 2 departure to 1 PM for the December runs.', at: at('2026-01-03', '09:40') } }),
  r({ id: 'RV-0104', serviceId: 'SVC-BAG', name: 'Paul S.', city: 'Meycauayan', rating: 5, party: 'Officemates', travelDate: '2026-03-21',
    title: 'Team outing done right', text: 'Eight of us from the office joined and it was easy. Clear schedule, comfortable van and the BenCab stop was a nice surprise.' }),
  r({ id: 'RV-0105', serviceId: 'SVC-BAG', name: 'Grace L.', city: 'Bocaue', rating: 5, party: 'Family', travelDate: '2026-05-09',
    title: 'Kids loved Burnham Park', text: 'Boating at Burnham was the kids’ favourite. Good value for the price since hotel and van were already covered.' }),
  r({ id: 'RV-0106', serviceId: 'SVC-BAG', name: 'Jerome A.', city: 'San Jose del Monte', rating: 4, party: 'Solo', travelDate: '2026-01-17',
    title: 'Solo joiner, felt welcome', text: 'Joined alone and got paired with a friendly roommate. Would have liked a bit more free time on Session Road, but overall a solid trip.' }),
  r({ id: 'RV-0107', serviceId: 'SVC-BAG', name: 'Mae T.', city: 'Quezon City', rating: 5, party: 'Friends', travelDate: '2025-11-22',
    title: 'Babalik kami', text: 'Third trip with TAMS AP and still consistent. Safe driving, clean van and the hotel was better than expected.' }),

  // Tagaytay Day Tour
  r({ id: 'RV-0201', serviceId: 'SVC-TAG', name: 'Liza M.', city: 'Malolos', rating: 5, party: 'Family', travelDate: '2026-08-15',
    title: 'Easy day trip with the kids', text: 'Picked up on time, home before 7 PM. The lunch with a view of Taal was worth it, and the bulalo was hot and generous.' }),
  r({ id: 'RV-0202', serviceId: 'SVC-TAG', name: 'Ben C.', city: 'Calumpit', rating: 4, party: 'Couple', travelDate: '2026-06-20',
    title: 'Relaxing, a bit crowded', text: 'People’s Park was crowded on a Saturday but our guide timed the stops well. Good for a quick break from the city.',
    suggestion: 'A weekday departure would be nice for people who can take a leave.' }),
  r({ id: 'RV-0203', serviceId: 'SVC-TAG', name: 'Ana R.', city: 'Quezon City', rating: 5, party: 'Friends', travelDate: '2026-04-11',
    title: 'Perfect barkada day', text: 'Affordable and stress-free. We just showed up at SM North and everything else was handled.' }),
  r({ id: 'RV-0204', serviceId: 'SVC-TAG', name: 'Victor N.', city: 'Bocaue', rating: 5, party: 'Family', travelDate: '2026-02-28',
    title: 'Great for seniors', text: 'My parents are in their 70s and they enjoyed it. Not too much walking and plenty of rest stops.',
    staffReply: { text: 'Thank you, Victor! We’re glad your parents had a comfortable day.', at: at('2026-03-04', '11:05') } }),
  r({ id: 'RV-0205', serviceId: 'SVC-TAG', name: 'Joy F.', city: 'Meycauayan', rating: 4, party: 'Officemates', travelDate: '2025-12-13',
    title: 'Good value', text: 'Lunch was included which made it really sulit. Pasalubong stop was short but fine.' }),
  r({ id: 'RV-0206', serviceId: 'SVC-TAG', name: 'Arvin G.', city: 'Caloocan', rating: 5, party: 'Couple', travelDate: '2026-09-12',
    title: 'Clear skies, clear schedule', text: 'We saw Taal Volcano perfectly. The itinerary was clear from the start, no surprise fees.' }),

  // Vigan Heritage Tour
  r({ id: 'RV-0301', serviceId: 'SVC-VIG', name: 'Christine O.', city: 'Quezon City', rating: 5, party: 'Friends', travelDate: '2026-01-29',
    title: 'Calle Crisologo at night is magical', text: 'Long drive but the van was comfortable enough to sleep. The kalesa tour and Baluarte were fun, and we ate empanada every day.' }),
  r({ id: 'RV-0302', serviceId: 'SVC-VIG', name: 'Dante B.', city: 'Malolos', rating: 4, party: 'Couple', travelDate: '2025-11-13',
    title: 'Beautiful city, long ride', text: 'Vigan is worth it. The overnight trip is tiring, so bring a neck pillow.',
    suggestion: 'Please add a short stop at the Bantay church on Day 2 instead of Day 3 so we have more time.' }),
  r({ id: 'RV-0303', serviceId: 'SVC-VIG', name: 'Mylene S.', city: 'Bocaue', rating: 5, party: 'Family', travelDate: '2026-04-02',
    title: 'Holy Week trip done well', text: 'Even during Holy Week, the team kept us on schedule. The hotel was right in the heritage zone.',
    staffReply: { text: 'Thank you, Mylene. Holy Week is our busiest run, so this means a lot to the team.', at: at('2026-04-12', '09:20') } }),
  r({ id: 'RV-0304', serviceId: 'SVC-VIG', name: 'Ian P.', city: 'San Jose del Monte', rating: 5, party: 'Solo', travelDate: '2026-05-21',
    title: 'Great for photography', text: 'Golden hour on Calle Crisologo was unreal. The guide even pointed out the best angles.' }),
  r({ id: 'RV-0305', serviceId: 'SVC-VIG', name: 'Rowena K.', city: 'Caloocan', rating: 4, party: 'Friends', travelDate: '2026-08-27',
    title: 'Masarap ang pagkain', text: 'Bagnet, longganisa and okoy everywhere. Rainy season so some stops were wet, but still enjoyed it.' }),

  // Pagsanjan Falls Day Tour
  r({ id: 'RV-0401', serviceId: 'SVC-PAG', name: 'Eric J.', city: 'Quezon City', rating: 5, party: 'Friends', travelDate: '2026-07-18',
    title: 'Exciting boat ride', text: 'The boatmen were skilled and kept us safe. Rafting under the falls was the best part. Lunch by the river was simple but good.' }),
  r({ id: 'RV-0402', serviceId: 'SVC-PAG', name: 'Rina A.', city: 'Malolos', rating: 4, party: 'Couple', travelDate: '2026-02-07',
    title: 'Bring extra clothes', text: 'You will get wet! Fun day trip, well organised.',
    suggestion: 'Mention in the reminders to bring a dry bag and slippers.',
    staffReply: { text: 'Great tip, Rina. We’ve added dry bag and slippers to the pre-trip checklist.', at: at('2026-02-12', '14:30') } }),
  r({ id: 'RV-0403', serviceId: 'SVC-PAG', name: 'Mark Q.', city: 'Calumpit', rating: 5, party: 'Family', travelDate: '2025-10-25',
    title: 'Adventure for the whole family', text: 'Our teens loved it. Guide briefed us well on safety before the ride.' }),
  r({ id: 'RV-0404', serviceId: 'SVC-PAG', name: 'Sheila V.', city: 'Bocaue', rating: 4, party: 'Officemates', travelDate: '2026-09-05',
    title: 'Good team activity', text: 'Something different from the usual beach outing. Life vest rental was extra but cheap.' }),

  // Batangas Beach Getaway
  r({ id: 'RV-0501', serviceId: 'SVC-BAT', name: 'Lea H.', city: 'Quezon City', rating: 5, party: 'Friends', travelDate: '2026-04-25',
    title: 'Laiya was beautiful', text: 'Clean resort, clear water and lunch was included. Easy summer day trip.' }),
  r({ id: 'RV-0502', serviceId: 'SVC-BAT', name: 'Noel E.', city: 'Meycauayan', rating: 4, party: 'Family', travelDate: '2026-05-16',
    title: 'Kids had a blast', text: 'The pool and the beach kept the kids busy. Ride home was long because of traffic.',
    suggestion: 'Leaving the resort an hour earlier could beat the Sunday traffic.' }),
  r({ id: 'RV-0503', serviceId: 'SVC-BAT', name: 'Ivy D.', city: 'Caloocan', rating: 5, party: 'Couple', travelDate: '2026-03-14',
    title: 'Sulit na sulit', text: 'For the price, with lunch and day-use fee included, this was a steal.' }),
  r({ id: 'RV-0504', serviceId: 'SVC-BAT', name: 'Jun M.', city: 'Malolos', rating: 4, party: 'Officemates', travelDate: '2026-06-06',
    title: 'Good outing', text: 'Weather was cloudy but still fun. Staff were helpful in arranging a cottage upgrade.' }),

  // Sagada Highlands Escape
  r({ id: 'RV-0601', serviceId: 'SVC-SAG', name: 'Patrick Y.', city: 'Quezon City', rating: 5, party: 'Friends', travelDate: '2026-01-08',
    title: 'Sea of clouds, check!', text: 'We got a perfect sea of clouds at Kiltepan. Sumaguing Cave was challenging but our local guide was excellent.' }),
  r({ id: 'RV-0602', serviceId: 'SVC-SAG', name: 'Hannah B.', city: 'Bocaue', rating: 5, party: 'Solo', travelDate: '2025-12-27',
    title: 'Best way to end the year', text: 'Cold, peaceful and beautiful. The inn was cozy and the group was fun.' }),
  r({ id: 'RV-0603', serviceId: 'SVC-SAG', name: 'Glenn F.', city: 'San Jose del Monte', rating: 4, party: 'Couple', travelDate: '2026-03-05',
    title: 'Long trip, worth it', text: 'It’s a 12-hour drive so be ready. Once there, everything was well arranged.',
    suggestion: 'Please open more Sagada dates. We wanted to bring friends but couldn’t find a slot.',
    staffReply: { text: 'Thanks, Glenn. We’re finalising new Sagada dates for the cool season and will post them soon.', at: at('2026-03-18', '16:00') } }),
  r({ id: 'RV-0604', serviceId: 'SVC-SAG', name: 'Toni R.', city: 'Malolos', rating: 5, party: 'Friends', travelDate: '2026-02-19',
    title: 'Magical Echo Valley', text: 'Hanging coffins, caves and pine forests. Our guide shared a lot about Igorot culture respectfully.' }),

  // La Union Surf Weekend
  r({ id: 'RV-0701', serviceId: 'SVC-LU', name: 'Bea C.', city: 'Quezon City', rating: 5, party: 'Friends', travelDate: '2026-02-21',
    title: 'Stood up on my first try!', text: 'The surf instructors were patient. Night market food was great and the hostel was clean.' }),
  r({ id: 'RV-0702', serviceId: 'SVC-LU', name: 'Josh W.', city: 'Caloocan', rating: 4, party: 'Friends', travelDate: '2025-11-08',
    title: 'Chill weekend', text: 'Exactly what we needed. Tangadan Falls on Day 2 was a nice bonus.',
    suggestion: 'Offer an optional second surf lesson on Day 2.' }),
  r({ id: 'RV-0703', serviceId: 'SVC-LU', name: 'Kris A.', city: 'Malolos', rating: 5, party: 'Couple', travelDate: '2026-03-28',
    title: 'Sunset was unreal', text: 'The best sunset we’ve seen in years. Easy, organised trip.' }),

  // Baler Surf and Falls
  r({ id: 'RV-0801', serviceId: 'SVC-BLR', name: 'Migs T.', city: 'San Jose del Monte', rating: 5, party: 'Friends', travelDate: '2025-12-13',
    title: 'Big waves, big fun', text: 'December swell was perfect for learning. Ditumabo Falls was so refreshing after.' }),
  r({ id: 'RV-0802', serviceId: 'SVC-BLR', name: 'Celine G.', city: 'Bocaue', rating: 4, party: 'Couple', travelDate: '2026-01-24',
    title: 'Worth the early call time', text: '2 AM pickup is tough, but we arrived in time to surf before lunch.' }),
  r({ id: 'RV-0803', serviceId: 'SVC-BLR', name: 'Ronald P.', city: 'Quezon City', rating: 5, party: 'Family', travelDate: '2026-04-18',
    title: 'History and beach in one', text: 'Museo de Baler and the Balete Tree were a hit with the kids. Smooth trip.' }),

  // Hundred Islands Day Trip
  r({ id: 'RV-0901', serviceId: 'SVC-HUN', name: 'Aileen S.', city: 'Calumpit', rating: 5, party: 'Family', travelDate: '2026-04-04',
    title: 'Island hopping without the hassle', text: 'The boat was arranged ahead so we skipped the long queue at Lucap. Children’s Island was perfect for the kids.' }),
  r({ id: 'RV-0902', serviceId: 'SVC-HUN', name: 'Darren L.', city: 'Quezon City', rating: 4, party: 'Friends', travelDate: '2026-05-23',
    title: 'Long day but fun', text: 'It is a full day, so sleep on the van. Snorkelling at Quezon Island was good.',
    suggestion: 'Include snorkel gear in the package. Renting on-site took time.' }),
  r({ id: 'RV-0903', serviceId: 'SVC-HUN', name: 'Mica R.', city: 'Malolos', rating: 5, party: 'Couple', travelDate: '2026-03-07',
    title: 'Amazing views', text: 'The view deck at Governor’s Island was breathtaking. Lunch was filling.' }),

  // Anawangin Cove Camping
  r({ id: 'RV-1001', serviceId: 'SVC-ZAM', name: 'Lance V.', city: 'Caloocan', rating: 5, party: 'Friends', travelDate: '2026-02-07',
    title: 'Bonfire under the stars', text: 'No signal, just the beach and the stars. Tents were already set up when we arrived. Highly recommend for barkadas.' }),
  r({ id: 'RV-1002', serviceId: 'SVC-ZAM', name: 'Trish M.', city: 'Bocaue', rating: 4, party: 'Friends', travelDate: '2026-03-21',
    title: 'Rustic but fun', text: 'It’s camping so expect basic toilets. Food was hearty and the Capones lighthouse view was worth the climb.',
    staffReply: { text: 'Thanks for the honest review, Trish. We now include a camping kit list in the reminders.', at: at('2026-03-30', '10:45') } }),
  r({ id: 'RV-1003', serviceId: 'SVC-ZAM', name: 'Oliver D.', city: 'Quezon City', rating: 5, party: 'Officemates', travelDate: '2026-04-30',
    title: 'Best team building', text: 'Different from the usual resort outing. Everyone is still talking about it.' }),

  // Puerto Galera Beach Escape
  r({ id: 'RV-1101', serviceId: 'SVC-PGL', name: 'Sam E.', city: 'Meycauayan', rating: 5, party: 'Couple', travelDate: '2026-05-01',
    title: 'Ferry, beach, repeat', text: 'Transfers were seamless, even the ferry tickets were handled. Coral Garden snorkelling was the highlight.' }),
  r({ id: 'RV-1102', serviceId: 'SVC-PGL', name: 'Carmela N.', city: 'Quezon City', rating: 4, party: 'Friends', travelDate: '2026-03-13',
    title: 'Fun White Beach nights', text: 'Resort was a short walk from White Beach. Would love one more free afternoon.',
    suggestion: 'Make the Tamaraw Falls stop optional for those who prefer more beach time.' }),

  // Mt. Pulag Sea of Clouds Hike
  r({ id: 'RV-1201', serviceId: 'SVC-PUL', name: 'Ken O.', city: 'Malolos', rating: 5, party: 'Friends', travelDate: '2026-01-15',
    title: 'Bucket list done', text: 'Freezing at the summit but the sunrise above the clouds made me cry. Guides were professional and very safety-minded.' }),
  r({ id: 'RV-1202', serviceId: 'SVC-PUL', name: 'Abby J.', city: 'San Jose del Monte', rating: 5, party: 'Solo', travelDate: '2025-12-04',
    title: 'Beginner-friendly', text: 'First major climb and I made it. The orientation and homestay were well organised.' }),
  r({ id: 'RV-1203', serviceId: 'SVC-PUL', name: 'Rod C.', city: 'Caloocan', rating: 4, party: 'Friends', travelDate: '2026-02-26',
    title: 'Prepare for the cold', text: 'Bring proper layers. The trip itself was smooth.',
    suggestion: 'A list of where to rent cold-weather gear would help first-timers.',
    staffReply: { text: 'Noted, Rod. We’ll share a gear rental list with every Pulag booking.', at: at('2026-03-03', '09:15') } }),

  // Ilocos Norte Loop
  r({ id: 'RV-1301', serviceId: 'SVC-ILN', name: 'Elaine W.', city: 'Quezon City', rating: 5, party: 'Family', travelDate: '2026-04-09',
    title: 'Saud Beach is paradise', text: 'The windmills and Kapurpurawan were stunning. Long drives but the van was comfortable and the driver was careful.' }),
  r({ id: 'RV-1302', serviceId: 'SVC-ILN', name: 'Nico F.', city: 'Bocaue', rating: 4, party: 'Couple', travelDate: '2025-11-27',
    title: 'Lots to see', text: 'Packed itinerary in the best way. Paoay Church at sunset was a highlight.' }),

  // Bataan Heritage Day Tour
  r({ id: 'RV-1401', serviceId: 'SVC-BTN', name: 'Lorna T.', city: 'Calumpit', rating: 5, party: 'Family', travelDate: '2026-04-09',
    title: 'Meaningful trip on Araw ng Kagitingan', text: 'Visiting the Shrine of Valor on April 9 was moving. Las Casas was beautiful and the guide was very knowledgeable.' }),
  r({ id: 'RV-1402', serviceId: 'SVC-BTN', name: 'Gab H.', city: 'Malolos', rating: 4, party: 'Friends', travelDate: '2026-08-22',
    title: 'Great history day', text: 'Close to Manila and full of history. Elevator up the cross was an extra fee but worth it.' }),
]

/** Sample monthly sales, April 2025 to September 2026, for the admin trend and forecast. */
export const SALES_HISTORY: MonthlySales[] = [
  { month: '2025-04', revenue: 198900, bookings: 36 },
  { month: '2025-05', revenue: 202900, bookings: 37 },
  { month: '2025-06', revenue: 126500, bookings: 22 },
  { month: '2025-07', revenue: 108100, bookings: 19 },
  { month: '2025-08', revenue: 113700, bookings: 20 },
  { month: '2025-09', revenue: 129900, bookings: 24 },
  { month: '2025-10', revenue: 164000, bookings: 27 },
  { month: '2025-11', revenue: 180200, bookings: 32 },
  { month: '2025-12', revenue: 259100, bookings: 42 },
  { month: '2026-01', revenue: 179300, bookings: 31 },
  { month: '2026-02', revenue: 181000, bookings: 33 },
  { month: '2026-03', revenue: 224300, bookings: 40 },
  { month: '2026-04', revenue: 262700, bookings: 48 },
  { month: '2026-05', revenue: 263700, bookings: 44 },
  { month: '2026-06', revenue: 164100, bookings: 28 },
  { month: '2026-07', revenue: 154200, bookings: 27 },
  { month: '2026-08', revenue: 161100, bookings: 30 },
  { month: '2026-09', revenue: 174600, bookings: 31 },
]
