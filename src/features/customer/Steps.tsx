const STEPS = ['Date', 'Details', 'Review', 'Payment']

/** "Step 2 of 4" indicator, from the Roamly reference pattern. */
export function Steps({ current }: { current: 1 | 2 | 3 | 4 }) {
  return (
    <div className="mb-5">
      <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">
        Step {current} of {STEPS.length} · {STEPS[current - 1]}
      </p>
      <div className="mt-2 grid grid-cols-4 gap-1.5" aria-hidden>
        {STEPS.map((s, i) => (
          <span key={s} className={`h-1.5 rounded-full ${i < current ? 'bg-brand-600' : 'bg-brand-100'}`} />
        ))}
      </div>
    </div>
  )
}
