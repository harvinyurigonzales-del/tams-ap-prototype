// One clock for the whole prototype. "Today" is the current date in Asia/Manila, read once when the app loads,
// and every time of day counts on from the demo's fixed 9:30 AM. Business logic never reads the real clock directly.
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

/** Milliseconds of an ISO timestamp (with its offset). */
export const isoMs = (iso: string) => Date.parse(iso)
/** A Manila timestamp from milliseconds, as 'YYYY-MM-DDTHH:MM:SS+08:00'. */
export const manilaIso = (ms: number) => `${new Date(ms + 8 * 3_600_000).toISOString().slice(0, 19)}+08:00`
export const addHours = (iso: string, h: number) => manilaIso(isoMs(iso) + h * 3_600_000)

/** Overlap of two inclusive day ranges. */
export const overlaps = (a1: string, a2: string, b1: string, b2: string) => a1 <= b2 && b1 <= a2

let ticks = 0
const BASE_MINUTE = 9 * 60 + 30

/**
 * Timestamp for an action taken during the demo: the fixed demo time plus one minute per action, so order is kept.
 * Customer and staff actions share one sequence, so a reply always lands after the message it answers.
 */
export function demoNowStamp(): string {
  ticks += 1
  const total = Math.min(24 * 60 - 1, BASE_MINUTE + ticks)
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${DEMO_TODAY}T${hh}:${mm}:00+08:00`
}

/** The current demo time without using up a minute: the time of the latest action, or 9:30 AM before any. */
export function demoNow(): string {
  const total = Math.min(24 * 60 - 1, BASE_MINUTE + ticks)
  return `${DEMO_TODAY}T${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}:00+08:00`
}

/** Continues the sequence after the latest action saved for today, so reloading never reuses a time. */
export function primeDemoClock(stamps: string[]) {
  for (const st of stamps) {
    if (!st?.startsWith(DEMO_TODAY)) continue
    const m = /T(\d{2}):(\d{2})/.exec(st)
    if (!m) continue
    ticks = Math.max(ticks, +m[1] * 60 + +m[2] - BASE_MINUTE)
  }
}

export function resetDemoClock() {
  ticks = 0
}

/** Whole weeks the sample data moves forward so its "today" lands on or up to six days before DEMO_TODAY. */
export const SEED_SHIFT_DAYS = Math.floor(daysBetween(SEED_TODAY, DEMO_TODAY) / 7) * 7
/** Calendar months between the seed month and the current month, for month-based sample history. */
export const SEED_SHIFT_MONTHS = (+DEMO_TODAY.slice(0, 4) - +SEED_TODAY.slice(0, 4)) * 12 + (+DEMO_TODAY.slice(5, 7) - +SEED_TODAY.slice(5, 7))
