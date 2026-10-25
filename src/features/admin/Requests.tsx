import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { requestDestination, requestStatusLabel } from '../../domain/requests'
import { fmtDate, fmtRange, fmtStamp, fmtTime, peso } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import type { CustomRequest, Dataset, PriceLine, RentalRequest } from '../../seed/types'
import { StatusBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { TextArea } from '../../ui/Field'
import { PageHeader } from './AdminRoutes'
import { customerOf, Tabs } from './common'

type Kind = 'custom' | 'rental'

const titleOf = (d: Dataset, kind: Kind, r: CustomRequest | RentalRequest) =>
  kind === 'custom'
    ? `${requestDestination(d, r as CustomRequest).name} custom trip`
    : `${d.vehicleCategories.find((c) => c.id === (r as RentalRequest).categoryId)?.name} to ${(r as RentalRequest).dropoff}`

export function AdminRequests() {
  const { data } = useAdmin()
  const [params, setParams] = useSearchParams()
  const selId = params.get('id') ?? ''
  const kind: Kind = selId.startsWith('VR-') || params.get('tab') === 'rental' ? 'rental' : 'custom'
  const list: (CustomRequest | RentalRequest)[] = (kind === 'custom' ? data.customRequests : data.rentalRequests).slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const sel = list.find((r) => r.id === selId) ?? list[0]
  const open = (k: Kind, id?: string) => setParams(id ? { id } : { tab: k }, { replace: true })
  const openCount = (xs: (CustomRequest | RentalRequest)[]) => xs.filter((r) => r.status === 'Submitted' || r.status === 'Under review').length

  return (
    <div>
      <PageHeader title="Requests" subtitle="Custom-trip and van-rental requests. They are not bookings and never count as revenue until accepted." />
      <Tabs<Kind>
        value={kind}
        onChange={(k) => open(k)}
        items={[
          { key: 'custom', label: 'Custom trips', count: openCount(data.customRequests) },
          { key: 'rental', label: 'Van rental', count: openCount(data.rentalRequests) },
        ]}
      />
      <div className="mt-4 grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit">
          {list.length === 0 ? (
            <EmptyState icon={<Inbox className="size-6" aria-hidden />} title="No requests" />
          ) : (
            <ul className="divide-y divide-line">
              {list.map((r) => (
                <li key={r.id}>
                  <button onClick={() => open(kind, r.id)} aria-current={sel?.id === r.id || undefined} className={`w-full px-4 py-3 text-left ${sel?.id === r.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}`}>
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{customerOf(data, r.customerId)?.name}</span>
                      <StatusBadge status={requestStatusLabel(r.status, kind)} />
                    </span>
                    <span className="block text-sm text-ink-2">{titleOf(data, kind, r)}</span>
                    <span className="block text-xs text-ink-3">
                      {r.id} · {fmtRange(r.startDate, r.endDate)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
        {sel && <RequestDetail key={sel.id} kind={kind} r={sel} />}
      </div>
    </div>
  )
}

function Lines({ lines, total }: { lines: PriceLine[]; total: number }) {
  return (
    <div>
      {lines.map((l) => (
        <Row key={l.label} label={`${l.label} · ${peso(l.unitPrice)} × ${l.qty} ${l.unit}`}>
          {peso(l.amount)}
        </Row>
      ))}
      <Row label="Total" strong>
        {peso(total)}
      </Row>
    </div>
  )
}

function RequestDetail({ kind, r }: { kind: Kind; r: CustomRequest | RentalRequest }) {
  const { data, startReview, sendProposal, closeRequest } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [send, setSend] = useState(false)
  const [close, setClose] = useState(false)
  const [reason, setReason] = useState('')
  const c = customerOf(data, r.customerId)
  const custom = kind === 'custom' ? (r as CustomRequest) : undefined
  const rental = kind === 'rental' ? (r as RentalRequest) : undefined
  const prepared = custom ? custom.proposal ?? custom.draftProposal : rental?.quote
  const preview = custom ? custom.draftProposal : rental?.estimate
  const booking = r.bookingId ? data.bookings.find((b) => b.id === r.bookingId) : undefined
  const doc = kind === 'custom' ? 'proposal' : 'quote'

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm text-ink-2">{r.id}</p>
          <h2 className="font-display text-xl font-semibold text-ink">{titleOf(data, kind, r)}</h2>
          <p className="text-sm text-ink-2">
            <Link to={`/admin/customers?id=${r.customerId}`} className="font-semibold text-brand-700 hover:underline">
              {c?.name}
            </Link>{' '}
            · {r.contactMobile} · sent {fmtStamp(r.createdAt)}
          </p>
        </div>
        <StatusBadge status={requestStatusLabel(r.status, kind)} />
      </div>

      <div className="mt-4 grid gap-1 text-sm text-ink-2">
        <p>Dates: {fmtRange(r.startDate, r.endDate)}{custom && ` · ${custom.flexibility}`}</p>
        {custom && (
          <>
            <p>
              Group of {custom.groupSize} · pickup {custom.pickup} · budget {peso(custom.budgetMin)}–{peso(custom.budgetMax)} per person
            </p>
            {custom.interests.length > 0 && <p>Interests: {custom.interests.join(', ')}</p>}
            {!custom.destinationId && <p className="font-medium text-warn">Place not in the catalog: check that we can serve it before quoting.</p>}
            {custom.stops && custom.stops.length > 0 && (
              <p>
                {custom.planMode === 'scratch' ? 'Planned from scratch' : 'From the suggested trip'}, {(custom.pace ?? 'Balanced').toLowerCase()} pace: {custom.stops.join(' → ')}
              </p>
            )}
          </>
        )}
        {rental && (
          <>
            <p>
              {rental.tripType} · pickup {fmtTime(rental.startTime)} at {rental.pickup} ({rental.pickupArea}) → {rental.dropoff} ({rental.destinationArea})
            </p>
            {rental.stops.length > 0 && <p>Stops: {rental.stops.join('; ')}</p>}
            <p>{rental.passengers} passengers</p>
          </>
        )}
        {(custom?.requests || rental?.requests) && <p>Requests: {custom?.requests || rental?.requests}</p>}
      </div>

      {booking && (
        <p className="mt-4 rounded-xl bg-brand-50 px-4 py-3 text-sm text-brand-800">
          Accepted. Linked booking{' '}
          <Link to={`/admin/bookings?id=${booking.id}`} className="font-semibold underline">
            {booking.id}
          </Link>{' '}
          ({booking.status}, {peso(booking.total)}). Only the booking counts in reports.
        </p>
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">
            {r.status === 'Proposal ready' || r.status === 'Accepted' ? `Sent ${doc}` : kind === 'custom' ? 'Prepared proposal (not sent)' : 'Customer’s estimate'}
          </h3>
          {r.status === 'Proposal ready' || r.status === 'Accepted' ? (
            prepared ? (
              <>
                <Lines lines={prepared.lines} total={prepared.total} />
                {'validUntil' in prepared && <p className="text-xs text-ink-2">Valid until {fmtDate(prepared.validUntil, { year: false })}</p>}
              </>
            ) : null
          ) : preview ? (
            <Lines lines={preview.lines} total={preview.total} />
          ) : (
            <p className="text-sm text-ink-2">A proposal is drafted from the sample rates when you send it.</p>
          )}
        </section>
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">History</h3>
          <ol className="space-y-2 text-sm">
            {r.events.map((e, i) => (
              <li key={i}>
                <span className="font-medium text-ink">{requestStatusLabel(e.status, kind)}</span> <span className="text-xs text-ink-3">{fmtStamp(e.at)}</span>
                <p className="text-xs text-ink-2">{e.note}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        {r.status === 'Submitted' && (
          <Button
            onClick={() => {
              const res = startReview(kind, r.id)
              if (res.ok) toast('Moved to review.')
            }}
          >
            Start review
          </Button>
        )}
        {r.status === 'Under review' && <Button onClick={() => setSend(true)}>Send {doc}</Button>}
        {(r.status === 'Submitted' || r.status === 'Under review' || r.status === 'Proposal ready') && (
          <Button variant="secondary" onClick={() => setClose(true)}>
            Close request
          </Button>
        )}
        {r.status === 'Proposal ready' && <p className="self-center text-sm text-ink-2">Waiting for the customer to accept or ask for changes.</p>}
      </div>
      <p className="mt-3 text-xs text-ink-3">The admin and customer demos keep separate data, so changes here do not appear in the customer demo.</p>

      <ConfirmDialog
        open={send}
        onClose={() => setSend(false)}
        title={`Send ${doc}?`}
        body={`The customer sees the ${doc} in My Trips and can accept it or ask for changes. It is valid for 7 days. Nothing is emailed.`}
        confirmLabel={`Send ${doc}`}
        onConfirm={() => {
          const res = sendProposal(kind, r.id)
          if (!res.ok) return res.error
          toast(`${doc === 'quote' ? 'Quote' : 'Proposal'} sent in the demo.`)
        }}
      />
      <ConfirmDialog
        open={close}
        onClose={() => setClose(false)}
        title="Close this request?"
        body="The customer sees the request as closed with your reason."
        confirmLabel="Close request"
        tone="danger"
        onConfirm={() => {
          const res = closeRequest(kind, r.id, reason)
          if (!res.ok) return res.error
          setReason('')
          toast('Request closed.')
        }}
      >
        <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. No hotel rooms available on these dates" />
      </ConfirmDialog>
    </Card>
  )
}
