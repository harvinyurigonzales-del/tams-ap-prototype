import { AlarmClock, ChevronDown, Clock3, RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { deadlinesOf, GRACE_HOURS, paymentState, policyNow, selfCancelOpen, type PaymentState } from '../../domain/paymentPolicy'
import { fmtDate, fmtExact, peso } from '../../lib/format'
import { advanceTimeline, restoreTimeline, samplePayment, type SampleAction, type TimelineStep } from '../../state/timeline'
import { useUi } from '../../state/ui'
import type { Booking, Dataset, RefundReview } from '../../seed/types'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Row } from '../../ui/Card'

// Payment deadlines as customers and staff see them. Both read the same policy (domain/paymentPolicy.ts).

const TONE: Record<PaymentState['stage'], 'ok' | 'neutral' | 'warn' | 'bad' | 'info'> = {
  'not-applicable': 'neutral', paid: 'ok', upcoming: 'info', reminder: 'warn', due: 'warn', overdue: 'bad', verifying: 'info', 'needs-resolution': 'warn', cancel: 'bad', cancelled: 'neutral',
}
const LABEL: Record<PaymentState['stage'], string> = {
  'not-applicable': 'Settled with staff', paid: 'Fully paid', upcoming: 'Balance not yet due', reminder: 'Due within 24 hours', due: 'Payment due now', overdue: 'Overdue · grace period',
  verifying: 'Awaiting verification', 'needs-resolution': 'Needs follow-up', cancel: 'Deadline missed', cancelled: 'Cancelled',
}

/** One-line explanation of where a booking is in its payment timeline. */
export function stageMessage(st: PaymentState, who: 'customer' | 'staff') {
  const amount = peso(st.balance)
  switch (st.stage) {
    case 'paid':
      return 'Fully paid. Nothing more is due, and the booking cannot be cancelled for non-payment.'
    case 'upcoming':
      return `${amount} is due by ${fmtExact(st.dueAt)}. ${who === 'customer' ? 'We’ll remind you' : 'A reminder goes out'} 24 hours before.`
    case 'reminder':
      return `Reminder: ${amount} is due by ${fmtExact(st.dueAt)}.`
    case 'due':
      return st.late
        ? `Booked within 72 hours of departure, so the full ${amount} is due now. Final cutoff: ${fmtExact(st.cutoffAt)}.`
        : `Payment is due now. Deadline: ${fmtExact(st.dueAt)}.`
    case 'overdue':
      return `Overdue since ${fmtExact(st.dueAt)}. The ${GRACE_HOURS}-hour grace period ends ${fmtExact(st.cutoffAt)}.`
    case 'verifying':
      return who === 'customer'
        ? `Your ${peso(st.pending!.amount)} payment arrived before the cutoff. The booking stays active while staff verify it.`
        : `${peso(st.pending!.amount)} was sent before the cutoff. Automatic cancellation is paused: verify or reject it.`
    case 'needs-resolution':
      return who === 'customer'
        ? 'Staff could not verify your payment. Your booking is not cancelled; staff will contact you with the next step.'
        : 'The payment was rejected after the deadline. Set a revised deadline or cancel the booking; it will not be cancelled automatically.'
    case 'cancel':
      return 'The final cutoff has passed. The booking is being cancelled.'
    case 'not-applicable':
      return 'The trip has started or finished. Any balance is settled with staff.'
    default:
      return ''
  }
}

/** Amount paid, balance, exact deadlines and the consequence of missing them. */
export function DeadlinePanel({ data, booking: b, who }: { data: Dataset; booking: Booking; who: 'customer' | 'staff' }) {
  const st = paymentState(data, b)
  const open = b.status === 'Pending' || b.status === 'Confirmed'
  return (
    <div>
      <Row label="Total">{peso(b.total)}</Row>
      <Row label="Paid (verified)">{peso(st.paid)}</Row>
      <Row label="Remaining balance" strong>
        {peso(st.balance)}
      </Row>
      {open && st.stage !== 'paid' && st.stage !== 'not-applicable' && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-surface-muted p-3 text-sm">
          <p className="flex items-center gap-2">
            <Badge tone={TONE[st.stage]}>{LABEL[st.stage]}</Badge>
          </p>
          <p className="text-ink">{stageMessage(st, who)}</p>
          <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs text-ink-2">
            <dt>{st.late ? 'Pay in full by' : 'Payment deadline'}</dt>
            <dd className="font-medium text-ink">{fmtExact(st.late ? st.cutoffAt : st.dueAt)}</dd>
            {!st.late && (
              <>
                <dt>{b.revisedCutoff ? 'Revised final cutoff' : 'Grace period ends'}</dt>
                <dd className="font-medium text-ink">{fmtExact(st.cutoffAt)}</dd>
              </>
            )}
            <dt>Departure</dt>
            <dd>{fmtExact(st.departAt)}</dd>
          </dl>
          {b.revisedBy && <p className="text-xs text-ink-2">Note from staff: {b.revisedBy.note}</p>}
          {st.stage !== 'verifying' && st.stage !== 'needs-resolution' && (
            <p className="text-xs text-ink-2">If the balance is still unpaid at the final cutoff, the booking is cancelled automatically and its seats are released.</p>
          )}
        </div>
      )}
      {open && st.stage === 'paid' && <p className="mt-2 text-xs text-ink-2">{stageMessage(st, who)}</p>}
    </div>
  )
}

/** The self-service cancellation rule, shown in booking details. */
export function cancelRule(data: Dataset, b: Booking) {
  const dl = deadlinesOf(data, b)
  return selfCancelOpen(data, b)
    ? `You can request a cancellation until ${fmtExact(dl.selfCancelUntil)} (72 hours before departure).`
    : `Online cancellation requests closed at ${fmtExact(dl.selfCancelUntil)}, 72 hours before departure. Contact staff for exceptional circumstances.`
}

export function RefundCard({ refund: r }: { refund: RefundReview }) {
  const deducted = r.deductions.reduce((n, x) => n + x.amount, 0)
  const tone = r.status === 'Processed' ? 'ok' : r.status === 'No refund due' ? 'neutral' : r.status === 'Approved' ? 'info' : 'warn'
  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <h2 className="type-head text-[22px] text-charcoal">Refund</h2>
        <Badge tone={tone}>{r.status}</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-2">
        {r.id} · {r.reason}
      </p>
      <div className="mt-3">
        <Row label="Verified amount paid">{peso(r.paid)}</Row>
        {r.deductions.length === 0 ? (
          <Row label="Deductions">None</Row>
        ) : (
          r.deductions.map((x, i) => (
            <Row key={i} label={`${x.label} (${x.reason})`}>
              −{peso(x.amount)}
            </Row>
          ))
        )}
        <Row label={r.decision ? 'Refund decided' : 'Proposed refund'} strong>
          {peso(r.decision ? r.decision.amount : r.proposed - deducted)}
        </Row>
      </div>
      <p className="mt-2 text-xs text-ink-2">
        {r.status === 'Pending review' && 'Staff are reviewing the refund. Nothing has been sent yet; you’ll be notified of the decision.'}
        {r.status === 'Approved' && `Approved by staff${r.decision?.note ? `: ${r.decision.note}` : '.'} The transfer has not been recorded yet.`}
        {r.status === 'Processed' && r.processed && `Sent by ${r.processed.method} on ${fmtDate(r.processed.date)}, reference ${r.processed.reference}.`}
        {r.status === 'No refund due' && `No refund is due. ${r.decision?.note ?? ''}`}
      </p>
    </div>
  )
}

/**
 * Presentation utility: moves this one booking's clock through its payment timeline. Discreet by design: it
 * opens from a small link and shows the booking's effective time only inside itself.
 */
export function TimelineUtility({ data, booking: b }: { data: Dataset; booking: Booking }) {
  const toast = useUi((s) => s.toast)
  const preview = data.previews.find((p) => p.bookingId === b.id)
  const [open, setOpen] = useState(!!preview)
  if (!preview && b.status !== 'Pending' && b.status !== 'Confirmed') return null
  const st = paymentState(data, b)
  const run = (r: { ok: true; message: string } | { ok: false; error: string }) => toast(r.ok ? r.message : r.error, r.ok ? 'info' : 'error')
  const step = (s: TimelineStep) => run(advanceTimeline(b.id, s))
  const sample = (s: SampleAction) => run(samplePayment(b.id, s))
  return (
    <div className="rounded-2xl border border-dashed border-line-strong p-3 text-sm">
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)} className="flex w-full items-center justify-between gap-2 text-left font-semibold text-ink-2">
        <span className="inline-flex items-center gap-1.5">
          <AlarmClock className="size-4" aria-hidden /> Preview payment timeline
        </span>
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          <p className="text-xs text-ink-2">
            For presentations. Moves the clock for <span className="font-semibold">{b.id}</span> only, using the same deadline rules as every booking. Restore puts this booking back as it was.
          </p>
          <p className="flex items-center gap-1.5 rounded-lg bg-surface-muted px-2.5 py-1.5 text-xs">
            <Clock3 className="size-3.5" aria-hidden />
            <span>
              Effective time for this booking: <span className="font-semibold text-ink">{fmtExact(policyNow(data, b.id))}</span>
              {preview ? ' (preview)' : ' (now)'}
            </span>
          </p>
          <div className="grid gap-1.5">
            <Button size="sm" variant="secondary" onClick={() => step('reminder')}>
              Advance to reminder
            </Button>
            <Button size="sm" variant="secondary" onClick={() => step('deadline')}>
              Advance to payment deadline
            </Button>
            <Button size="sm" variant="secondary" onClick={() => step('past-grace')}>
              Advance past grace period
            </Button>
          </div>
          {(b.status === 'Pending' || b.status === 'Confirmed') && st.balance > 0 && (
            <div>
              <p className="text-xs font-semibold text-ink-2">Fictional sample payments</p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {st.paid === 0 && (
                  <Button size="sm" variant="ghost" onClick={() => sample('down')}>
                    Verified down payment
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => sample('full')}>
                  Verified full balance
                </Button>
                <Button size="sm" variant="ghost" onClick={() => sample('pending')}>
                  Balance awaiting verification
                </Button>
              </div>
            </div>
          )}
          {preview && (
            <Button size="sm" variant="ghost" icon={<RotateCcw className="size-4" aria-hidden />} onClick={() => run(restoreTimeline(b.id))}>
              Restore scenario
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
