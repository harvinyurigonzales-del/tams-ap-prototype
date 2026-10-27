import { logActivity } from '../domain/activity'
import { deadlinesOf, paymentState, processBooking } from '../domain/paymentPolicy'
import { amountPaid, downPayment } from '../domain/rules'
import { addHours, demoNow, demoNowStamp, isoMs } from '../lib/demoClock'
import { fmtExact, peso } from '../lib/format'
import type { Dataset, Payment, TimelinePreview } from '../seed/types'
import { useAdmin } from './adminStore'
import { nextId } from './ids'

// "Preview payment timeline": moves the clock for one booking only, so the deadline policy can be shown without
// waiting days. It runs the same policy functions as normal processing. Everything the preview changes for that
// booking (status, payments, refund review, van assignment, deadline notices) is copied first and put back by Restore;
// other bookings, packages, drivers and maintenance never see the moved clock.

export type TimelineStep = 'reminder' | 'deadline' | 'past-grace'
export type SampleAction = 'down' | 'full' | 'pending'

const STAGE_NAME: Record<string, string> = {
  'not-applicable': 'trip started', paid: 'fully paid', upcoming: 'not yet due', reminder: 'reminder sent', due: 'payment due', overdue: 'grace period',
  verifying: 'awaiting verification', 'needs-resolution': 'needs staff follow-up', cancel: 'deadline missed', cancelled: 'cancelled',
}

type Res = { ok: true; message: string } | { ok: false; error: string }

function commit(data: Dataset) {
  useAdmin.setState({ data })
}

function startPreview(d: Dataset, bookingId: string): TimelinePreview {
  const existing = d.previews.find((p) => p.bookingId === bookingId)
  if (existing) return existing
  const b = d.bookings.find((x) => x.id === bookingId)!
  const p: TimelinePreview = {
    bookingId,
    at: demoNow(),
    saved: {
      booking: structuredClone(b),
      payments: structuredClone(d.payments.filter((x) => x.bookingId === bookingId)),
      refunds: structuredClone(d.refunds.filter((x) => x.bookingId === bookingId)),
      assignments: structuredClone(d.assignments.filter((a) => (a.target.kind === 'booking' && a.target.id === bookingId) || (b.departureId && a.target.kind === 'departure' && a.target.id === b.departureId))),
      notificationIds: d.notifications.filter((n) => n.ref === bookingId).map((n) => n.id),
    },
  }
  d.previews = [...d.previews, p]
  return p
}

/** Moves one booking's clock to a stage of its payment timeline and applies the policy at that time. */
export function advanceTimeline(bookingId: string, step: TimelineStep): Res {
  const data = structuredClone(useAdmin.getState().data)
  const b = data.bookings.find((x) => x.id === bookingId)
  if (!b) return { ok: false, error: 'Booking not found.' }
  if (b.status !== 'Pending' && b.status !== 'Confirmed' && !data.previews.some((p) => p.bookingId === bookingId)) return { ok: false, error: 'Only an active booking has a payment timeline to preview.' }
  const p = startPreview(data, bookingId)
  const dl = deadlinesOf(data, b)
  const target = step === 'reminder' ? dl.reminderAt : step === 'deadline' ? dl.dueAt : addHours(dl.cutoffAt, 1 / 60)
  // The preview only moves forward, so a repeated or earlier step never replays a stage.
  if (isoMs(target) > isoMs(p.at)) p.at = target
  processBooking(data, b, p.at)
  commit(data)
  const st = paymentState(data, b, p.at)
  return { ok: true, message: `${bookingId} is now at ${fmtExact(p.at)} (${STAGE_NAME[st.stage]}).` }
}

/** Adds a clearly labelled sample payment, so the four outcomes can be shown on any booking. */
export function samplePayment(bookingId: string, kind: SampleAction): Res {
  const data = structuredClone(useAdmin.getState().data)
  const b = data.bookings.find((x) => x.id === bookingId)
  if (!b || (b.status !== 'Pending' && b.status !== 'Confirmed')) return { ok: false, error: 'Sample payments work on active bookings only.' }
  if (data.payments.some((x) => x.bookingId === bookingId && x.status === 'Submitted')) return { ok: false, error: 'A payment is already waiting for verification.' }
  const p = startPreview(data, bookingId)
  const paid = amountPaid(b.id, data.payments)
  const balance = b.total - paid
  if (balance <= 0) return { ok: false, error: 'This booking is already fully paid.' }
  const amount = kind === 'down' ? Math.min(balance, Math.max(1, downPayment(b.total) - paid)) : balance
  if (kind === 'down' && paid >= downPayment(b.total)) return { ok: false, error: 'The down payment is already verified. Try “full” or “awaiting verification”.' }
  // Stamped at the booking's effective time, so a payment sent "in time" is in time for the policy too.
  const at = isoMs(p.at) > isoMs(demoNow()) ? p.at : demoNowStamp()
  const pay: Payment = {
    id: nextId(data, 'payment'), bookingId, amount, method: 'GCash', type: kind === 'down' ? 'Down payment' : paid > 0 ? 'Balance' : 'Full',
    status: kind === 'pending' ? 'Submitted' : 'Verified', reference: `SAMPLE-${Math.floor(isoMs(at) / 60000) % 100000}`, submittedAt: at,
    reviewedAt: kind === 'pending' ? undefined : at, proof: 'sample', scenario: 'timeline-preview', origin: 'local',
  }
  data.payments.push(pay)
  if (kind !== 'pending' && b.status === 'Pending' && paid + amount >= downPayment(b.total)) {
    b.status = 'Confirmed'
    b.confirmedAt = at
  }
  processBooking(data, b, p.at)
  commit(data)
  return { ok: true, message: `Sample ${kind === 'pending' ? 'payment awaiting verification' : 'verified payment'} of ${peso(amount)} added.` }
}

/** Puts the booking's records back as they were before the preview. Unrelated records and history are kept. */
export function restoreTimeline(bookingId: string): Res {
  const data = structuredClone(useAdmin.getState().data)
  const p = data.previews.find((x) => x.bookingId === bookingId)
  if (!p) return { ok: false, error: 'There is no preview to restore for this booking.' }
  const { saved } = p
  data.bookings = data.bookings.map((b) => (b.id === bookingId ? structuredClone(saved.booking) : b))
  data.payments = [...data.payments.filter((x) => x.bookingId !== bookingId), ...structuredClone(saved.payments)]
  data.refunds = [...structuredClone(saved.refunds), ...data.refunds.filter((x) => x.bookingId !== bookingId)]
  const keep = new Set(saved.notificationIds)
  data.notifications = data.notifications.filter((n) => n.ref !== bookingId || keep.has(n.id))
  // Assignments the preview released come back; anything it did not touch stays as it is.
  for (const a of saved.assignments) if (!data.assignments.some((x) => x.id === a.id)) data.assignments.push(structuredClone(a))
  data.previews = data.previews.filter((x) => x.bookingId !== bookingId)
  logActivity(data, demoNowStamp(), { actor: 'Presenter', module: 'Payments', recordId: bookingId, recordLabel: saved.booking.agreed?.title ?? bookingId, action: 'Timeline preview restored', description: 'Booking, payments, refund review, van assignment and deadline notices put back as they were.' })
  commit(data)
  return { ok: true, message: `${bookingId} restored.` }
}
