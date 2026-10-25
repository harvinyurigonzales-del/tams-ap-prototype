import { addDays, DEMO_TODAY } from '../lib/demoClock'
import { fmtDate } from '../lib/format'
import type { Dataset } from './types'

// Moves the sample data to the current demo date. Every date field moves by the same whole number of weeks;
// month-only values (the sales history) move by whole months; dates written inside sentences use
// {{YYYY-MM-DD}} tokens so the text always matches the records.

const DAY_OR_STAMP = /^(\d{4}-\d{2}-\d{2})(T.*)?$/
const MONTH = /^(\d{4})-(\d{2})$/
const TOKEN = /\{\{(\d{4}-\d{2}-\d{2})(\|weekday)?\}\}/g

const shiftMonth = (y: number, m: number, n: number) => {
  const t = y * 12 + (m - 1) + n
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`
}

function shiftValue(v: unknown, days: number, months: number): unknown {
  if (typeof v === 'string') {
    const day = DAY_OR_STAMP.exec(v)
    if (day) return addDays(day[1], days) + (day[2] ?? '')
    const month = MONTH.exec(v)
    if (month) return shiftMonth(+month[1], +month[2], months)
    return v.includes('{{') ? v.replace(TOKEN, (_, d: string, wd?: string) => fmtDate(addDays(d, days), { year: false, weekday: !!wd })) : v
  }
  if (Array.isArray(v)) return v.map((x) => shiftValue(x, days, months))
  if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shiftValue(x, days, months)]))
  return v
}

/**
 * Returns a moved copy of the dataset. After the move, a few records can sit between the seed's "today" and the
 * real one; trips that already ended are marked completed and unconfirmed trips that already left are cancelled,
 * so nothing in the past still looks upcoming.
 */
export function shiftDataset(d: Dataset, days: number, months: number, today = DEMO_TODAY): Dataset {
  const out = shiftValue(d, days, months) as Dataset
  if (!days) return out
  for (const b of out.bookings) {
    if (b.status === 'Confirmed' && b.endDate < today) b.status = 'Completed'
    else if (b.status === 'Pending' && b.startDate < today) {
      b.status = 'Cancelled'
      b.cancelReason ??= 'Not confirmed before the travel date.'
    }
  }
  return out
}
