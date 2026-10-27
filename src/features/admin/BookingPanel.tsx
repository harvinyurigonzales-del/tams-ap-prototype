import { assignmentIssue } from '../../domain/fleet'
import { demoReceiptSrc } from '../../lib/receipt'
import { CarFront, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { agreedOf } from '../../domain/packages'
import { assignableTargets, canCancel, canConfirm, money, rentalDays, shortRange } from '../../domain/rules'
import { fmtDate, fmtExact, fmtRange, fmtStamp, fmtTime, peso } from '../../lib/format'
import { useAdmin, useIsAdmin } from '../../state/adminStore'
import { deadlinesOf, paymentState, selfCancelOpen } from '../../domain/paymentPolicy'
import { DEMO_TODAY } from '../../lib/demoClock'
import { DeadlinePanel, TimelineUtility } from '../customer/PaymentDeadline'
import { useUi } from '../../state/ui'
import type { Payment } from '../../seed/types'
import { Badge, LocalTag, StatusBadge } from '../../ui/Badge'
import { Button, DisabledHint } from '../../ui/Button'
import { Row } from '../../ui/Card'
import { ConfirmDialog, Dialog } from '../../ui/Dialog'
import { Select, TextArea, TextField } from '../../ui/Field'
import { AssignDialog } from './Assign'
import { customerOf, serviceOf } from './common'

const REJECT_REASONS = [
  'Reference number does not match the statement.',
  'Amount does not match the booking.',
  'Receipt image is unclear.',
  'Other',
]

/** Booking Details side panel (left-variant design): verify, reject, confirm, cancel, assign. */
export function BookingPanel({ bookingId, onClose }: { bookingId: string; onClose: () => void }) {
  const { data, verifyPayment, rejectPayment, confirmBooking, cancelBooking, declineCancellation, completeBooking, sendReminder } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [verify, setVerify] = useState<Payment | null>(null)
  const [reject, setReject] = useState<Payment | null>(null)
  const [proof, setProof] = useState<Payment | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [cancel, setCancel] = useState(false)
  const [assign, setAssign] = useState(false)
  const [complete, setComplete] = useState(false)
  const [reason, setReason] = useState(REJECT_REASONS[0])
  const [other, setOther] = useState('')
  const [cancelReason, setCancelReason] = useState('')

  const b = data.bookings.find((x) => x.id === bookingId)
  if (!b) return null
  const s = serviceOf(data, b.serviceId)
  const c = customerOf(data, b.customerId)
  const m = money(b, data.payments)
  const payments = data.payments.filter((p) => p.bookingId === b.id)
  const conf = canConfirm(b, data.payments)
  const canc = canCancel(b)
  const target = assignableTargets(data).find((t) => (b.departureId ? t.kind === 'departure' && t.id === b.departureId : t.kind === 'booking' && t.id === b.id))
  const asg = target?.assignment
  const van = asg && data.vehicles.find((v) => v.id === asg.vehicleId)
  const drv = asg && data.drivers.find((d) => d.id === asg.driverId)
  const refund = data.refunds.find((r) => r.bookingId === b.id)

  return (
    <>
      <div className="fixed inset-0 z-40 bg-brand-900/30 xl:hidden" onClick={onClose} aria-hidden />
      <aside
        aria-label={`Booking ${b.id}`}
        className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-surface shadow-pop xl:sticky xl:top-20 xl:z-0 xl:h-[calc(100dvh-6.5rem)] xl:max-w-none xl:rounded-2xl xl:border xl:border-line xl:shadow-card"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Booking details</p>
            <h2 className="font-display text-lg font-semibold text-ink">
              {b.id} {b.origin === 'local' && <LocalTag />}
            </h2>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <StatusBadge status={b.status} />
              {m.submitted.length > 0 ? <Badge tone="warn">Awaiting verification</Badge> : <StatusBadge status={m.summary} />}
              {b.cancellationRequested && b.status !== 'Cancelled' && <StatusBadge status="Cancellation requested" />}
            </div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 text-ink-2 hover:bg-surface-muted" aria-label="Close details">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Trip</h3>
            <p className="text-sm font-semibold text-ink">{b.label ?? s.name}</p>
            {b.requestId && (
              <p className="text-sm text-ink-2">
                From request{' '}
                <Link to={`/admin/requests?id=${b.requestId}`} className="font-semibold text-brand-700 hover:underline">
                  {b.requestId}
                </Link>
              </p>
            )}
            <p className="text-sm text-ink-2">{fmtRange(b.startDate, b.endDate)}</p>
            <p className="text-sm text-ink-2">
              {b.rental ? `${b.rental.pickup} → ${b.rental.destination}, ${rentalDays(b.startDate, b.endDate)} days` : `Pickup ${fmtTime(agreedOf(data, b).pickupTime)}, ${agreedOf(data, b).pickup}`}
            </p>
            <p className="text-sm text-ink-2">{b.pax} pax · booked {fmtStamp(b.createdAt)}</p>
            {b.notes && <p className="mt-1 text-sm text-ink-2">Notes: {b.notes}</p>}
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Customer</h3>
            <Link to={`/admin/customers?id=${b.customerId}`} className="text-sm font-semibold text-brand-700 hover:underline">
              {c?.name}
            </Link>
            <p className="text-sm text-ink-2">
              {b.contactMobile} · {c?.email}
            </p>
          </section>

          <section>
            <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Amounts</h3>
            <Row label={b.requestId ? `Accepted ${b.requestId.startsWith('VR-') ? 'quote' : 'proposal'}` : b.rental ? `${peso(b.unitPrice)} × ${rentalDays(b.startDate, b.endDate)} days` : `${peso(b.unitPrice)} × ${b.pax}${b.promoOff ? `, less ${peso(b.promoOff)} promo each` : ''}`}>{peso(b.total)}</Row>
            <Row label="Down payment (50%)">{peso(m.down)}</Row>
            <DeadlinePanel data={data} booking={b} who="staff" />
            {(b.status === 'Pending' || b.status === 'Confirmed') && <p className="mt-2 text-xs text-ink-2">Customer self-service cancellation: {selfCancelOpen(data, b) ? `open until ${fmtExact(deadlinesOf(data, b).selfCancelUntil)}` : 'closed (72 hours before departure). Staff can still cancel for exceptional cases.'}</p>}
            {paymentState(data, b).stage === 'needs-resolution' && <RevisedCutoff bookingId={b.id} />}
            {b.status === 'Cancelled' && (
              <p className="mt-2 rounded-lg bg-bad-bg px-3 py-2 text-xs text-bad">
                Cancelled{b.cancelledAt ? ` ${fmtStamp(b.cancelledAt)}` : ''}
                {b.cancelledBy === 'system' ? ' automatically' : b.cancelledBy === 'customer' ? ' at the customer’s request' : b.cancelledBy === 'staff' ? ' by staff' : ''}: {b.cancelReason}.{' '}
                {refund ? `Refund review ${refund.id}: ${refund.status}.` : m.paid > 0 ? 'Verified payments are on record.' : 'No payment was received, so no refund is due.'}
              </p>
            )}
          </section>

          {refund && (
            <section>
              <RefundAdmin refundId={refund.id} />
            </section>
          )}

          <section>
            <h3 className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Payments</h3>
            {payments.length === 0 && <p className="text-sm text-ink-2">No payments submitted yet.</p>}
            <ul className="space-y-2">
              {payments.map((p) => (
                <li key={p.id} className="rounded-xl border border-line p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-ink">
                        {peso(p.amount)} · {p.type}
                      </p>
                      <p className="text-xs text-ink-2">
                        {p.id} · {p.method} · Ref {p.reference}
                      </p>
                      <p className="text-xs text-ink-3">
                        Sent {fmtStamp(p.submittedAt)}
                        {p.reviewedAt && ` · reviewed ${fmtStamp(p.reviewedAt)}`}
                      </p>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  {p.rejectReason && <p className="mt-2 rounded-lg bg-bad-bg px-2.5 py-1.5 text-xs text-bad">{p.rejectReason}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setProof(p)}>
                      View proof
                    </Button>
                    {p.status === 'Submitted' && (
                      <>
                        <Button size="sm" onClick={() => setVerify(p)}>
                          Verify payment
                        </Button>
                        <Button size="sm" variant="secondary" onClick={() => setReject(p)}>
                          Reject
                        </Button>
                      </>
                    )}
                  </div>
                </li>
              ))}
            </ul>
            {payments.length > 0 && m.submitted.length === 0 && b.status === 'Pending' && (
              <DisabledHint>Verify and Reject appear when the customer submits a payment.</DisabledHint>
            )}
          </section>

          {(b.status === 'Confirmed' || b.status === 'Pending') && (
            <section>
              <h3 className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Van and driver</h3>
              {asg ? (
                <p className="flex items-center gap-2 text-sm text-ink">
                  <CarFront className="size-4 text-brand-600" aria-hidden /> {van?.name} ({van?.plate}) · {drv?.name}
                </p>
              ) : (
                <p className="text-sm text-ink-2">{target ? 'Not assigned yet.' : 'Assign after the booking is confirmed.'}</p>
              )}
              {asg && assignmentIssue(data, asg) && (
                <p className="mt-1 rounded-lg bg-bad-bg px-2.5 py-1.5 text-xs font-semibold text-bad">Needs reassignment · {assignmentIssue(data, asg)}</p>
              )}
              {b.departureId && asg && <p className="text-xs text-ink-3">Shared by everyone on this departure.</p>}
            </section>
          )}

          <TimelineUtility data={data} booking={b} />
        </div>

        <div className="space-y-2 border-t border-line px-5 py-4">
          {b.cancellationRequested && (b.status === 'Pending' || b.status === 'Confirmed') && (
            <div className="rounded-xl bg-warn-bg p-3">
              <p className="text-sm font-semibold text-ink">The customer asked to cancel.</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button
                  size="sm"
                  variant="danger"
                  disabled={!canc.ok}
                  onClick={() => {
                    setCancelReason('Cancelled at the customer’s request')
                    setCancel(true)
                  }}
                >
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const r = declineCancellation(b.id)
                    toast(r.ok ? 'Cancellation declined. The customer was notified.' : r.error, r.ok ? 'info' : 'error')
                  }}
                >
                  Decline
                </Button>
              </div>
            </div>
          )}
          {b.status === 'Confirmed' && (
            <div>
              <Button full disabled={m.balance > 0 || !!b.cancellationRequested} onClick={() => setComplete(true)} aria-describedby="complete-hint">
                Mark trip completed
              </Button>
              {m.balance > 0 && <DisabledHint id="complete-hint">The balance of {peso(m.balance)} must be verified first.</DisabledHint>}
            </div>
          )}
          {b.status === 'Confirmed' && (
            <Button
              full
              variant="ghost"
              onClick={() => {
                const r = sendReminder(b.id)
                toast(r.ok ? 'Trip reminder sent to the customer.' : r.error, r.ok ? 'success' : 'error')
              }}
            >
              Send trip reminder
            </Button>
          )}
          {b.status === 'Pending' && (
            <div>
              <Button full disabled={!conf.ok} onClick={() => setConfirm(true)} aria-describedby="confirm-hint">
                Confirm booking
              </Button>
              {!conf.ok && <DisabledHint id="confirm-hint">{conf.reason}</DisabledHint>}
            </div>
          )}
          {target && (
            <Button full variant="secondary" icon={<CarFront className="size-4" aria-hidden />} onClick={() => setAssign(true)}>
              {asg ? 'Change van and driver' : 'Assign van and driver'}
            </Button>
          )}
          {(b.status === 'Pending' || b.status === 'Confirmed') && (
            <div>
              <Button full variant="ghost" className="text-bad hover:bg-bad-bg" disabled={!canc.ok} onClick={() => setCancel(true)}>
                Cancel booking
              </Button>
              {!canc.ok && <DisabledHint>{canc.reason}</DisabledHint>}
            </div>
          )}
        </div>
      </aside>

      <Dialog
        open={!!proof}
        onClose={() => setProof(null)}
        title={`Payment proof · ${proof?.id ?? ''}`}
        footer={
          proof?.status === 'Submitted' ? (
            <>
              <Button variant="secondary" onClick={() => { const p = proof; setProof(null); setReject(p) }}>
                Reject
              </Button>
              <Button onClick={() => { const p = proof; setProof(null); setVerify(p) }}>Verify payment</Button>
            </>
          ) : undefined
        }
      >
        {proof && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2 rounded-xl bg-surface-muted p-3 text-sm">
              <span>Amount</span>
              <span className="text-right font-semibold text-ink tnum">{peso(proof.amount)}</span>
              <span>Method</span>
              <span className="text-right text-ink">{proof.method}</span>
              <span>Reference</span>
              <span className="text-right text-ink">{proof.reference}</span>
            </div>
            <img
              src={demoReceiptSrc({ method: proof.method, amount: proof.amount, reference: proof.reference, at: proof.submittedAt, note: proof.type === 'Full' ? 'Full payment' : proof.type })}
              alt="Sample receipt (fictional)"
              className="mx-auto max-h-[50vh] rounded-lg border border-line"
            />
            <p className="text-center text-xs text-ink-3">Fictional sample receipt. Compare the amount and reference before verifying.</p>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!verify}
        onClose={() => setVerify(null)}
        title="Verify this payment?"
        body={verify ? `${peso(verify.amount)} via ${verify.method}, reference ${verify.reference}. Paid and balance update immediately.` : ''}
        confirmLabel="Verify payment"
        delay={500}
        onConfirm={() => {
          const r = verifyPayment(verify!.id)
          if (!r.ok) return r.error
          toast(`Payment verified. ${b.status === 'Pending' ? 'You can now confirm the booking.' : ''}`)
        }}
      />

      <ConfirmDialog
        open={!!reject}
        onClose={() => setReject(null)}
        title="Reject this payment?"
        body="The customer sees the reason and can send new proof. The booking status does not change."
        confirmLabel="Reject payment"
        tone="danger"
        onConfirm={() => {
          const r = rejectPayment(reject!.id, reason === 'Other' ? other : reason)
          if (!r.ok) return r.error
          toast('Payment rejected. The customer can submit new proof.', 'info')
        }}
      >
        <Select label="Reason" value={reason} onChange={(e) => setReason(e.target.value)}>
          {REJECT_REASONS.map((r) => (
            <option key={r}>{r}</option>
          ))}
        </Select>
        {reason === 'Other' && <TextArea label="Describe the problem" value={other} onChange={(e) => setOther(e.target.value)} maxLength={200} />}
      </ConfirmDialog>

      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Confirm this booking?"
        body={`${b.id}, ${s.name}, ${shortRange(b.startDate, b.endDate)}, ${b.pax} pax. Verified ${peso(m.paid)} of ${peso(b.total)}.`}
        confirmLabel="Confirm booking"
        delay={400}
        onConfirm={() => {
          const r = confirmBooking(b.id)
          if (!r.ok) return r.error
          toast(`${b.id} confirmed.`)
        }}
      />

      <ConfirmDialog
        open={cancel}
        onClose={() => setCancel(false)}
        title="Cancel this booking?"
        body="Seats are released right away. Verified payments stay in collections; refunds are handled separately."
        confirmLabel="Cancel booking"
        tone="danger"
        onConfirm={() => {
          const r = cancelBooking(b.id, cancelReason)
          if (!r.ok) return r.error
          setCancelReason('')
          toast(`${b.id} cancelled.`, 'info')
        }}
      >
        <TextArea label="Reason" value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} maxLength={200} placeholder="e.g. Customer request: schedule conflict" />
      </ConfirmDialog>

      <ConfirmDialog
        open={complete}
        onClose={() => setComplete(false)}
        title="Mark this trip completed?"
        body={`${b.id}, ${b.label ?? s.name}, ${shortRange(b.startDate, b.endDate)}. ${c?.name ?? 'The customer'} is notified and can rate the trip.`}
        confirmLabel="Mark completed"
        onConfirm={() => {
          const r = completeBooking(b.id)
          if (!r.ok) return r.error
          toast(`${b.id} marked completed.`)
        }}
      />

      {assign && target && <AssignDialog target={target} onClose={() => setAssign(false)} />}
    </>
  )
}

function RevisedCutoff({ bookingId }: { bookingId: string }) {
  const setRevisedCutoff = useAdmin((s) => s.setRevisedCutoff)
  const toast = useUi((s) => s.toast)
  const [hours, setHours] = useState('24')
  const [note, setNote] = useState('Please send a clear photo of the receipt with the reference number.')
  const [error, setError] = useState('')
  return (
    <div className="mt-3 rounded-xl border border-warn/40 bg-warn-bg p-3">
      <p className="text-sm font-semibold text-ink">Set a revised payment deadline</p>
      <p className="text-xs text-ink-2">The customer paid before the cutoff but the payment was rejected. Give them a final cutoff, or cancel the booking yourself.</p>
      <div className="mt-2 grid gap-2">
        <Select label="New final cutoff" value={hours} onChange={(e) => setHours(e.target.value)}>
          {['6', '12', '24', '48'].map((h) => (
            <option key={h} value={h}>
              {h} hours from now
            </option>
          ))}
        </Select>
        <TextArea label="Note to the customer" rows={2} value={note} onChange={(e) => setNote(e.target.value)} error={error} />
        <Button
          size="sm"
          onClick={() => {
            const r = setRevisedCutoff(bookingId, Number(hours), note)
            if (!r.ok) return setError(r.error)
            setError('')
            toast('Revised deadline sent to the customer.')
          }}
        >
          Send revised deadline
        </Button>
      </div>
    </div>
  )
}

/** Refund review: proposed amount, the admin decision and the recorded transfer, kept apart from booking and payment status. */
function RefundAdmin({ refundId }: { refundId: string }) {
  const { data, decideRefund, recordRefund } = useAdmin()
  const admin = useIsAdmin()
  const toast = useUi((s) => s.toast)
  const r = data.refunds.find((x) => x.id === refundId)!
  const [mode, setMode] = useState<'approve' | 'none' | 'record' | null>(null)
  const [amount, setAmount] = useState(r.proposed)
  const [note, setNote] = useState('')
  const [rec, setRec] = useState({ method: 'GCash', reference: '', date: DEMO_TODAY, note: '' })
  const [error, setError] = useState('')
  const done = (msg: string) => (setMode(null), setError(''), toast(msg))
  return (
    <div className="rounded-xl border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Refund review</h3>
        <Badge tone={r.status === 'Processed' ? 'ok' : r.status === 'Pending review' ? 'warn' : r.status === 'Approved' ? 'info' : 'neutral'}>{r.status}</Badge>
      </div>
      <p className="mt-1 text-xs text-ink-2">
        {r.id} · opened {fmtStamp(r.createdAt)} · {r.reason}
      </p>
      <div className="mt-2">
        <Row label="Verified amount paid">{peso(r.paid)}</Row>
        <Row label="Deductions">{r.deductions.length ? `−${peso(r.deductions.reduce((n, x) => n + x.amount, 0))}` : 'None'}</Row>
        <Row label={r.decision ? 'Decided refund' : 'Proposed refund'} strong>
          {peso(r.decision ? r.decision.amount : r.proposed)}
        </Row>
      </div>
      <p className="mt-1 text-xs text-ink-3">No deduction policy is set, so none apply. Booking, payment and refund statuses are tracked separately.</p>
      {r.decision && (
        <p className="mt-2 text-xs text-ink-2">
          {r.status === 'No refund due' ? 'No refund due' : 'Approved'} by {r.decision.by} · {fmtStamp(r.decision.at)}: {r.decision.note}
        </p>
      )}
      {r.processed && (
        <p className="mt-1 text-xs text-ink-2">
          Sent {fmtDate(r.processed.date)} by {r.processed.method}, ref {r.processed.reference}. Recorded by {r.processed.by}.
        </p>
      )}
      {r.status === 'Pending review' && !admin && <p className="mt-2 text-xs text-ink-2">An admin approves the refund amount or records that none is due.</p>}
      {r.status === 'Pending review' && admin && mode === null && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => (setMode('approve'), setNote(''))}>
            Approve refund
          </Button>
          <Button size="sm" variant="ghost" onClick={() => (setMode('none'), setNote(''))}>
            No refund due
          </Button>
        </div>
      )}
      {r.status === 'Approved' && mode === null && (
        <Button size="sm" className="mt-2" onClick={() => setMode('record')}>
          Record refund sent
        </Button>
      )}
      {(mode === 'approve' || mode === 'none') && (
        <div className="mt-2 grid gap-2">
          {mode === 'approve' && <TextField label="Refund amount (₱)" type="number" inputMode="numeric" value={amount || ''} onChange={(e) => setAmount(Number(e.target.value) || 0)} />}
          <TextArea label={mode === 'approve' ? 'Decision note' : 'Why no refund is due'} rows={2} value={note} onChange={(e) => setNote(e.target.value)} error={error} />
          <p className="text-xs text-ink-3">Approving does not send money. Record the transfer once it is made.</p>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const res = decideRefund(r.id, mode === 'approve', amount, note)
                if (!res.ok) return setError(res.error)
                done(mode === 'approve' ? 'Refund approved.' : 'Recorded that no refund is due.')
              }}
            >
              Save decision
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {mode === 'record' && (
        <div className="mt-2 grid gap-2">
          <Select label="Sent by" value={rec.method} onChange={(e) => setRec({ ...rec, method: e.target.value })}>
            {['GCash', 'Maya', 'Bank transfer', 'Cash'].map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
          <TextField label="Transfer reference" value={rec.reference} onChange={(e) => setRec({ ...rec, reference: e.target.value })} />
          <TextField label="Date sent" type="date" max={DEMO_TODAY} value={rec.date} onChange={(e) => setRec({ ...rec, date: e.target.value })} />
          <TextArea label="Note (optional)" rows={2} value={rec.note} onChange={(e) => setRec({ ...rec, note: e.target.value })} error={error} />
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                const res = recordRefund(r.id, rec)
                if (!res.ok) return setError(res.error)
                done('Refund recorded as processed.')
              }}
            >
              Save as processed
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setMode(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
