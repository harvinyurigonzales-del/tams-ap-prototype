import { useState } from 'react'

// Hand-rolled SVG charts. Every chart is single-series in the brand hue, labels use text colours,
// values are also shown as text and in a table elsewhere, so nothing relies on colour alone.

export interface BarDatum {
  label: string
  value: number
  hint?: string
}

/** Vertical bars with a baseline, recessive grid, hover tooltip and a direct label on the highlighted bar. */
export function ColumnChart({ data, height = 180, format = String, title }: { data: BarDatum[]; height?: number; format?: (n: number) => string; title: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...data.map((d) => d.value))
  const top = Math.ceil(max / 2) * 2 || 2
  const W = 100 / data.length
  return (
    <figure className="w-full">
      <figcaption className="sr-only">{title}</figcaption>
      <div className="relative" style={{ height }}>
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2.5 left-0 bg-surface pr-1 text-[11px] text-ink-3 tnum">{format(Math.round(top * f))}</span>
          </div>
        ))}
        <div className="absolute inset-0 left-8 flex items-end">
          {data.map((d, i) => (
            <div
              key={d.label}
              className="relative flex h-full flex-col justify-end px-2 sm:px-4"
              style={{ width: `${W}%` }}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              tabIndex={0}
              aria-label={`${d.label}: ${format(d.value)}`}
            >
              <div
                className={`w-full rounded-t-[4px] transition-colors ${hover === i ? 'bg-brand-700' : 'bg-brand-500'}`}
                style={{ height: `${(d.value / top) * 100}%`, minHeight: d.value ? 2 : 0 }}
              />
              {hover === i && (
                <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 -translate-x-1/2 rounded-lg bg-ink px-2.5 py-1.5 text-xs whitespace-nowrap text-white shadow-pop">
                  <div className="font-semibold tnum">{format(d.value)}</div>
                  <div className="text-white/75">{d.hint ?? d.label}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-2 ml-8 flex">
        {data.map((d) => (
          <span key={d.label} className="truncate text-center text-[11px] text-ink-2" style={{ width: `${W}%` }}>
            {d.label}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** Horizontal bars with the value written at the end of each bar. */
export function BarList({ data, format = String, title, max: maxIn }: { data: BarDatum[]; format?: (n: number) => string; title: string; max?: number }) {
  const max = maxIn ?? Math.max(1, ...data.map((d) => d.value))
  return (
    <figure>
      <figcaption className="sr-only">{title}</figcaption>
      <ul className="space-y-3">
        {data.map((d) => (
          <li key={d.label} title={d.hint}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-ink">{d.label}</span>
              <span className="shrink-0 font-semibold text-ink tnum">{format(d.value)}</span>
            </div>
            <div className="h-2 rounded-full bg-surface-muted">
              <div className="h-2 rounded-full bg-brand-500" style={{ width: `${Math.min(100, (d.value / max) * 100)}%` }} />
            </div>
            {d.hint && <p className="mt-0.5 text-xs text-ink-3">{d.hint}</p>}
          </li>
        ))}
      </ul>
    </figure>
  )
}

/** Progress meter, e.g. seat utilisation. */
export function Meter({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max ? Math.round((value / max) * 100) : 0
  return (
    <div role="meter" aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-label={label}>
      <div className="h-2 rounded-full bg-surface-muted">
        <div className="h-2 rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
