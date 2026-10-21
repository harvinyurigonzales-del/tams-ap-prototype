import { CalendarDays, Check, ChevronRight, Circle, Ticket } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { canCancel, money, payableOptions } from '../../domain/rules'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtRange, fmtStamp, fmtTime, peso } from '../../lib/format'
import { useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import type { Booking } from '../../seed/types'
import { SampleTag, StatusBadge } from '../../ui/Badge'
import { Button, DisabledHint, LinkButton } from '../../ui/Button'
import { Card, PhotoPlaceholder, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { bookingTitle } from './Book'
import { BackLink } from './Explore'

type Tab = 'Upcoming' | 'Past' | 'Cancelled'
const tabOf = (b: Booking): Tab => (b.status === 'Cancelled' ? 'Cancelled' : b.status === 'Completed' || b.endDate < DEMO_TODAY ? 'Past' : 'Upcoming')

export function Trips() {
  const { data, customerId } = useCustomer()
  const mine = data.bookings.filter((b) => b.customerId === customerId)
  const [tab, setTab] = useState<Tab>(() => (mine.some((b) => tabOf(b) === 'Upcoming') ? 'Upcoming' : mine.length ? 'Past' : 'Upcoming'))
  const rows = mine.filter((b) => tabOf(b) === tab).sort((a, b) => (tab === 'Upcoming' ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)))
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-900">My trips</h1>
      <div role="tablist" className="mt-4 inline-flex rounded-xl bg-surface-muted p-1">
        {(['Upcoming', 'Past', 'Cancelled'] as Tab[]).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            onClick={() => setTab(t)}
            className={`h-9 rounded-lg px-4 text-sm font-semibold ${tab === t ? 'bg-surface text-brand-700 shadow-card' : 'text-ink-2'}`}
          >
            {t} <span className="text-ink-3 tnum">{mine.filter((b) => tabOf(b) === t).length}</span>
          </button>
        ))}
      </div>
      <div className="mt-5 space-y-3">
        {rows.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Ticket className="size-6" aria-hidden />}
              title={tab === 'Upcoming' ? 'No upcoming trips' : tab === 'Past' ? 'No past trips yet' : 'No cancelled trips'}
              body={tab === 'Upcoming' ? 'Find a trip on Explore and book your seats.' : undefined}
              action={tab === 'Upcoming' ? <LinkButton to="/app">Explore trips</LinkButton> : undefined}
            />
          </Card>
        ) : (
          rows.map((b) => {
            const s = data.services.find((x) => x.id === b.serviceId)!
            const m = money(b, data.payments)
            return (
              <Link key={b.id} to={`/app/trips/${b.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 shadow-card hover:border-brand-300">
                <PhotoPlaceholder tint={s.tint} label="" className="size-20 shrink-0 rounded-xl [&>span]:hidden" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display font-semibold text-ink">{bookingTitle(b, s)}</p>
                  <p className="text-sm text-ink-2">
                    {fmtRange(b.startDate, b.endDate)} · {b.pax} pax
                  </p>
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    <StatusBadge status={b.status} />
                    <StatusBadge status={m.summary} />
                    {m.submitted.length > 0 && <StatusBadge status="Submitted" customer />}
                    {b.cancellationRequested && b.status !== 'Cancelled' && <StatusBadge status="Cancellation requested" />}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}

export function TripDetails() {
  const { bookingId } = useParams()
  const { data, customerId, requestCancellation } = useCustomer()
  const toast = useUi((s) => s.toast)
  const [cancel, setCancel] = useState(false)
  const b = data.bookings.find((x) => x.id === bookingId && x.customerId === customerId)
  if (!b) return <EmptyState title="Booking not found" action={<LinkButton to="/app/trips">My trips</LinkButton>} />
  const s = data.services.find((x) => x.id === b.serviceId)!
  const m = money(b, data.payments)
  const payments = data.payments.filter((p) => p.bookingId === b.id)
  const canPay = payableOptions(b, data.payments).length > 0
  const cancelCheck = canCancel(b)

  const steps = [
    { label: 'Booking submitted', at: b.createdAt, done: true },
    { label: 'Payment submitted', at: payments[0]?.submittedAt, done: payments.length > 0 },
    { label: 'Payment verified', at: payments.find((p) => p.status === 'Verified')?.reviewedAt, done: m.paid > 0 },
    { label: 'Booking confirmed', at: b.confirmedAt, done: b.status === 'Confirmed' || b.status === 'Completed' },
    { label: 'Trip completed', at: undefined, done: b.status === 'Completed' },
  ]

  return (
    <div>
      <BackLink to="/app/trips" label="My trips" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-sm text-ink-2">{b.id}</p>
            <h1 className="font-display text-2xl font-bold text-brand-900">{bookingTitle(b, s)}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={b.status} />
              <StatusBadge status={m.summary} />
            </div>
            <div className="mt-4 space-y-1 text-sm text-ink-2">
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden /> {fmtRange(b.startDate, b.endDate)}
              </p>
              <p>
                {b.rental ? `Pickup: ${b.rental.pickup}, ${fmtTime(s.pickupTime)}` : `Pickup ${fmtTime(s.pickupTime)} at ${s.pickup}`}
              </p>
              <p>
                {b.pax} {b.rental ? 'passengers' : b.pax === 1 ? 'traveller' : 'travellers'} · Contact {b.contactName}, {b.contactMobile}
              </p>
              {b.notes && <p>Notes: {b.notes}</p>}
            </div>
            {b.status === 'Cancelled' && (
              <p className="mt-4 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
                Cancelled{b.cancelReason ? `: ${b.cancelReason}` : ''}. Refunds are handled outside the prototype.
              </p>
            )}
            {b.cancellationRequested && b.status !== 'Cancelled' && (
              <p className="mt-4 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">Cancellation requested. The agency will contact you about it.</p>
            )}
          </Card>

          {b.status !== 'Cancelled' && (
            <Card className="p-5">
              <h2 className="font-display text-lg font-semibold text-brand-900">Status</h2>
              <ol className="mt-3">
                {steps.map((st, i) => (
                  <li key={st.label} className="relative flex gap-3 pb-4 last:pb-0">
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
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          )}

          <Card className="p-5">
            <h2 className="font-display text-lg font-semibold text-brand-900">Payments</h2>
            {payments.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">No payments yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {payments.map((p) => (
                  <li key={p.id} className="py-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium text-ink">
                          {p.type} · {peso(p.amount)}
                        </p>
                        <p className="text-xs text-ink-2">
                          {p.method} · Ref {p.reference} · {fmtStamp(p.submittedAt)}
                        </p>
                      </div>
                      <StatusBadge status={p.status} customer />
                    </div>
                    {p.status === 'Rejected' && <p className="mt-2 rounded-lg bg-bad-bg px-3 py-2 text-xs text-bad">Reason: {p.rejectReason}</p>}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <Row label="Total">{peso(b.total)}</Row>
            <Row label="Paid (verified)">{peso(m.paid)}</Row>
            <Row label="Balance" strong>
              {peso(m.balance)}
            </Row>
            {m.balance > 0 && b.status !== 'Cancelled' && (
              <p className="mt-2 text-xs text-ink-2">
                Down payment {peso(m.down)} · balance due {fmtDate(m.dueDate, { weekday: true, year: false })}
                <SampleTag />
              </p>
            )}
            {m.submitted.length > 0 && <p className="mt-3 rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">A payment of {peso(m.submitted[0].amount)} is awaiting verification.</p>}
            <div className="mt-4 grid gap-2">
              {canPay && (
                <LinkButton to={`/app/trips/${b.id}/pay`} size="lg" full>
                  {m.lastRejected && m.paid === 0 ? 'Submit new proof' : m.paid > 0 ? 'Pay balance' : 'Pay now'}
                </LinkButton>
              )}
              {(b.status === 'Pending' || b.status === 'Confirmed') && (
                <>
                  <Button variant="secondary" size="lg" full disabled={!cancelCheck.ok || b.cancellationRequested} onClick={() => setCancel(true)}>
                    Request cancellation
                  </Button>
                  {(b.cancellationRequested || !cancelCheck.ok) && (
                    <DisabledHint>{b.cancellationRequested ? 'Your request has been sent.' : cancelCheck.reason}</DisabledHint>
                  )}
                </>
              )}
            </div>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={cancel}
        onClose={() => setCancel(false)}
        title="Request cancellation?"
        body="This sends a request to the agency. Your booking stays as it is until staff review it. Refunds are handled outside the prototype."
        confirmLabel="Send request"
        tone="danger"
        onConfirm={() => {
          const r = requestCancellation(b.id)
          if (!r.ok) return r.error
          toast('Cancellation request sent.')
        }}
      />
    </div>
  )
}
