import { Check, Circle } from 'lucide-react'
import { fmtStamp } from '../../lib/format'

export interface TimelineStep {
  label: string
  at?: string
  note?: string
  done: boolean
}

/** Vertical status timeline. Done steps carry the time they really happened; later steps are shown greyed. */
export function Timeline({ steps }: { steps: TimelineStep[] }) {
  return (
    <ol className="mt-3">
      {steps.map((st, i) => (
        <li key={`${st.label}-${i}`} className="relative flex gap-3 pb-4 last:pb-0">
          {i < steps.length - 1 && <span className={`absolute top-6 left-[11px] h-[calc(100%-20px)] w-0.5 ${steps[i + 1].done ? 'bg-brand-500' : 'bg-line'}`} aria-hidden />}
          <span className={`grid size-6 shrink-0 place-items-center rounded-full ${st.done ? 'bg-brand-600 text-white' : 'border-2 border-line bg-surface text-line'}`}>
            {st.done ? <Check className="size-3.5" aria-hidden /> : <Circle className="size-2" aria-hidden />}
          </span>
          <div>
            <p className={`text-sm font-medium ${st.done ? 'text-ink' : 'text-ink-3'}`}>
              {st.label}
              <span className="sr-only">{st.done ? ' (done)' : ' (not yet)'}</span>
            </p>
            {st.done && st.at && <p className="text-xs text-ink-2">{fmtStamp(st.at)}</p>}
            {st.note && <p className="mt-0.5 text-xs text-ink-2">{st.note}</p>}
          </div>
        </li>
      ))}
    </ol>
  )
}
