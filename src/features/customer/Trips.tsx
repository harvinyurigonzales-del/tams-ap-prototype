import { BusFront, CalendarDays, CheckSquare, ChevronRight, ClipboardList, PencilRuler, Phone, Square, Ticket } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { canCancel, money, payableOptions } from '../../domain/rules'
import { daysBetween, DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtRange, fmtStamp, fmtTime, peso } from '../../lib/format'
import { myRecords, useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import type { Booking, Dataset } from '../../seed/types'
import { SampleTag, StatusBadge } from '../../ui/Badge'
import { Button, DisabledHint, LinkButton } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { Picture } from '../../ui/Picture'
import { bookingTitle } from './Book'
import { BackLink } from './Explore'
import { AskAboutButton, RequestStatusBadge } from './Requests'
import { bookingSteps, Stepper } from './Timeline'

type Tab = 'bookings' | 'custom' | 'rental'
const TABS: { key: Tab; label: string }[] = [
  { key: 'bookings', label: 'Bookings' },
  { key: 'custom', label: 'Custom requests' },
  { key: 'rental', label: 'Van rental requests' },
]
type Group = 'Upcoming' | 'Past' | 'Cancelled'
const groupOf = (b: Booking): Group => (b.status === 'Cancelled' ? 'Cancelled' : b.status === 'Completed' || b.endDate < DEMO_TODAY ? 'Past' : 'Upcoming')

/** Image for a booking: the tour's destination, the custom trip's destination, or the van category. */
function bookingImage(d: Dataset, b: Booking) {
  const s = d.services.find((x) => x.id === b.serviceId)
  if (s?.destinationId) return d.destinations.find((x) => x.id === s.destinationId)?.image
  const cr = d.customRequests.find((r) => r.id === b.requestId)
  if (cr) return d.destinations.find((x) => x.id === cr.destinationId)?.image
  const vr = d.rentalRequests.find((r) => r.id === b.requestId)
  return d.vehicleCategories.find((c) => c.id === (vr?.categoryId ?? 'CAT-STD'))?.image
}

export function Trips() {
  const { data, customerId } = useCustomer()
  const [params, setParams] = useSearchParams()
  const tab = (TABS.some((t) => t.key === params.get('tab')) ? params.get('tab') : 'bookings') as Tab
  const mine = myRecords(data, customerId)
  const counts: Record<Tab, number> = { bookings: mine.bookings.length, custom: mine.customRequests.length, rental: mine.rentalRequests.length }

  return (
    <div>
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">My Trips</h1>
      <div role="tablist" aria-label="Trip records" className="mt-4 flex max-w-full gap-1 overflow-x-auto rounded-xl bg-surface-muted p-1 sm:inline-flex">
        {TABS.map((t) => (
          <button
            key={t.key}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setParams(t.key === 'bookings' ? {} : { tab: t.key }, { replace: true })}
            className={`h-9 shrink-0 rounded-lg px-3.5 text-sm font-semibold whitespace-nowrap ${tab === t.key ? 'bg-surface text-brand-700 shadow-card' : 'text-ink-2'}`}
          >
            {t.label} <span className="text-ink-3 tnum">{counts[t.key]}</span>
          </button>
        ))}
      </div>
      <div className="mt-5" role="tabpanel">
        {tab === 'bookings' && <BookingList bookings={mine.bookings} />}
        {tab === 'custom' && (
          <RequestList
            empty={<EmptyState icon={<PencilRuler className="size-6" aria-hidden />} title="No custom trip requests" body="Tell us where you want to go and staff will send a proposal." action={<LinkButton to="/app/custom/new">Plan a custom trip</LinkButton>} />}
            rows={mine.customRequests
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((r) => {
                const dest = data.destinations.find((x) => x.id === r.destinationId)!
                return {
                  id: r.id, to: `/app/custom/${r.id}`, image: dest.image, title: `${dest.name} custom trip`, sub: `${fmtRange(r.startDate, r.endDate)} · ${r.groupSize} people`,
                  badge: <RequestStatusBadge status={r.status} kind="custom" />, linked: r.bookingId,
                  next: r.status === 'Proposal ready' ? 'Review your proposal' : undefined,
                }
              })}
          />
        )}
        {tab === 'rental' && (
          <RequestList
            empty={<EmptyState icon={<BusFront className="size-6" aria-hidden />} title="No van rental requests" body="Request a van with driver and get an estimate right away." action={<LinkButton to="/app/rental">Van rental</LinkButton>} />}
            rows={mine.rentalRequests
              .slice()
              .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
              .map((r) => {
                const cat = data.vehicleCategories.find((c) => c.id === r.categoryId)!
                return {
                  id: r.id, to: `/app/rentals/${r.id}`, image: cat.image, title: `${cat.name} to ${r.dropoff}`, sub: `${fmtRange(r.startDate, r.endDate)} · ${r.passengers} passengers`,
                  badge: <RequestStatusBadge status={r.status} kind="rental" />, linked: r.bookingId,
                  next: r.status === 'Proposal ready' ? 'Review your quote' : undefined,
                }
              })}
          />
        )}
      </div>
    </div>
  )
}

function BookingList({ bookings }: { bookings: Booking[] }) {
  const data = useCustomer((s) => s.data)
  if (!bookings.length)
    return (
      <Card>
        <EmptyState icon={<Ticket className="size-6" aria-hidden />} title="No bookings yet" body="Find a tour and book your seats." action={<LinkButton to="/app/tours">Explore tours</LinkButton>} />
      </Card>
    )
  return (
    <div className="space-y-6">
      {(['Upcoming', 'Past', 'Cancelled'] as Group[]).map((g) => {
        const rows = bookings.filter((b) => groupOf(b) === g).sort((a, b) => (g === 'Upcoming' ? a.startDate.localeCompare(b.startDate) : b.startDate.localeCompare(a.startDate)))
        if (!rows.length) return null
        return (
          <section key={g} aria-labelledby={`grp-${g}`}>
            <h2 id={`grp-${g}`} className="mb-2 text-sm font-semibold text-ink-2">
              {g} <span className="text-ink-3 tnum">{rows.length}</span>
            </h2>
            <ul className="space-y-3">
              {rows.map((b) => {
                const s = data.services.find((x) => x.id === b.serviceId)!
                const m = money(b, data.payments)
                const img = bookingImage(data, b)
                const pay = payableOptions(b, data.payments).length > 0 && b.status === 'Pending'
                return (
                  <li key={b.id}>
                    <Link to={`/app/trips/${b.id}`} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 shadow-card hover:border-brand-300">
                      {img ? <Picture image={img} label={false} className="size-20 shrink-0 rounded-xl" /> : <span className="size-20 shrink-0 rounded-xl bg-brand-100" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display font-semibold text-ink">{bookingTitle(b, s)}</p>
                        <p className="text-sm text-ink-2">
                          {b.id} · {fmtRange(b.startDate, b.endDate)} · {b.pax} pax
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          <StatusBadge status={b.status} />
                          <StatusBadge status={m.summary} />
                          {m.submitted.length > 0 && <StatusBadge status="Submitted" customer />}
                          {b.cancellationRequested && b.status !== 'Cancelled' && <StatusBadge status="Cancellation requested" />}
                        </div>
                        {pay && m.submitted.length === 0 && <p className="mt-1 text-xs font-semibold text-warn">Next: pay the down payment</p>}
                        {b.requestId && <p className="mt-1 text-xs text-ink-2">From request {b.requestId}</p>}
                      </div>
                      <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
                    </Link>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}

interface ReqRow {
  id: string
  to: string
  image: Parameters<typeof Picture>[0]['image']
  title: string
  sub: string
  badge: ReactNode
  linked?: string
  next?: string
}

function RequestList({ rows, empty }: { rows: ReqRow[]; empty: ReactNode }) {
  if (!rows.length) return <Card>{empty}</Card>
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id}>
          <Link to={r.to} className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3 shadow-card hover:border-brand-300">
            <Picture image={r.image} label={false} className="size-20 shrink-0 rounded-xl" />
            <div className="min-w-0 flex-1">
              <p className="truncate font-display font-semibold text-ink">{r.title}</p>
              <p className="text-sm text-ink-2">
                {r.id} · {r.sub}
              </p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                {r.badge}
                {r.linked && <span className="text-xs text-ink-2">Booking {r.linked}</span>}
              </div>
              {r.next && <p className="mt-1 text-xs font-semibold text-warn">Next: {r.next}</p>}
            </div>
            <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function TripDetails() {
  const { bookingId } = useParams()
  const { data, customerId, requestCancellation } = useCustomer()
  const toast = useUi((s) => s.toast)
  const [cancel, setCancel] = useState(false)
  const b = data.bookings.find((x) => x.id === bookingId && x.customerId === customerId)
  if (!b) return <EmptyState title="Booking not found" action={<LinkButton to="/app/trips">My Trips</LinkButton>} />
  const s = data.services.find((x) => x.id === b.serviceId)!
  const m = money(b, data.payments)
  const payments = data.payments.filter((p) => p.bookingId === b.id)
  const canPay = payableOptions(b, data.payments).length > 0
  const cancelCheck = canCancel(b)
  const reqLink = b.requestId?.startsWith('CR-') ? `/app/custom/${b.requestId}` : b.requestId ? `/app/rentals/${b.requestId}` : undefined
  const pickup = b.rental ? `${b.rental.pickup}${s.type === 'van' ? `, ${fmtTime(data.rentalRequests.find((r) => r.id === b.requestId)?.startTime || s.pickupTime)}` : ''}` : `${s.pickup}, ${fmtTime(s.pickupTime)}`
  const showPreTravel = b.status === 'Confirmed' && b.startDate >= DEMO_TODAY

  return (
    <div>
      <BackLink to="/app/trips" label="My Trips" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <p className="text-sm text-ink-2">{b.id}</p>
            <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">{bookingTitle(b, s)}</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <StatusBadge status={b.status} />
              <StatusBadge status={m.summary} />
            </div>
            {b.status !== 'Cancelled' && (
              <div className="mt-5 border-t border-line pt-5">
                <h2 className="sr-only">Status</h2>
                <Stepper steps={bookingSteps(data, b)} />
              </div>
            )}
            <div className="mt-4 space-y-1 text-sm text-ink-2">
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden /> {fmtRange(b.startDate, b.endDate)}
              </p>
              <p>Pickup: {pickup}</p>
              <p>
                {b.pax} {b.rental && s.type === 'van' ? 'passengers' : b.pax === 1 ? 'traveller' : 'travellers'} · Contact {b.contactName}, {b.contactMobile}
              </p>
              {b.notes && <p>Notes: {b.notes}</p>}
              {reqLink && (
                <p>
                  From request{' '}
                  <Link to={reqLink} className="font-semibold text-brand-700 hover:underline">
                    {b.requestId}
                  </Link>
                </p>
              )}
            </div>
            {b.status === 'Cancelled' && (
              <p className="mt-4 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">Cancelled{b.cancelReason ? `: ${b.cancelReason}` : ''}. Refunds are handled outside the prototype.</p>
            )}
            {b.cancellationRequested && b.status !== 'Cancelled' && (
              <p className="mt-4 rounded-xl bg-warn-bg px-4 py-3 text-sm text-warn">Cancellation requested. The agency will contact you about it.</p>
            )}
          </Card>

          {showPreTravel && <PreTravel booking={b} />}

          <Card className="p-5">
            <h2 className="type-head text-[22px] text-charcoal">Payments</h2>
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
                  {(b.cancellationRequested || !cancelCheck.ok) && <DisabledHint>{b.cancellationRequested ? 'Your request has been sent.' : cancelCheck.reason}</DisabledHint>}
                </>
              )}
              <AskAboutButton kind="booking" id={b.id} />
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

/** Sample trip-desk contact. Fictional; the prototype never calls or messages anyone. */
export const TRIP_DESK = { name: 'TAMS AP trip desk', mobile: '0900 555 0300', email: 'trips@tamsap.example.com' }

function PreTravel({ booking: b }: { booking: Booking }) {
  const { data, checklist, toggleChecklist } = useCustomer()
  const s = data.services.find((x) => x.id === b.serviceId)!
  const m = money(b, data.payments)
  const asg = data.assignments.find((a) => (b.departureId ? a.target.kind === 'departure' && a.target.id === b.departureId : a.target.kind === 'booking' && a.target.id === b.id))
  const van = asg && data.vehicles.find((v) => v.id === asg.vehicleId)
  const driver = asg && data.drivers.find((x) => x.id === asg.driverId)
  const destId = s.destinationId ?? data.customRequests.find((r) => r.id === b.requestId)?.destinationId
  const dest = data.destinations.find((x) => x.id === destId)
  const days = daysBetween(DEMO_TODAY, b.startDate)
  const pickupTime = b.departureId ? fmtTime(s.pickupTime) : data.rentalRequests.find((r) => r.id === b.requestId)?.startTime ? fmtTime(data.rentalRequests.find((r) => r.id === b.requestId)!.startTime) : 'as agreed with staff'
  const items = [
    { id: 'id', label: 'Bring a valid ID and your booking reference' },
    { id: 'pickup', label: `Be at the pickup point 15 minutes before ${pickupTime}` },
    ...(m.balance > 0 ? [{ id: 'balance', label: `Pay the ${peso(m.balance)} balance by ${fmtDate(m.dueDate, { year: false })}` }] : []),
    { id: 'cash', label: 'Bring cash for meals and fees not included' },
    ...(dest?.interests.includes('Cool weather') ? [{ id: 'jacket', label: `Pack a jacket: ${dest.name} gets cold` }] : []),
    ...(dest?.interests.includes('Beach') ? [{ id: 'swim', label: 'Pack swimwear, sunscreen and a change of clothes' }] : []),
    { id: 'contact', label: 'Save the trip desk number' },
  ]
  const done = checklist[b.id] ?? []
  const count = items.filter((i) => done.includes(i.id)).length

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 type-head text-[22px] text-charcoal">
          <ClipboardList className="size-5 text-brand-600" aria-hidden /> Before you travel
        </h2>
        <p className="text-sm font-medium text-ink-2">{days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}</p>
      </div>
      <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink-2">Pickup</dt>
          <dd className="font-medium text-ink">
            {b.rental ? b.rental.pickup : s.pickup}, {pickupTime}
          </dd>
        </div>
        <div>
          <dt className="text-ink-2">Balance</dt>
          <dd className="font-medium text-ink">{m.balance > 0 ? `${peso(m.balance)} due ${fmtDate(m.dueDate, { year: false })}` : 'Fully paid'}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Van and driver</dt>
          <dd className="font-medium text-ink">{van && driver ? `${van.name} (${van.model}, ${van.plate}) with ${driver.name}` : 'Staff will assign them before the trip'}</dd>
        </div>
        <div>
          <dt className="text-ink-2">Trip desk</dt>
          <dd className="font-medium text-ink">
            <Phone className="mr-1 inline size-3.5" aria-hidden />
            {TRIP_DESK.mobile} <SampleTag>Sample</SampleTag>
          </dd>
        </div>
      </dl>
      <h3 className="mt-5 text-sm font-semibold text-ink">
        Checklist{' '}
        <span className="font-normal text-ink-2">
          {count} of {items.length} done
        </span>
      </h3>
      <ul className="mt-2 space-y-1">
        {items.map((i) => {
          const on = done.includes(i.id)
          return (
            <li key={i.id}>
              <button role="checkbox" aria-checked={on} onClick={() => toggleChecklist(b.id, i.id)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm hover:bg-surface-muted">
                {on ? <CheckSquare className="mt-px size-5 shrink-0 text-brand-600" aria-hidden /> : <Square className="mt-px size-5 shrink-0 text-ink-3" aria-hidden />}
                <span className={on ? 'text-ink-2 line-through' : 'text-ink'}>{i.label}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <p className="mt-2 text-xs text-ink-3">Ticks last only for this demo session.</p>
    </Card>
  )
}
