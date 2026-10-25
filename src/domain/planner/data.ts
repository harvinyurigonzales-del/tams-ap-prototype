// Curated planning data for the AI planner demo. Every place here is a real attraction at one of our catalog
// destinations; durations and fees are sample figures for the prototype, not quotes. Attractions are listed in a
// sensible route order for each destination, so a plan can follow the list instead of zig-zagging.

export type PlannerInterest = 'Beach' | 'Mountains' | 'Food' | 'Heritage' | 'Adventure' | 'Relaxation' | 'Nature' | 'Photography'
export const PLANNER_INTERESTS: PlannerInterest[] = ['Beach', 'Mountains', 'Food', 'Heritage', 'Adventure', 'Relaxation', 'Nature', 'Photography']

/** Which way the destination lies from Metro Manila; used to adjust drive time for the pickup area. */
export type Direction = 'north' | 'south' | 'east' | 'manila'

export interface Attraction {
  id: string
  name: string
  /** Typical time on site, in minutes. */
  minutes: number
  /** Sample entrance or activity fee per person, in pesos (0 when free). */
  fee: number
  tags: PlannerInterest[]
  /** Counts as the lunch stop when it falls around midday. */
  meal?: boolean
  /** Physical demand, for seniors, children and mobility needs. */
  effort: 'easy' | 'moderate' | 'hard'
  /** Something staff must arrange or confirm (permits, boats, guides). */
  confirm?: string
  /** Best at a particular time of day. */
  when?: 'sunrise' | 'sunset' | 'evening'
}

export interface PlaceMeta {
  destinationId: string
  /** Typical van drive from Metro Manila, in minutes. */
  driveMin: number
  direction: Direction
  /** Shortest sensible trip, in days. */
  minDays: number
  /** Short note staff must confirm for the whole trip (e.g. a ferry crossing). */
  confirm?: string
  attractions: Attraction[]
}

const a = (id: string, name: string, minutes: number, fee: number, tags: PlannerInterest[], effort: Attraction['effort'] = 'easy', extra: Partial<Attraction> = {}): Attraction => ({
  id, name, minutes, fee, tags, effort, ...extra,
})

export const PLACES: PlaceMeta[] = [
  {
    destinationId: 'DST-BAGUIO', driveMin: 300, direction: 'north', minDays: 2,
    attractions: [
      a('bag-bencab', 'BenCab Museum', 90, 300, ['Heritage', 'Photography'], 'easy'),
      a('bag-strawberry', 'Strawberry farm in La Trinidad', 60, 0, ['Food', 'Nature'], 'easy'),
      a('bag-mines', 'Mines View Park', 45, 0, ['Mountains', 'Photography'], 'easy'),
      a('bag-wright', 'Wright Park and The Mansion', 45, 0, ['Heritage', 'Relaxation'], 'easy'),
      a('bag-burnham', 'Burnham Park boating', 60, 200, ['Relaxation', 'Nature'], 'easy'),
      a('bag-session', 'Session Road food crawl', 90, 0, ['Food'], 'easy', { meal: true, when: 'evening' }),
      a('bag-goodshep', 'Good Shepherd Convent pasalubong', 30, 0, ['Food'], 'easy'),
    ],
  },
  {
    destinationId: 'DST-TAGAYTAY', driveMin: 120, direction: 'south', minDays: 1,
    attractions: [
      a('tag-skyranch', 'Sky Ranch', 120, 250, ['Relaxation', 'Adventure'], 'easy'),
      a('tag-picnic', 'Picnic Grove', 60, 50, ['Nature', 'Photography'], 'easy'),
      a('tag-bulalo', 'Bulalo lunch with a view', 75, 0, ['Food'], 'easy', { meal: true }),
      a('tag-taalview', 'Taal Volcano viewpoints', 45, 0, ['Mountains', 'Photography'], 'easy'),
      a('tag-peoples', "People's Park in the Sky", 60, 30, ['Heritage', 'Photography'], 'moderate'),
    ],
  },
  {
    destinationId: 'DST-VIGAN', driveMin: 480, direction: 'north', minDays: 3,
    attractions: [
      a('vig-bantay', 'Bantay Bell Tower', 45, 0, ['Heritage', 'Photography'], 'moderate'),
      a('vig-crisologo', 'Calle Crisologo walk', 90, 0, ['Heritage', 'Photography'], 'easy'),
      a('vig-kalesa', 'Kalesa city tour', 90, 300, ['Heritage'], 'easy'),
      a('vig-empanada', 'Empanada and bagnet stops', 60, 0, ['Food'], 'easy', { meal: true }),
      a('vig-hidden', 'Hidden Garden', 60, 0, ['Nature', 'Relaxation'], 'easy'),
      a('vig-baluarte', 'Baluarte', 90, 0, ['Nature'], 'easy'),
      a('vig-fountain', 'Plaza Salcedo dancing fountain', 45, 0, ['Heritage', 'Photography'], 'easy', { when: 'evening' }),
    ],
  },
  {
    destinationId: 'DST-CAVINTI', driveMin: 180, direction: 'south', minDays: 1,
    attractions: [
      a('cav-boat', 'Gorge boat ride to Pagsanjan Falls', 150, 1500, ['Adventure', 'Nature'], 'moderate', { confirm: 'Boat ride booked by staff at the tourism office' }),
      a('cav-raft', 'Raft under the falls', 30, 0, ['Adventure'], 'moderate'),
      a('cav-lunch', 'Riverside lunch', 75, 0, ['Food', 'Relaxation'], 'easy', { meal: true }),
      a('cav-underground', 'Cavinti Underground River', 120, 300, ['Adventure', 'Nature'], 'moderate'),
    ],
  },
  {
    destinationId: 'DST-BATANGAS', driveMin: 180, direction: 'south', minDays: 1,
    attractions: [
      a('bat-laiya', 'Laiya beach day', 180, 300, ['Beach', 'Relaxation'], 'easy'),
      a('bat-seafood', 'Seafood lunch', 75, 0, ['Food'], 'easy', { meal: true }),
      a('bat-pools', 'Resort pools', 120, 0, ['Relaxation'], 'easy'),
      a('bat-sunset', 'Sunset by the shore', 60, 0, ['Beach', 'Photography'], 'easy', { when: 'sunset' }),
    ],
  },
  {
    destinationId: 'DST-SAGADA', driveMin: 720, direction: 'north', minDays: 3,
    attractions: [
      a('sag-kiltepan', 'Kiltepan sunrise', 90, 0, ['Mountains', 'Photography'], 'easy', { when: 'sunrise' }),
      a('sag-echo', 'Echo Valley and hanging coffins', 90, 200, ['Heritage', 'Nature'], 'moderate', { confirm: 'Local guide required' }),
      a('sag-sumaguing', 'Sumaguing Cave', 180, 500, ['Adventure'], 'hard', { confirm: 'Local guide required' }),
      a('sag-lemon', 'Lemon pie at a local bakery', 45, 0, ['Food'], 'easy'),
      a('sag-bomodok', 'Bomod-ok Falls', 180, 200, ['Nature', 'Adventure'], 'hard', { confirm: 'Local guide required' }),
      a('sag-danum', 'Lake Danum', 60, 0, ['Nature', 'Relaxation'], 'easy', { when: 'sunset' }),
    ],
  },
  {
    destinationId: 'DST-BANAUE', driveMin: 540, direction: 'north', minDays: 3,
    attractions: [
      a('ban-view', 'Banaue viewpoint', 45, 0, ['Mountains', 'Photography'], 'easy'),
      a('ban-village', 'Ifugao village visit', 90, 100, ['Heritage'], 'moderate'),
      a('ban-batad', 'Batad terraces hike', 240, 300, ['Adventure', 'Mountains'], 'hard', { confirm: 'Local guide required' }),
      a('ban-tappiya', 'Tappiya Falls', 90, 0, ['Nature', 'Adventure'], 'hard'),
      a('ban-hapao', 'Hapao terraces', 90, 100, ['Mountains', 'Photography'], 'moderate'),
    ],
  },
  {
    destinationId: 'DST-BALER', driveMin: 360, direction: 'east', minDays: 2,
    attractions: [
      a('bal-balete', 'Millennium Balete Tree', 45, 50, ['Nature', 'Photography'], 'easy'),
      a('bal-ditumabo', 'Ditumabo Mother Falls', 150, 100, ['Nature', 'Adventure'], 'moderate'),
      a('bal-museo', 'Museo de Baler', 60, 30, ['Heritage'], 'easy'),
      a('bal-surf', 'Surf lesson at Sabang Beach', 120, 500, ['Beach', 'Adventure'], 'moderate'),
      a('bal-sabang', 'Free time on Sabang Beach', 90, 0, ['Beach', 'Relaxation'], 'easy', { when: 'sunset' }),
    ],
  },
  {
    destinationId: 'DST-LAUNION', driveMin: 300, direction: 'north', minDays: 2,
    attractions: [
      a('lu-tangadan', 'Tangadan Falls', 180, 150, ['Nature', 'Adventure'], 'hard', { confirm: 'Local guide required' }),
      a('lu-grape', 'Grape farm in Bauang', 60, 100, ['Food', 'Nature'], 'easy'),
      a('lu-surf', 'Surf lesson at Urbiztondo', 120, 500, ['Beach', 'Adventure'], 'moderate'),
      a('lu-cafe', 'Beachfront cafe lunch', 75, 0, ['Food', 'Relaxation'], 'easy', { meal: true }),
      a('lu-beach', 'Beach time at Urbiztondo', 120, 0, ['Beach', 'Relaxation'], 'easy'),
      a('lu-sunset', 'Sunset at the beach', 60, 0, ['Beach', 'Photography'], 'easy', { when: 'sunset' }),
      a('lu-night', 'Night market food', 90, 0, ['Food'], 'easy', { when: 'evening' }),
    ],
  },
  {
    destinationId: 'DST-HUNDRED', driveMin: 300, direction: 'north', minDays: 1,
    attractions: [
      a('hun-hopping', 'Bangka island hopping', 180, 600, ['Beach', 'Nature'], 'easy', { confirm: 'Boat hired by staff at Lucap Wharf' }),
      a('hun-governor', "Governor's Island view deck", 45, 0, ['Photography', 'Nature'], 'moderate'),
      a('hun-quezon', 'Snorkelling at Quezon Island', 90, 150, ['Beach', 'Adventure'], 'moderate'),
      a('hun-children', "Children's Island shallows", 60, 0, ['Beach', 'Relaxation'], 'easy'),
      a('hun-longganisa', 'Alaminos longganisa lunch', 60, 0, ['Food'], 'easy', { meal: true }),
    ],
  },
  {
    destinationId: 'DST-ZAMBALES', driveMin: 240, direction: 'north', minDays: 2,
    attractions: [
      a('zam-boat', 'Boat ride from Pundaquit', 45, 700, ['Beach', 'Adventure'], 'easy', { confirm: 'Boat hired by staff in Pundaquit' }),
      a('zam-anawangin', 'Anawangin Cove beach time', 180, 200, ['Beach', 'Relaxation'], 'easy'),
      a('zam-nagsasa', 'Nagsasa Cove side trip', 120, 200, ['Beach', 'Nature'], 'easy'),
      a('zam-capones', 'Capones Island lighthouse', 120, 100, ['Adventure', 'Photography'], 'moderate'),
      a('zam-bonfire', 'Bonfire and stargazing', 90, 0, ['Relaxation', 'Nature'], 'easy', { when: 'evening' }),
    ],
  },
  {
    destinationId: 'DST-PGALERA', driveMin: 240, direction: 'south', minDays: 3, confirm: 'Includes a ferry crossing from Batangas Port, arranged by staff',
    attractions: [
      a('pg-tamaraw', 'Tamaraw Falls', 45, 50, ['Nature', 'Photography'], 'easy'),
      a('pg-muelle', 'Muelle Bay', 60, 0, ['Heritage', 'Relaxation'], 'easy'),
      a('pg-coral', 'Snorkelling at Coral Garden', 150, 600, ['Beach', 'Adventure'], 'moderate', { confirm: 'Boat hired by staff' }),
      a('pg-hopping', 'Island-hopping by bangka', 180, 700, ['Beach', 'Nature'], 'easy', { confirm: 'Boat hired by staff' }),
      a('pg-white', 'White Beach sunset', 90, 0, ['Beach', 'Relaxation', 'Food'], 'easy', { when: 'sunset' }),
    ],
  },
  {
    destinationId: 'DST-PULAG', driveMin: 480, direction: 'north', minDays: 3, confirm: 'Park permit and DENR orientation arranged by staff',
    attractions: [
      a('pul-denr', 'DENR park orientation', 60, 150, ['Nature'], 'easy', { confirm: 'Required by the park' }),
      a('pul-camp', 'Hike to Camp 2', 240, 500, ['Mountains', 'Adventure'], 'hard', { confirm: 'Local guide required' }),
      a('pul-summit', 'Summit sunrise above the clouds', 180, 0, ['Mountains', 'Photography'], 'hard', { when: 'sunrise' }),
      a('pul-grass', 'Dwarf-bamboo grasslands', 90, 0, ['Nature', 'Photography'], 'moderate'),
    ],
  },
  {
    destinationId: 'DST-PAGUDPUD', driveMin: 600, direction: 'north', minDays: 4,
    attractions: [
      a('pag-paoay', 'Paoay Church', 45, 0, ['Heritage', 'Photography'], 'easy'),
      a('pag-dunes', 'Paoay sand dunes 4x4', 90, 2500, ['Adventure'], 'moderate', { confirm: '4x4 ride booked by staff' }),
      a('pag-kapurpurawan', 'Kapurpurawan rock formation', 60, 0, ['Nature', 'Photography'], 'moderate'),
      a('pag-bangui', 'Bangui windmills', 45, 0, ['Photography'], 'easy'),
      a('pag-saud', 'Saud Beach', 180, 0, ['Beach', 'Relaxation'], 'easy'),
    ],
  },
  {
    destinationId: 'DST-BATAAN', driveMin: 180, direction: 'north', minDays: 1,
    attractions: [
      a('bta-samat', 'Dambana ng Kagitingan on Mt. Samat', 75, 50, ['Heritage', 'Mountains'], 'easy'),
      a('bta-museum', 'Bataan World War II Museum', 60, 100, ['Heritage'], 'easy'),
      a('bta-balanga', 'Balanga Cathedral', 30, 0, ['Heritage'], 'easy'),
      a('bta-lunch', 'Seaside lunch', 75, 0, ['Food'], 'easy', { meal: true }),
      a('bta-acuzar', 'Las Casas Filipinas de Acuzar', 180, 1500, ['Heritage', 'Photography'], 'easy'),
    ],
  },
  {
    destinationId: 'DST-PINATUBO', driveMin: 180, direction: 'north', minDays: 1, confirm: 'Shared 4x4 and guide arranged by staff in Capas',
    attractions: [
      a('pin-4x4', '4x4 ride across the lahar canyon', 90, 1800, ['Adventure'], 'moderate', { confirm: 'Booked by staff' }),
      a('pin-trek', 'Trek to the crater lake', 120, 500, ['Mountains', 'Adventure', 'Nature'], 'moderate'),
      a('pin-lunch', 'Lunch with a crater view', 60, 0, ['Food', 'Relaxation'], 'easy', { meal: true }),
      a('pin-shrine', 'Capas National Shrine', 45, 0, ['Heritage'], 'easy'),
    ],
  },
  {
    destinationId: 'DST-SUBIC', driveMin: 150, direction: 'north', minDays: 1,
    attractions: [
      a('sub-zoobic', 'Zoobic Safari', 150, 900, ['Nature', 'Adventure'], 'easy'),
      a('sub-treetop', 'Tree Top Adventure', 90, 700, ['Adventure'], 'moderate'),
      a('sub-lunch', 'Seafood lunch by the bay', 75, 0, ['Food'], 'easy', { meal: true }),
      a('sub-boardwalk', 'Subic Bay boardwalk', 60, 0, ['Beach', 'Relaxation'], 'easy', { when: 'sunset' }),
      a('sub-pamulaklakin', 'Pamulaklakin forest trail', 90, 100, ['Nature', 'Heritage'], 'moderate'),
    ],
  },
  {
    destinationId: 'DST-PAMPANGA', driveMin: 90, direction: 'north', minDays: 1,
    attractions: [
      a('pam-betis', 'Betis Church murals', 45, 0, ['Heritage', 'Photography'], 'easy'),
      a('pam-bacolor', 'San Guillermo Church in Bacolor', 45, 0, ['Heritage'], 'easy'),
      a('pam-parol', 'Parol workshop in San Fernando', 75, 300, ['Heritage'], 'easy'),
      a('pam-sisig', 'Sisig in Angeles', 75, 0, ['Food'], 'easy', { meal: true }),
      a('pam-market', 'Pasalubong at the public market', 45, 0, ['Food'], 'easy'),
    ],
  },
  {
    destinationId: 'DST-TAAL', driveMin: 150, direction: 'south', minDays: 1,
    attractions: [
      a('taa-basilica', 'Basilica of St. Martin de Tours', 45, 0, ['Heritage', 'Photography'], 'moderate'),
      a('taa-villa', 'Villavicencio ancestral house', 45, 100, ['Heritage'], 'easy'),
      a('taa-galleria', 'Galleria Taal camera museum', 60, 150, ['Heritage', 'Photography'], 'easy'),
      a('taa-lunch', 'Lomi and tapang Taal lunch', 60, 0, ['Food'], 'easy', { meal: true }),
      a('taa-barako', 'Kapeng barako tasting', 30, 0, ['Food'], 'easy'),
      a('taa-balisong', 'Balisong makers', 45, 0, ['Heritage'], 'easy'),
    ],
  },
  {
    destinationId: 'DST-LUCBAN', driveMin: 210, direction: 'south', minDays: 1,
    attractions: [
      a('luc-tayabas', 'Tayabas Basilica', 45, 0, ['Heritage', 'Photography'], 'easy'),
      a('luc-malagonlong', 'Malagonlong Bridge', 30, 0, ['Heritage', 'Photography'], 'easy'),
      a('luc-church', 'Lucban Church', 30, 0, ['Heritage'], 'easy'),
      a('luc-habhab', 'Pancit habhab and longganisa', 60, 0, ['Food'], 'easy', { meal: true }),
      a('luc-kamay', 'Kamay ni Hesus shrine', 75, 0, ['Heritage', 'Mountains'], 'moderate'),
    ],
  },
  {
    destinationId: 'DST-DINGALAN', driveMin: 270, direction: 'east', minDays: 2,
    attractions: [
      a('din-lighthouse', 'Dingalan lighthouse hike', 150, 100, ['Mountains', 'Adventure', 'Photography'], 'hard', { confirm: 'Local guide required' }),
      a('din-white', 'White Beach cove', 120, 100, ['Beach', 'Relaxation'], 'easy'),
      a('din-lamao', 'Lamao Caves', 90, 100, ['Adventure', 'Nature'], 'moderate'),
      a('din-seafood', 'Fresh seafood lunch', 60, 0, ['Food'], 'easy', { meal: true }),
      a('din-sunrise', 'Sunrise over the Pacific', 60, 0, ['Photography', 'Nature'], 'easy', { when: 'sunrise' }),
    ],
  },
  {
    destinationId: 'DST-BOLINAO', driveMin: 330, direction: 'north', minDays: 2,
    attractions: [
      a('bol-church', 'St. James the Great Church', 30, 0, ['Heritage'], 'easy'),
      a('bol-cave', 'Enchanted Cave', 60, 150, ['Adventure', 'Nature'], 'moderate'),
      a('bol-patar', 'Patar Beach', 150, 0, ['Beach', 'Relaxation'], 'easy'),
      a('bol-lighthouse', 'Cape Bolinao Lighthouse', 45, 0, ['Photography', 'Heritage'], 'easy', { when: 'sunset' }),
      a('bol-falls', 'Bolinao Falls', 120, 100, ['Nature', 'Adventure'], 'moderate'),
    ],
  },
  {
    destinationId: 'DST-TANAY', driveMin: 120, direction: 'east', minDays: 1,
    attractions: [
      a('tan-clouds', 'Sunrise at a sea-of-clouds viewpoint', 90, 100, ['Mountains', 'Photography'], 'moderate', { when: 'sunrise' }),
      a('tan-market', 'Tanay public market breakfast', 45, 0, ['Food'], 'easy'),
      a('tan-daranak', 'Daranak Falls', 120, 100, ['Nature', 'Relaxation'], 'easy'),
      a('tan-calinawan', 'Calinawan Cave', 60, 50, ['Adventure', 'Nature'], 'moderate'),
      a('tan-marilaque', 'Marilaque highway viewpoints', 60, 0, ['Mountains', 'Photography', 'Food'], 'easy', { meal: true }),
    ],
  },
  {
    destinationId: 'DST-MINALUNGAO', driveMin: 150, direction: 'north', minDays: 1,
    attractions: [
      a('min-gorge', 'Limestone gorge viewpoint', 30, 50, ['Photography', 'Nature'], 'easy'),
      a('min-bridge', 'Hanging bridge', 30, 0, ['Adventure', 'Photography'], 'easy'),
      a('min-raft', 'Bamboo raft ride', 60, 300, ['Adventure', 'Nature'], 'easy'),
      a('min-lunch', 'Lunch by the river', 60, 0, ['Food', 'Relaxation'], 'easy', { meal: true }),
      a('min-swim', 'River swim', 90, 0, ['Nature', 'Relaxation'], 'moderate'),
    ],
  },
  {
    destinationId: 'DST-INTRAMUROS', driveMin: 45, direction: 'manila', minDays: 1,
    attractions: [
      a('itm-fort', 'Fort Santiago', 75, 75, ['Heritage', 'Photography'], 'easy'),
      a('itm-cathedral', 'Manila Cathedral', 30, 0, ['Heritage'], 'easy'),
      a('itm-agustin', 'San Agustin Church and museum', 75, 200, ['Heritage'], 'easy'),
      a('itm-casa', 'Casa Manila', 45, 75, ['Heritage', 'Photography'], 'easy'),
      a('itm-binondo', 'Binondo food crawl', 120, 0, ['Food'], 'easy', { meal: true }),
    ],
  },
]

export const placeFor = (destinationId: string) => PLACES.find((p) => p.destinationId === destinationId)
export const attractionById = (id: string) => {
  for (const p of PLACES) {
    const x = p.attractions.find((y) => y.id === id)
    if (x) return { place: p, attraction: x }
  }
  return undefined
}

/** Minutes to add to the Manila drive time for each pickup area, by direction (sample estimates). */
export const PICKUP_OFFSET: Record<string, Record<Direction, number>> = {
  'Metro Manila': { north: 0, south: 0, east: 0, manila: 0 },
  Bulacan: { north: -30, south: 60, east: 0, manila: 45 },
  Pampanga: { north: -60, south: 100, east: 0, manila: 90 },
  Rizal: { north: 30, south: 20, east: -45, manila: 30 },
  Cavite: { north: 60, south: -30, east: 45, manila: 45 },
  Laguna: { north: 75, south: -30, east: 30, manila: 60 },
}
