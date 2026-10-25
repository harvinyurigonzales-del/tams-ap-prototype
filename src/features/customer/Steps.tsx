import { Check } from 'lucide-react'

const STEPS = ['Date', 'Details', 'Review', 'Payment']

/** Booking-flow progress, drawn as the same route line as the rest of the customer side. */
export function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="mb-6">
      <p className="sr-only">
        Step {current} of {STEPS.length}: {STEPS[current - 1]}
      </p>
      <ol className="grid grid-cols-4" aria-hidden>
        {STEPS.map((s, i) => {
          const n = i + 1
          const done = n < current
          const here = n === current
          return (
            <li key={s} className="relative">
              {n < STEPS.length && <span className={`absolute top-[11px] left-6 right-0 h-0.5 ${done ? 'bg-brand-600' : 'route-line text-line-strong'}`} />}
              <span
                className={`relative grid size-6 place-items-center rounded-full text-xs font-bold ${done ? 'bg-brand-600 text-white' : here ? 'bg-sili text-white ring-4 ring-sili/15' : 'border-2 border-line-strong bg-surface text-ink-3'}`}
              >
                {done ? <Check className="size-3.5" /> : n}
              </span>
              <span className={`mt-1.5 block text-xs font-semibold sm:text-[13px] ${here ? 'text-sili' : done ? 'text-ink' : 'text-ink-3'}`}>{s}</span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
