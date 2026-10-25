// One clock for the whole prototype. "Today" is the current date in Asia/Manila, read once when the app loads,
// and every time of day is the demo's fixed 9:30 AM. Business logic never reads the real clock directly.
//
// The sample data was written around SEED_TODAY. At load it is moved forward in whole weeks (so weekend tours
// stay on weekends) to sit just before today, which keeps departures, promos and history useful on any date.
//
// Presenters can pin the date with ?demo-date=YYYY-MM-DD (kept for the browser tab). Tests pin it the same way.

export const SEED_TODAY = '2026-10-08'
export const DEMO_TIME = '09:30'

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/

function manilaToday() {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
}

function pinnedDate(): string | undefined {
  const g = globalThis as { __TAMS_TODAY__?: string; location?: Location; sessionStorage?: Storage }
  if (g.__TAMS_TODAY__ && ISO_DAY.test(g.__TAMS_TODAY__)) return g.__TAMS_TODAY__
  try {
    const fromUrl = g.location ? new URLSearchParams(g.location.search).get('demo-date') : null
    if (fromUrl === '' || fromUrl === 'today') g.sessionStorage?.removeItem('tams-demo-date')
    else if (fromUrl && ISO_DAY.test(fromUrl)) g.sessionStorage?.setItem('tams-demo-date', fromUrl)
    const kept = g.sessionStorage?.getItem('tams-demo-date')
    if (kept && ISO_DAY.test(kept)) return kept
  } catch {
    // Storage can be blocked; fall back to the live date.
  }
  return undefined
}

const pinned = pinnedDate()
/** How today was chosen: the live Manila date, or a date pinned for a presentation or test. */
export const CLOCK_SOURCE: 'live' | 'pinned' = pinned ? 'pinned' : 'live'
export const DEMO_TODAY = pinned ?? manilaToday()
export const DEMO_NOW = `${DEMO_TODAY}T${DEMO_TIME}:00+08:00`

const DAY = 86_400_000

/** Parses 'YYYY-MM-DD' as a calendar day (UTC midnight) so weekday maths never depends on the device timezone. */
export const dayMs = (d: string) => Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10))
export const toDay = (ms: number) => new Date(ms).toISOString().slice(0, 10)
export const addDays = (d: string, n: number) => toDay(dayMs(d) + n * DAY)
export const daysBetween = (a: string, b: string) => Math.round((dayMs(b) - dayMs(a)) / DAY)
export const weekday = (d: string) => new Date(dayMs(d)).getUTCDay() // 0 = Sunday
export const dateOf = (iso: string) => iso.slice(0, 10)

/** Overlap of two inclusive day ranges. */
export const overlaps = (a1: string, a2: string, b1: string, b2: string) => a1 <= b2 && b1 <= a2

const ticks = { customer: 0, admin: 0 }
const BASE_MINUTE = { customer: 9 * 60 + 30, admin: 9 * 60 + 40 }

/**
 * Timestamp for an action taken during the demo: the fixed demo time plus one minute per action, so order is kept.
 * Customer actions start at 9:31 AM; admin actions start at 9:41 AM, after the pre-seeded 9:31–9:32 scenario records.
 */
export function demoNowStamp(side: 'customer' | 'admin' = 'customer'): string {
  ticks[side] += 1
  const total = BASE_MINUTE[side] + ticks[side]
  const hh = String(Math.min(23, Math.floor(total / 60))).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${DEMO_TODAY}T${hh}:${mm}:00+08:00`
}

export function resetDemoClock(side?: 'customer' | 'admin') {
  if (!side || side === 'customer') ticks.customer = 0
  if (!side || side === 'admin') ticks.admin = 0
}

/** Whole weeks the sample data moves forward so its "today" lands on or up to six days before DEMO_TODAY. */
export const SEED_SHIFT_DAYS = Math.floor(daysBetween(SEED_TODAY, DEMO_TODAY) / 7) * 7
/** Calendar months between the seed month and the current month, for month-based sample history. */
export const SEED_SHIFT_MONTHS = (+DEMO_TODAY.slice(0, 4) - +SEED_TODAY.slice(0, 4)) * 12 + (+DEMO_TODAY.slice(5, 7) - +SEED_TODAY.slice(5, 7))
