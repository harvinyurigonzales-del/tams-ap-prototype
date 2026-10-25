import type { ComboOption } from '../ui/Combobox'
import type { Dataset, Destination } from '../seed/types'

// Pickup suggestions for the planning forms. These are well-known public landmarks in the agency's pickup areas,
// offered to save typing. They are not a promise of service: staff confirm every pickup point with the customer.
// No map service is used.

export interface PickupCity {
  city: string
  area: string
  landmarks: string[]
}

export const PICKUP_CITIES: PickupCity[] = [
  { city: 'Quezon City', area: 'Metro Manila', landmarks: ['SM North EDSA', 'TriNoma', 'Quezon Memorial Circle', 'Araneta City, Cubao', 'UP Diliman (Oblation)', 'Fairview Terraces'] },
  { city: 'Manila', area: 'Metro Manila', landmarks: ['Manila City Hall', 'Rizal Park (Luneta)', 'UST España gate', 'SM City Manila', 'Robinsons Place Manila'] },
  { city: 'Makati', area: 'Metro Manila', landmarks: ['Glorietta, Ayala Center', 'Greenbelt', 'Makati City Hall', 'Circuit Makati'] },
  { city: 'Mandaluyong', area: 'Metro Manila', landmarks: ['SM Megamall', 'Shangri-La Plaza'] },
  { city: 'Pasig', area: 'Metro Manila', landmarks: ['Ortigas Center', 'Capitol Commons', 'Tiendesitas', 'Robinsons Metro East'] },
  { city: 'Taguig', area: 'Metro Manila', landmarks: ['Market! Market!', 'SM Aura', 'Bonifacio High Street'] },
  { city: 'Pasay', area: 'Metro Manila', landmarks: ['SM Mall of Asia', 'NAIA Terminal 3', 'Pasay Rotonda'] },
  { city: 'Parañaque', area: 'Metro Manila', landmarks: ['PITX terminal', 'Ayala Malls Manila Bay', 'SM City BF Parañaque'] },
  { city: 'Muntinlupa', area: 'Metro Manila', landmarks: ['Alabang Town Center', 'Festival Mall', 'Starmall Alabang'] },
  { city: 'Las Piñas', area: 'Metro Manila', landmarks: ['SM Southmall', 'Las Piñas City Hall'] },
  { city: 'Caloocan', area: 'Metro Manila', landmarks: ['Monumento', 'SM City Grand Central'] },
  { city: 'Marikina', area: 'Metro Manila', landmarks: ['SM City Marikina', 'Marikina Riverbanks Center'] },
  { city: 'Valenzuela', area: 'Metro Manila', landmarks: ['SM City Valenzuela', 'Valenzuela City Hall'] },
  { city: 'Malolos', area: 'Bulacan', landmarks: ['Barasoain Church', 'Malolos Cathedral', 'Robinsons Place Malolos', 'Malolos Crossing'] },
  { city: 'Meycauayan', area: 'Bulacan', landmarks: ['Meycauayan Church', 'Meycauayan City Hall'] },
  { city: 'Marilao', area: 'Bulacan', landmarks: ['SM City Marilao'] },
  { city: 'Baliwag', area: 'Bulacan', landmarks: ['SM City Baliwag', 'Baliwag Church'] },
  { city: 'San Jose del Monte', area: 'Bulacan', landmarks: ['SM City San Jose del Monte', 'Starmall San Jose del Monte'] },
  { city: 'San Fernando', area: 'Pampanga', landmarks: ['SM City Pampanga', 'Robinsons Starmills', 'San Fernando Cathedral'] },
  { city: 'Angeles', area: 'Pampanga', landmarks: ['SM City Clark', 'Marquee Mall', 'Clark main gate'] },
  { city: 'Antipolo', area: 'Rizal', landmarks: ['Antipolo Cathedral', 'SM City Masinag', 'Robinsons Antipolo'] },
  { city: 'Taytay', area: 'Rizal', landmarks: ['SM City Taytay', 'Taytay Municipal Hall'] },
  { city: 'Cainta', area: 'Rizal', landmarks: ['Cainta Municipal Hall', 'Junction, Ortigas Extension'] },
  { city: 'Bacoor', area: 'Cavite', landmarks: ['SM City Bacoor', 'SM Center Molino'] },
  { city: 'Imus', area: 'Cavite', landmarks: ['Imus Cathedral', 'Robinsons Place Imus'] },
  { city: 'Dasmariñas', area: 'Cavite', landmarks: ['SM City Dasmariñas', 'Robinsons Place Dasmariñas'] },
  { city: 'Santa Rosa', area: 'Laguna', landmarks: ['Paseo de Santa Rosa', 'SM City Santa Rosa', 'Ayala Malls Solenad, Nuvali'] },
  { city: 'Calamba', area: 'Laguna', landmarks: ['SM City Calamba', 'Rizal Shrine, Calamba'] },
  { city: 'San Pedro', area: 'Laguna', landmarks: ['Pacita Complex', 'San Pedro City Hall'] },
  { city: 'Los Baños', area: 'Laguna', landmarks: ['UPLB main gate', 'Los Baños Municipal Hall'] },
]

export const pickupCityOptions = (): ComboOption[] =>
  PICKUP_CITIES.map((c) => ({ value: c.city, label: c.city, sub: c.area, keywords: c.area }))

const cityOf = (text: string) => PICKUP_CITIES.find((c) => c.city.toLowerCase() === text.trim().toLowerCase())

/** Landmarks for the chosen city, or for every city in an area (van rental chooses the area first). */
export function landmarkOptions(city: string, area?: string): ComboOption[] {
  const c = cityOf(city)
  const cities = c ? [c] : area ? PICKUP_CITIES.filter((x) => x.area === area) : PICKUP_CITIES
  return cities.flatMap((x) => x.landmarks.map((l) => ({ value: `${l}|${x.city}`, label: l, sub: `${x.city}, ${x.area}`, keywords: x.city })))
}

/** The area (province) a typed city belongs to, when it is one we know. */
export const areaOfCity = (city: string) => cityOf(city)?.area

/** One pickup line from the two fields, e.g. "SM North EDSA, Quezon City". */
export const joinPickup = (landmark: string, city: string) => [landmark.trim(), city.trim()].filter(Boolean).join(', ')

export const destinationOptions = (d: Dataset): ComboOption[] =>
  d.destinations.map((x) => ({ value: x.id, label: x.name, sub: x.province, keywords: `${x.province} ${x.interests.join(' ')}` }))

/** Attractions across the catalog, for adding your own stops. */
export function stopOptions(d: Dataset, first?: Destination): ComboOption[] {
  const order = first ? [first, ...d.destinations.filter((x) => x.id !== first.id)] : d.destinations
  return order.flatMap((x) => x.highlights.map((h) => ({ value: `${x.id}:${h}`, label: h, sub: x.name, keywords: x.province })))
}
