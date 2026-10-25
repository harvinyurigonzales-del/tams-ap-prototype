import type { MonthlySales } from '../seed/types'

// Sales forecast for the admin dashboard. A small, explainable model rather than a black box:
//   1. a straight-line trend through the monthly figures,
//   2. a seasonal factor per calendar month (December and summer run high, the rainy months low),
//   3. a band that widens with each month ahead, sized from how far past months strayed from the model.
// It is a planning guide built from sample history, not a promise.

export interface ForecastPoint {
  month: string
  /** Expected value. */
  value: number
  /** 80% range: the "likely" band, also drawn as the conservative and optimistic paths. */
  low80: number
  high80: number
  /** 95% range: the outer band. */
  low95: number
  high95: number
}

export interface Forecast {
  history: MonthlySales[]
  fitted: number[]
  points: ForecastPoint[]
  /** Average month-on-month trend as a fraction (0.02 = 2% a month). */
  monthlyGrowth: number
  /** Typical miss of the model on past months, as a fraction. */
  spread: number
  season: number[]
}

const monthIndex = (m: string) => Number(m.slice(5, 7)) - 1

export function addMonths(month: string, n: number) {
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7)) - 1 + n
  const yy = y + Math.floor(m / 12)
  const mm = ((m % 12) + 12) % 12
  return `${yy}-${String(mm + 1).padStart(2, '0')}`
}

function linearFit(ys: number[]) {
  const n = ys.length
  const xm = (n - 1) / 2
  const ym = ys.reduce((a, b) => a + b, 0) / n
  let num = 0
  let den = 0
  ys.forEach((y, x) => {
    num += (x - xm) * (y - ym)
    den += (x - xm) ** 2
  })
  const slope = den ? num / den : 0
  return { slope, at: (x: number) => ym + slope * (x - xm) }
}

export function forecastSales(history: MonthlySales[], ahead = 6, key: 'revenue' | 'bookings' = 'revenue'): Forecast {
  const ys = history.map((h) => h[key])
  const months = history.map((h) => monthIndex(h.month))
  let season = Array(12).fill(1)
  let trend = linearFit(ys)
  // Alternate between the seasonal factors and the trend a few times so each is estimated net of the other.
  for (let iter = 0; iter < 4; iter++) {
    const sums = Array(12).fill(0)
    const counts = Array(12).fill(0)
    ys.forEach((y, x) => {
      sums[months[x]] += y / trend.at(x)
      counts[months[x]] += 1
    })
    const raw = sums.map((s, i) => (counts[i] ? s / counts[i] : 1))
    const mean = raw.reduce((a, b) => a + b, 0) / 12
    season = raw.map((v) => v / mean)
    trend = linearFit(ys.map((y, x) => y / season[months[x]]))
  }
  const fitted = ys.map((_, x) => trend.at(x) * season[months[x]])
  const ratios = ys.map((y, x) => y / fitted[x] - 1)
  // Months seen once fit exactly, so floor the spread to keep the band honest.
  const spread = Math.max(0.06, Math.sqrt(ratios.reduce((a, r) => a + r * r, 0) / Math.max(1, ratios.length - 2)))
  const last = history[history.length - 1].month
  const points: ForecastPoint[] = []
  for (let h = 1; h <= ahead; h++) {
    const month = addMonths(last, h)
    const value = Math.max(0, trend.at(ys.length - 1 + h) * season[monthIndex(month)])
    const sd = spread * Math.sqrt(h)
    const round = (v: number) => Math.max(0, Math.round(v / (key === 'revenue' ? 100 : 1)) * (key === 'revenue' ? 100 : 1))
    points.push({
      month,
      value: round(value),
      low80: round(value * (1 - 1.28 * sd)),
      high80: round(value * (1 + 1.28 * sd)),
      low95: round(value * (1 - 1.96 * sd)),
      high95: round(value * (1 + 1.96 * sd)),
    })
  }
  const base = trend.at(ys.length - 1)
  return { history, fitted, points, monthlyGrowth: base ? trend.slope / base : 0, spread, season }
}
