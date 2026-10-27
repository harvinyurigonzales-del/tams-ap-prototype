import { addHours, demoNow, isoMs } from '../lib/demoClock'
import { fmtExact, peso } from '../lib/format'
import { nextId } from '../state/ids'
import type { AppNotification, Booking, Dataset, Payment, RefundReview } from '../seed/types'
import { logActivity } from './activity'
import { agreedOf } from './packages'
import { amountPaid, assignableTargets } from './rules'

// One payment-deadline policy for every booking, in exact Asia/Manila timestamps.
//
//   departure − 96h  reminder (24 hours before the deadline)
//   departure − 72h  balance due; self-service cancellation closes at the same moment
//   departure − 48h  end of the 24-hour grace period: an unpaid balance cancels the booking
//
// The grace period extends the deadline; it does not move the due date. A booking made inside the 72-hour window is
// paid in full at once, with the grace-period end as its cutoff. Deadlines are checked whenever the app loads or the
// records change: this is a browser prototype, so nothing runs while the app is closed.

export const BALANCE_DUE_HOURS = 72
export const REMINDER_HOURS = 24
export const GRACE_HOURS = 24
export const SELF_CANCEL_HOURS = 72
export const MISSED_REASON = 'Payment deadline missed'

export interface Deadlines {
  departAt: string
  reminderAt: string
  dueAt: string
  graceEndAt: string
  /** When an unpaid balance cancels the booking: the grace-period end, or a revised cutoff set by staff. */
  cutoffAt: string
  /** Booked inside the 72-hour window, so the full amount is due straight away. */
  late: boolean
  selfCancelUntil: string
}

export const departureAt = (d: Dataset, b: Booking) => `${b.startDate}T${agreedOf(d, b).pickupTime}:00+08:00`

export function deadlinesOf(d: Dataset, b: Booking): Deadlines {
  const departAt = departureAt(d, b)
  const dueAt = addHours(departAt, -BALANCE_DUE_HOURS)
  const graceEndAt = addHours(dueAt, GRACE_HOURS)
  return {
    departAt, dueAt, graceEndAt, reminderAt: addHours(dueAt, -REMINDER_HOURS), cutoffAt: b.revisedCutoff ?? graceEndAt,
    late: isoMs(b.createdAt) >= isoMs(dueAt), selfCancelUntil: addHours(departAt, -SELF_CANCEL_HOURS),
  }
}

/** The time deadlines are measured against for a booking: its timeline preview, or the app's current time. */
export const policyNow = (d: Dataset, bookingId: string) => d.previews?.find((p) => p.bookingId === bookingId)?.at ?? demoNow()

export type PaymentStage =
  | 'not-applicable'
  | 'paid'
  | 'upcoming'
  | 'reminder'
  | 'due'
  | 'overdue'
  | 'verifying'
  | 'needs-resolution'
  | 'cancel'
  | 'cancelled'

export interface PaymentState extends Deadlines {
  stage: PaymentStage
  now: string
  paid: number
  balance: number
  /** A payment sent before the cutoff that covers the balance and waits for staff. */
  pending?: Payment
  /** A payment staff rejected after the deadline, which needs a follow-up before anything is cancelled. */
  rejected?: Payment
}

/** A submitted payment that would settle the balance and arrived before the cutoff, with a reference and proof. */
export function qualifyingPayment(payments: Payment[], b: Booking, balance: number, cutoffAt: string) {
  return payments.find(
    (p) => p.bookingId === b.id && p.status === 'Submitted' && p.amount >= balance && !!p.reference.trim() && p.proof !== 'none' && isoMs(p.submittedAt) < isoMs(cutoffAt),
  )
}

export function paymentState(d: Dataset, b: Booking, now = policyNow(d, b.id)): PaymentState {
  const dl = deadlinesOf(d, b)
  const paid = amountPaid(b.id, d.payments)
  const balance = Math.max(0, b.total - paid)
  const base = { ...dl, now, paid, balance }
  if (b.status === 'Cancelled') return { ...base, balance: 0, stage: 'cancelled' }
  if (b.status === 'Completed') return { ...base, stage: balance > 0 ? 'not-applicable' : 'paid' }
  if (balance === 0) return { ...base, stage: 'paid' }
  const t = isoMs(now)
  // After departure the trip is staff's to settle; nothing is cancelled automatically.
  if (t >= isoMs(dl.departAt)) return { ...base, stage: 'not-applicable' }
  const pending = qualifyingPayment(d.payments, b, balance, dl.cutoffAt)
  // A rejection after the deadline waits for staff to set a revised cutoff (or cancel by hand).
  const rejected = d.payments
    .filter((p) => p.bookingId === b.id && p.status === 'Rejected' && p.reviewedAt && isoMs(p.reviewedAt) >= isoMs(dl.dueAt) && isoMs(p.submittedAt) < isoMs(dl.graceEndAt))
    .find((p) => !b.revisedBy || isoMs(p.reviewedAt!) > isoMs(b.revisedBy.at))
  if (pending && t >= isoMs(dl.dueAt)) return { ...base, pending, stage: 'verifying' }
  if (rejected && !pending) return { ...base, rejected, stage: 'needs-resolution' }
  if (t >= isoMs(dl.cutoffAt)) return { ...base, pending, stage: 'cancel' }
  if (t === isoMs(dl.dueAt) || dl.late) return { ...base, pending, stage: 'due' }
  if (t > isoMs(dl.dueAt)) return { ...base, pending, stage: 'overdue' }
  if (t >= isoMs(dl.reminderAt)) return { ...base, pending, stage: 'reminder' }
  return { ...base, pending, stage: 'upcoming' }
}

/** Self-service cancellation requests close exactly 72 hours before departure. Staff can still handle exceptions. */
export function selfCancelOpen(d: Dataset, b: Booking, now = policyNow(d, b.id)) {
  return isoMs(now) < isoMs(deadlinesOf(d, b).selfCancelUntil)
}

// ---------- Processing ----------

const tellCustomer = (d: Dataset, b: Booking, at: string, n: Pick<AppNotification, 'category' | 'title' | 'body'>) =>
  d.notifications.unshift({ id: nextId(d, 'notification'), at, read: false, customerId: b.customerId, ref: b.id, origin: 'local', link: `/app/trips/${b.id}`, ...n })
const tellStaff = (d: Dataset, b: Booking, at: string, n: Pick<AppNotification, 'category' | 'title' | 'body'>) =>
  d.notifications.unshift({ id: nextId(d, 'notification'), at, read: false, about: b.customerId, ref: b.id, origin: 'local', link: `/admin/bookings?id=${b.id}`, ...n })

const title = (d: Dataset, b: Booking) => agreedOf(d, b).title

/**
 * Frees what this booking held: its own van assignment, and the departure's van only when nobody else is still
 * booked on it. Seats free up by themselves once the booking is cancelled.
 */
export function releaseResources(d: Dataset, b: Booking) {
  const live = new Set(assignableTargets(d, b.startDate).map((t) => `${t.kind}:${t.id}`))
  d.assignments = d.assignments.filter((a) => {
    if (a.target.kind === 'booking') return a.target.id !== b.id
    if (a.target.id !== b.departureId) return true
    return live.has(`departure:${a.target.id}`) || d.bookings.some((x) => x.departureId === a.target.id && x.id !== b.id && (x.status === 'Pending' || x.status === 'Confirmed'))
  })
}

/** Opens a refund review for a cancelled booking that has verified payments. No deductions are applied by default. */
export function openRefund(d: Dataset, b: Booking, at: string, reason: string, by: RefundReview['cancelledBy']): RefundReview | undefined {
  const paid = amountPaid(b.id, d.payments)
  if (paid <= 0 || d.refunds.some((r) => r.bookingId === b.id)) return undefined
  const r: RefundReview = { id: nextId(d, 'refund'), bookingId: b.id, customerId: b.customerId, createdAt: at, reason, cancelledBy: by, paid, deductions: [], proposed: paid, status: 'Pending review' }
  d.refunds = [r, ...d.refunds]
  return r
}

const logged = (b: Booking, key: string) => (b.deadlineLog ?? []).includes(key)
const mark = (b: Booking, key: string) => {
  b.deadlineLog = [...(b.deadlineLog ?? []), key]
}

/** Applies the policy to one booking at `now`. Each stage happens once, however often it runs. Returns true on change. */
export function processBooking(d: Dataset, b: Booking, now: string): boolean {
  if (b.status !== 'Pending' && b.status !== 'Confirmed') return false
  const st = paymentState(d, b, now)
  let changed = false
  const once = (key: string, run: () => void) => {
    if (logged(b, key)) return
    run()
    mark(b, key)
    changed = true
  }
  const amount = peso(st.balance)
  switch (st.stage) {
    case 'reminder':
      once('reminder', () => tellCustomer(d, b, now, { category: 'Payments', title: 'Balance due in 24 hours', body: `${b.id} · ${title(d, b)}: pay the ${amount} balance by ${fmtExact(st.dueAt)}.` }))
      break
    case 'due':
      once('due', () => {
        const body = st.late
          ? `${b.id} was booked within 72 hours of departure, so the full ${amount} is due now. Final cutoff ${fmtExact(st.cutoffAt)}.`
          : `${b.id} · ${title(d, b)}: the ${amount} balance is due now (deadline ${fmtExact(st.dueAt)}). If it is still unpaid at ${fmtExact(st.cutoffAt)}, the booking is cancelled.`
        tellCustomer(d, b, now, { category: 'Payments', title: 'Payment due now', body })
      })
      break
    case 'overdue':
      if (!st.late) {
        once('due', () => {})
        once('overdue', () => {
          tellCustomer(d, b, now, { category: 'Payments', title: 'Balance overdue', body: `${b.id}: ${amount} was due ${fmtExact(st.dueAt)}. Pay by ${fmtExact(st.cutoffAt)} (end of the 24-hour grace period) to keep your booking.` })
          tellStaff(d, b, now, { category: 'Payments', title: 'Balance overdue', body: `${b.id}: ${amount} unpaid. Grace period ends ${fmtExact(st.cutoffAt)}.` })
        })
      }
      break
    case 'verifying':
      once(`hold:${st.pending!.id}`, () => {
        tellCustomer(d, b, now, { category: 'Payments', title: 'Payment received in time', body: `${b.id}: your ${peso(st.pending!.amount)} payment arrived before the cutoff. The booking stays active while staff verify it.` })
        tellStaff(d, b, now, { category: 'Payments', title: 'Verify before cancelling', body: `${b.id}: ${peso(st.pending!.amount)} was sent before the cutoff. Automatic cancellation is paused until it is verified or rejected.` })
      })
      break
    case 'needs-resolution':
      once(`resolve:${st.rejected!.id}`, () => {
        tellCustomer(d, b, now, { category: 'Payments', title: 'Payment could not be verified', body: `${b.id}: ${st.rejected!.rejectReason ?? 'Staff could not verify your payment.'} Your booking is not cancelled yet; staff will contact you with the next step.` })
        tellStaff(d, b, now, { category: 'Payments', title: 'Rejected payment needs a decision', body: `${b.id}: set a revised payment deadline or cancel the booking. It will not be cancelled automatically.` })
      })
      break
    case 'cancel':
      once('cancelled', () => {
        for (const k of ['reminder', 'due', 'overdue']) if (!logged(b, k)) mark(b, k)
        b.status = 'Cancelled'
        b.cancelReason = MISSED_REASON
        b.cancelledAt = now
        b.cancelledBy = 'system'
        b.cancellationRequested = false
        releaseResources(d, b)
        const refund = openRefund(d, b, now, MISSED_REASON, 'system')
        tellCustomer(d, b, now, {
          category: 'Bookings', title: 'Booking cancelled: payment deadline missed',
          body: refund
            ? `${b.id} · ${title(d, b)} was cancelled because the balance was not paid by ${fmtExact(st.cutoffAt)}. Your verified payments of ${peso(refund.paid)} are under refund review; staff will contact you with the outcome.`
            : `${b.id} · ${title(d, b)} was cancelled because no payment was received by ${fmtExact(st.cutoffAt)}. Nothing was charged.`,
        })
        tellStaff(d, b, now, { category: 'Bookings', title: 'Auto-cancelled: payment deadline missed', body: `${b.id} · ${b.pax} ${b.pax === 1 ? 'seat' : 'seats'} released.${refund ? ` Refund review ${refund.id} opened for ${peso(refund.paid)}.` : ' No payment was received, so no refund is due.'}` })
        logActivity(d, now, { actor: 'System', module: 'Payments', recordId: b.id, recordLabel: title(d, b), action: 'Auto-cancelled', description: `${MISSED_REASON}. Cutoff ${fmtExact(st.cutoffAt)}.${refund ? ` Refund review ${refund.id} opened.` : ''}` })
      })
      break
  }
  return changed
}

/** Runs the policy on every open booking. Returns true when anything changed. */
export function runDeadlines(d: Dataset): boolean {
  let changed = false
  for (const b of d.bookings) {
    if (b.status !== 'Pending' && b.status !== 'Confirmed') continue
    if (processBooking(d, b, policyNow(d, b.id))) changed = true
  }
  return changed
}

/** The stage key the policy would record next for a booking, or null when there is nothing to do. */
function nextKey(d: Dataset, b: Booking): string | null {
  if (b.status !== 'Pending' && b.status !== 'Confirmed') return null
  const st = paymentState(d, b)
  const key =
    st.stage === 'reminder' ? 'reminder'
    : st.stage === 'due' ? 'due'
    : st.stage === 'overdue' && !st.late ? 'overdue'
    : st.stage === 'verifying' ? `hold:${st.pending!.id}`
    : st.stage === 'needs-resolution' ? `resolve:${st.rejected!.id}`
    : st.stage === 'cancel' ? 'cancelled'
    : null
  return key && !logged(b, key) ? key : null
}

/** True when running the policy would change something. Cheap: it reads the records without copying them. */
export function deadlinesPending(d: Dataset) {
  return d.bookings.some((b) => nextKey(d, b) !== null)
}
