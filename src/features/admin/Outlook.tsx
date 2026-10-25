import { TrendingUp } from 'lucide-react'
import { useMemo, useState } from 'react'
import { forecastSales } from '../../domain/forecast'
import { peso } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import { Card } from '../../ui/Card'
import { ForecastChart } from '../../ui/ForecastChart'
import { Tabs, Table, td } from './common'

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const monthName = (m: string) => `${MONTHS[Number(m.slice(5, 7)) - 1]} ${m.slice(0, 4)}`
const k = (n: number) => (n >= 1000 ? `₱${Math.round(n / 1000)}k` : `₱${n}`)

/** Dashboard card: past monthly sales and where the next six months are likely to land. */
export function SalesOutlook() {
  const history = useAdmin((s) => s.data.salesHistory)
  const [metric, setMetric] = useState<'revenue' | 'bookings'>('revenue')
  const f = useMemo(() => forecastSales(history, 6, metric), [history, metric])
  const fmt = metric === 'revenue' ? peso : (n: number) => `${n.toLocaleString('en-PH')} bookings`
  const axis = metric === 'revenue' ? k : (n: number) => String(n)
  const next3 = f.points.slice(0, 3).reduce((a, p) => a + p.value, 0)
  const peak = f.points.reduce((a, p) => (p.value > a.value ? p : a))
  const lastYear3 = f.points.slice(0, 3).reduce((a, p) => a + (history.find((h) => h.month === `${Number(p.month.slice(0, 4)) - 1}${p.month.slice(4)}`)?.[metric] ?? 0), 0)
  const yoy = lastYear3 ? next3 / lastYear3 - 1 : null
  const growth = Math.round(f.monthlyGrowth * 1000) / 10

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-bold text-charcoal">Sales outlook</h2>
          <p className="mt-0.5 text-sm text-ink-2">Last 18 months and the expected path for the next 6, from past sales and seasonality.</p>
        </div>
        <Tabs
          value={metric}
          onChange={setMetric}
          items={[
            { key: 'revenue', label: 'Sales' },
            { key: 'bookings', label: 'Bookings' },
          ]}
        />
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Next 3 months, expected" value={fmt(next3)} note={yoy !== null ? `${yoy >= 0 ? '+' : ''}${Math.round(yoy * 100)}% vs same months last year` : undefined} />
        <Stat label="Busiest month ahead" value={monthName(peak.month)} note={`About ${fmt(peak.value)}`} />
        <Stat
          label="Underlying trend"
          value={
            <span className="inline-flex items-center gap-1.5">
              <TrendingUp className="size-5 text-ok" aria-hidden /> {growth >= 0 ? '+' : ''}
              {growth}% a month
            </span>
          }
          note="After removing seasonal swings"
        />
      </dl>

      <div className="mt-5">
        <ForecastChart forecast={f} metric={metric} format={fmt} axisFormat={axis} />
      </div>

      <p className="mt-3 text-xs text-ink-3">
        A planning guide, not a promise. The shaded ranges widen each month because the further ahead, the less certain. Built from past monthly sales.
      </p>

      <details className="mt-3 group">
        <summary className="cursor-pointer text-sm font-semibold text-brand-700 hover:underline">Show forecast as a table</summary>
        <div className="mt-3 overflow-hidden rounded-xl border border-line">
          <Table head={['Month', 'Expected', 'Conservative', 'Optimistic']}>
            {f.points.map((p) => (
              <tr key={p.month}>
                <td className={td}>{monthName(p.month)}</td>
                <td className={`${td} font-semibold text-ink tnum`}>{fmt(p.value)}</td>
                <td className={`${td} tnum`}>{fmt(p.low80)}</td>
                <td className={`${td} tnum`}>{fmt(p.high80)}</td>
              </tr>
            ))}
          </Table>
        </div>
      </details>
    </Card>
  )
}

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note?: string }) {
  return (
    <div className="rounded-xl bg-surface-muted px-4 py-3">
      <dt className="text-xs font-medium text-ink-2">{label}</dt>
      <dd className="mt-0.5 font-display text-xl font-bold text-charcoal tnum">{value}</dd>
      {note && <dd className="text-xs text-ink-2">{note}</dd>}
    </div>
  )
}
