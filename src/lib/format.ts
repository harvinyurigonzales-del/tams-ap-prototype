import { dayMs } from './demoClock'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-PH')}`

export function fmtDate(d: string, opts: { weekday?: boolean; year?: boolean } = { year: true }) {
  const dt = new Date(dayMs(d))
  const base = `${MONTHS[dt.getUTCMonth()]} ${dt.getUTCDate()}`
  const withYear = opts.year === false ? base : `${base}, ${dt.getUTCFullYear()}`
  return opts.weekday ? `${DAYS[dt.getUTCDay()]}, ${withYear}` : withYear
}

export function fmtRange(a: string, b: string) {
  if (a === b) return fmtDate(a, { weekday: true })
  return `${fmtDate(a, { weekday: true, year: false })} – ${fmtDate(b, { weekday: true })}`
}

export function fmtTime(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  const suffix = h >= 12 ? 'PM' : 'AM'
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${suffix}`
}

/** Formats an ISO timestamp with a +08:00 offset as shown in Manila, independent of the device timezone. */
export function fmtStamp(iso: string) {
  return `${fmtDate(iso.slice(0, 10), { year: false })}, ${fmtTime(iso.slice(11, 16))}`
}

export const monthLabel = (year: number, month0: number) => `${LONG_MONTHS[month0]} ${year}`
export const shortDay = (i: number) => DAYS[i]
