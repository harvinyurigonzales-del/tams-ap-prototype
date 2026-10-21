// Business logic never reads the real clock. The demo is fixed at Thu, Oct 8, 2026, 9:30 AM in Asia/Manila.
export const DEMO_TODAY = '2026-10-08'
export const DEMO_NOW = '2026-10-08T09:30:00+08:00'

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
