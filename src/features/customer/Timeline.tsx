import { Check, Circle } from 'lucide-react'
import { requestStatusLabel } from '../../domain/requests'
import { money } from '../../domain/rules'
import { fmtDate, fmtStamp } from '../../lib/format'
import type { Booking, Dataset } from '../../seed/types'

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

/** Booking progress from real events: the request (if any), payments and confirmation. */
export function bookingSteps(d: Dataset, b: Booking): TimelineStep[] {
  const payments = d.payments.filter((p) => p.bookingId === b.id)
  const m = money(b, d.payments)
  const cr = d.customRequests.find((r) => r.id === b.requestId)
  const vr = d.rentalRequests.find((r) => r.id === b.requestId)
  const req = cr ?? vr
  const steps: TimelineStep[] = []
  if (req) {
    const kind = cr ? 'custom' : 'rental'
    steps.push({ label: 'Request sent', at: req.createdAt, done: true, note: req.id })
    const sent = req.events.filter((e) => e.status === 'Proposal ready').at(-1)
    if (sent) steps.push({ label: `${requestStatusLabel('Proposal ready', kind) === 'Quote ready' ? 'Quote' : 'Proposal'} sent`, at: sent.at, done: true })
  }
  steps.push({ label: req ? 'Accepted, booking created' : 'Booking submitted', at: b.createdAt, done: true })
  steps.push({ label: 'Payment submitted', at: payments[0]?.submittedAt, done: payments.length > 0 })
  steps.push({ label: 'Payment verified', at: payments.find((p) => p.status === 'Verified')?.reviewedAt, done: m.paid > 0 })
  steps.push({ label: 'Booking confirmed', at: b.confirmedAt, done: b.status === 'Confirmed' || b.status === 'Completed' })
  steps.push({ label: 'Trip completed', done: b.status === 'Completed' })
  return steps
}

/**
 * Horizontal progress stepper drawn as a trip route: finished stops are filled, the next stop is marked in red,
 * and the road ahead stays dashed. Scrolls sideways on narrow screens rather than squeezing the labels.
 */
export function Stepper({ steps, label = 'Booking progress' }: { steps: TimelineStep[]; label?: string }) {
  const current = steps.findIndex((s) => !s.done)
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <ol className="flex min-w-full" aria-label={label}>
        {steps.map((st, i) => {
          const isNext = i === current
          return (
            <li key={`${st.label}-${i}`} className="relative min-w-[76px] flex-1 pr-2 sm:min-w-[112px]" aria-current={isNext ? 'step' : undefined}>
              {i < steps.length - 1 && (
                <span
                  className={`absolute top-[11px] left-6 right-0 h-0.5 ${steps[i + 1].done ? 'bg-brand-600' : 'route-line text-line-strong'}`}
                  aria-hidden
                />
              )}
              <span
                className={`relative grid size-6 place-items-center rounded-full ${st.done ? 'bg-brand-600 text-white' : isNext ? 'bg-sili text-white ring-4 ring-sili/15' : 'border-2 border-line-strong bg-surface'}`}
                aria-hidden
              >
                {st.done ? <Check className="size-3.5" /> : isNext ? <span className="size-2 rounded-full bg-white" /> : null}
              </span>
              <p className={`mt-2 text-xs leading-tight font-semibold sm:text-[13px] ${st.done ? 'text-ink' : isNext ? 'text-sili' : 'text-ink-3'}`}>
                {st.label}
                <span className="sr-only">{st.done ? ' (done)' : isNext ? ' (next)' : ' (not yet)'}</span>
              </p>
              {st.done && st.at && <p className="mt-0.5 text-xs text-ink-2">{fmtDate(st.at.slice(0, 10), { year: false })}</p>}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
