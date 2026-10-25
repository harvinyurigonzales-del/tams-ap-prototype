import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import type { Forecast } from '../domain/forecast'

// Sales outlook chart. Past months are a solid line; the months ahead fan out like a market chart: a dashed
// expected path, with optimistic and conservative paths trailing above and below it inside shaded ranges.
// One hue (Road Navy) at different strengths, one axis, end labels on every line, and a table view below.

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const monthLabel = (m: string, withYear = false) => `${MONTHS[Number(m.slice(5, 7)) - 1]}${withYear ? ` ${m.slice(0, 4)}` : ''}`

interface Props {
  forecast: Forecast
  metric: 'revenue' | 'bookings'
  format: (n: number) => string
  axisFormat: (n: number) => string
  height?: number
}

function useWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(720)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    setW(el.clientWidth)
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, w] as const
}

/** Rounds the axis top up to a tidy step so gridlines land on readable values. */
function niceTop(max: number) {
  const mag = 10 ** Math.floor(Math.log10(max))
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => max / s <= 5)!
  return { top: Math.ceil(max / step) * step, step }
}

export function ForecastChart({ forecast, metric, format, axisFormat, height = 300 }: Props) {
  const [wrap, width] = useWidth()
  const [hover, setHover] = useState<number | null>(null)
  const { history, points } = forecast
  const actual = history.map((h) => h[metric])
  const n = history.length + points.length
  const last = history.length - 1
  const narrow = width < 520

  const pad = { l: narrow ? 40 : 48, r: narrow ? 12 : 104, t: 18, b: 30 }
  const iw = Math.max(10, width - pad.l - pad.r)
  const ih = height - pad.t - pad.b
  const { top, step } = niceTop(Math.max(...actual, ...points.map((p) => p.high95)) * 1.02)
  const x = (i: number) => pad.l + (i / (n - 1)) * iw
  const y = (v: number) => pad.t + ih - (v / top) * ih

  const line = (vals: [number, number][]) => vals.map(([i, v], k) => `${k ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const ahead = (pick: (p: (typeof points)[number]) => number): [number, number][] => [[last, actual[last]], ...points.map((p, k) => [last + 1 + k, pick(p)] as [number, number])]
  const band = (lo: (p: (typeof points)[number]) => number, hi: (p: (typeof points)[number]) => number) => {
    const upper = ahead(hi)
    const lower = ahead(lo).reverse()
    return `${line(upper)}${lower.map(([i, v]) => `L${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')}Z`
  }

  const end = points[points.length - 1]
  const endLabels = [
    { key: 'Optimistic', v: end.high80, cls: 'fill-ink-2' },
    { key: 'Expected', v: end.value, cls: 'fill-ink font-semibold' },
    { key: 'Conservative', v: end.low80, cls: 'fill-ink-2' },
  ]
  // Keep end labels at least 30px apart so they never collide.
  const placed = endLabels.map((l) => ({ ...l, py: y(l.v) }))
  for (let k = 1; k < placed.length; k++) if (placed[k].py - placed[k - 1].py < 30) placed[k].py = placed[k - 1].py + 30

  const gridVals = Array.from({ length: Math.round(top / step) + 1 }, (_, k) => k * step)
  const monthOf = (i: number) => (i <= last ? history[i].month : points[i - last - 1].month)
  const tickEvery = narrow ? 6 : 3

  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    setHover((h) => Math.max(0, Math.min(n - 1, (h ?? last) + (e.key === 'ArrowRight' ? 1 : -1))))
  }
  useEffect(() => setHover(null), [metric])

  const tip = hover === null ? null : hover <= last ? { kind: 'Actual', month: monthOf(hover), v: actual[hover] } : { kind: 'Forecast', month: monthOf(hover), p: points[hover - last - 1] }
  const tipLeft = hover === null ? 0 : Math.min(Math.max(x(hover), 90), width - 90)

  return (
    <div ref={wrap} className="relative w-full select-none">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`${metric === 'revenue' ? 'Monthly sales' : 'Monthly bookings'}: ${history.length} months of history and a ${points.length}-month forecast. Use the left and right arrow keys to read each month.`}
        tabIndex={0}
        onKeyDown={onKey}
        onBlur={() => setHover(null)}
        className="block overflow-visible rounded-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-600"
        onMouseLeave={() => setHover(null)}
      >
        {gridVals.map((v) => (
          <g key={v}>
            <line x1={pad.l} x2={pad.l + iw} y1={y(v)} y2={y(v)} className="stroke-line" strokeWidth={1} />
            <text x={pad.l - 8} y={y(v) + 4} textAnchor="end" className="fill-ink-3 text-[11px] tnum">
              {axisFormat(v)}
            </text>
          </g>
        ))}

        {/* Forecast zone, behind everything else. */}
        <rect x={x(last)} y={pad.t} width={x(n - 1) - x(last)} height={ih} className="fill-brand-50" opacity={0.6} />
        <line x1={x(last)} x2={x(last)} y1={pad.t - 6} y2={pad.t + ih} className="stroke-ink-3" strokeWidth={1} strokeDasharray="2 3" />
        <text x={x(last) + 6} y={pad.t + 4} className="fill-ink-2 text-[11px] font-semibold">
          Forecast →
        </text>

        <path d={band((p) => p.low95, (p) => p.high95)} className="fill-brand-600" opacity={0.08} />
        <path d={band((p) => p.low80, (p) => p.high80)} className="fill-brand-600" opacity={0.12} />

        <path d={line(ahead((p) => p.high80))} fill="none" className="stroke-brand-400" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
        <path d={line(ahead((p) => p.low80))} fill="none" className="stroke-brand-400" strokeWidth={1.5} strokeDasharray="1 4" strokeLinecap="round" />
        <path d={line(ahead((p) => p.value))} fill="none" className="stroke-brand-600" strokeWidth={2} strokeDasharray="6 5" strokeLinecap="round" />
        <path d={line(actual.map((v, i) => [i, v]))} fill="none" className="stroke-brand-600" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last)} cy={y(actual[last])} r={4.5} className="fill-brand-600 stroke-surface" strokeWidth={2} />

        {!narrow &&
          placed.map((l) => (
            <g key={l.key}>
              <text x={pad.l + iw + 10} y={l.py - 2} className={`text-[11px] ${l.cls}`}>
                {l.key}
              </text>
              <text x={pad.l + iw + 10} y={l.py + 12} className="fill-ink-2 text-[11px] tnum">
                {format(l.v)}
              </text>
            </g>
          ))}

        {Array.from({ length: n }, (_, i) => i)
          .filter((i) => (i - last) % tickEvery === 0)
          .map((i) => {
            const m = monthOf(i)
            return (
              <text key={i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-ink-2 text-[11px]">
                {monthLabel(m, m.endsWith('-01') || i === 0)}
              </text>
            )
          })}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={x(hover)} x2={x(hover)} y1={pad.t} y2={pad.t + ih} className="stroke-ink-3" strokeWidth={1} />
            {hover <= last ? (
              <circle cx={x(hover)} cy={y(actual[hover])} r={5} className="fill-brand-600 stroke-surface" strokeWidth={2} />
            ) : (
              <>
                <circle cx={x(hover)} cy={y(points[hover - last - 1].high80)} r={3.5} className="fill-brand-400 stroke-surface" strokeWidth={1.5} />
                <circle cx={x(hover)} cy={y(points[hover - last - 1].low80)} r={3.5} className="fill-brand-400 stroke-surface" strokeWidth={1.5} />
                <circle cx={x(hover)} cy={y(points[hover - last - 1].value)} r={5} className="fill-surface stroke-brand-600" strokeWidth={2} />
              </>
            )}
          </g>
        )}

        {/* Hit areas wider than the marks: one column per month. */}
        {Array.from({ length: n }, (_, i) => (
          <rect key={i} x={x(i) - iw / (n - 1) / 2} y={pad.t} width={iw / (n - 1)} height={ih} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>

      {tip && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-[172px] -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs text-white shadow-pop"
          style={{ left: tipLeft }}
          role="status"
        >
          <p className="font-semibold">
            {monthLabel(tip.month, true)} · <span className="font-normal text-white/75">{tip.kind}</span>
          </p>
          {'v' in tip ? (
            <p className="mt-0.5 text-sm font-semibold tnum">{format(tip.v!)}</p>
          ) : (
            <>
              <p className="mt-0.5 text-sm font-semibold tnum">{format(tip.p!.value)} expected</p>
              <p className="text-white/75 tnum">
                Likely {format(tip.p!.low80)} to {format(tip.p!.high80)}
              </p>
            </>
          )}
        </div>
      )}

      <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-ink-2" aria-label="Legend">
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden>
            <line x1="1" x2="21" y1="4" y2="4" className="stroke-brand-600" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Actual
        </li>
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden>
            <line x1="1" x2="21" y1="4" y2="4" className="stroke-brand-600" strokeWidth="2" strokeDasharray="6 5" strokeLinecap="round" />
          </svg>
          Expected
        </li>
        <li className="flex items-center gap-2">
          <svg width="22" height="8" aria-hidden>
            <line x1="1" x2="21" y1="4" y2="4" className="stroke-brand-400" strokeWidth="1.5" strokeDasharray="1 4" strokeLinecap="round" />
          </svg>
          Optimistic and conservative paths
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-sm bg-brand-600/20" aria-hidden />
          Likely range (8 in 10)
        </li>
        <li className="flex items-center gap-2">
          <span className="h-2.5 w-5 rounded-sm bg-brand-600/8 ring-1 ring-brand-600/10" aria-hidden />
          Wider range (19 in 20)
        </li>
      </ul>
    </div>
  )
}
