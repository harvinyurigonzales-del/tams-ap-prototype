import { CarFront, X } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { assignableTargets, canCancel, canConfirm, money, rentalDays, shortRange } from '../../domain/rules'
import { fmtDate, fmtRange, fmtStamp, fmtTime, peso } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import type { Payment } from '../../seed/types'
import { Badge, LocalTag, StatusBadge } from '../../ui/Badge'
import { Button, DisabledHint } from '../../ui/Button'
import { Row } from '../../ui/Card'
import { ConfirmDialog, Dialog } from '../../ui/Dialog'
import { Select, TextArea } from '../../ui/Field'
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
  const { data, verifyPayment, rejectPayment, confirmBooking, cancelBooking } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [verify, setVerify] = useState<Payment | null>(null)
  const [reject, setReject] = useState<Payment | null>(null)
  const [proof, setProof] = useState<Payment | null>(null)
  const [confirm, setConfirm] = useState(false)
  const [cancel, setCancel] = useState(false)
  const [assign, setAssign] = useState(false)
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
            <p className="text-sm font-semibold text-ink">{s.name}</p>
            <p className="text-sm text-ink-2">{fmtRange(b.startDate, b.endDate)}</p>
            <p className="text-sm text-ink-2">
              {b.rental ? `${b.rental.pickup} → ${b.rental.destination}, ${rentalDays(b.startDate, b.endDate)} days` : `Pickup ${fmtTime(s.pickupTime)}, ${s.pickup}`}
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
            <Row label={b.rental ? `${peso(b.unitPrice)} × ${rentalDays(b.startDate, b.endDate)} days` : `${peso(b.unitPrice)} × ${b.pax}${b.promoOff ? `, less ${peso(b.promoOff)} promo each` : ''}`}>{peso(b.total)}</Row>
            <Row label="Down payment (50%)">{peso(m.down)}</Row>
            <Row label="Paid (verified)">{peso(m.paid)}</Row>
            <Row label="Balance" strong>
              {peso(m.balance)}
            </Row>
            {b.status !== 'Cancelled' && m.balance > 0 && <p className="text-xs text-ink-2">Balance due {fmtDate(m.dueDate, { weekday: true })}</p>}
            {b.status === 'Cancelled' && (
              <p className="mt-2 rounded-lg bg-bad-bg px-3 py-2 text-xs text-bad">
                Cancelled{b.cancelledAt ? ` ${fmtStamp(b.cancelledAt)}` : ''}: {b.cancelReason}. Refund handled outside the prototype.
              </p>
            )}
          </section>

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
              {b.departureId && asg && <p className="text-xs text-ink-3">Shared by everyone on this departure.</p>}
            </section>
          )}
        </div>

        <div className="space-y-2 border-t border-line px-5 py-4">
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
            <img src="/sample-receipt.svg" alt="Sample receipt (fictional)" className="mx-auto max-h-[50vh] rounded-lg border border-line" />
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
        body="Seats are released right away. Verified payments stay in collections; refunds are handled outside the prototype."
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

      {assign && target && <AssignDialog target={target} onClose={() => setAssign(false)} />}
    </>
  )
}
