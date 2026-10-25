import { Inbox } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { changeRequestText, draftCustomProposal, PROPOSAL_VALID_DAYS, proposalTrack, requestDestination, requestStatusLabel } from '../../domain/requests'
import { daysBetween, DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtRange, fmtStamp, fmtTime, peso } from '../../lib/format'
import { needsDates, useAdmin } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import type { CustomRequest, Dataset, PriceLine, Proposal, RentalRequest } from '../../seed/types'
import { Badge, StatusBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { Select, TextArea, TextField } from '../../ui/Field'
import { PageHeader } from './AdminRoutes'
import { customerOf, FormDialog, linesOf, Tabs } from './common'
import { plannedDates, PlannedTripView } from '../customer/planner/PlannedTripView'
import { Plus, Trash2 } from 'lucide-react'

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
  const list: (CustomRequest | RentalRequest)[] = (kind === 'custom' ? data.customRequests : data.rentalRequests)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
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
          {
            key: 'custom',
            label: 'Custom trips',
            count: openCount(data.customRequests),
          },
          {
            key: 'rental',
            label: 'Van rental',
            count: openCount(data.rentalRequests),
          },
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
                  <button
                    onClick={() => open(kind, r.id)}
                    aria-current={sel?.id === r.id || undefined}
                    className={`w-full px-4 py-3 text-left ${sel?.id === r.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}`}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="text-sm font-semibold text-ink">{customerOf(data, r.customerId)?.name}</span>
                      <StatusBadge status={requestStatusLabel(r.status, kind)} />
                    </span>
                    <span className="block text-sm text-ink-2">
                      {titleOf(data, kind, r)}
                      {(r as CustomRequest).plan && <span className="ml-1.5 text-xs font-semibold text-brand-700">· Trip Planner</span>}
                    </span>
                    {(() => {
                      const t = proposalTrack(r)
                      return t === 'Changes requested' || t === 'Expired' ? <span className="mt-0.5 block text-xs font-semibold text-warn">{t}</span> : null
                    })()}
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
  const { data, startReview, sendProposal, closeRequest, reviseProposal } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [send, setSend] = useState(false)
  const [editing, setEditing] = useState(false)
  const [close, setClose] = useState(false)
  const [reason, setReason] = useState('')
  const c = customerOf(data, r.customerId)
  const custom = kind === 'custom' ? (r as CustomRequest) : undefined
  const rental = kind === 'rental' ? (r as RentalRequest) : undefined
  const prepared = custom ? (custom.proposal ?? custom.draftProposal) : rental?.quote
  const preview = custom ? custom.draftProposal : rental?.estimate
  const booking = r.bookingId ? data.bookings.find((b) => b.id === r.bookingId) : undefined
  const doc = kind === 'custom' ? 'proposal' : 'quote'
  const track = proposalTrack(r)
  const sentDoc = custom ? custom.proposal : rental?.quote
  const datesMissing = !!custom && needsDates(custom) && !custom.draftProposal?.datesSet

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
        <p>Dates: {(custom && plannedDates(custom.plan)) ?? `${fmtRange(r.startDate, r.endDate)}${custom ? ` · ${custom.flexibility}` : ''}`}</p>
        {custom && (
          <>
            <p>
              Group of {custom.groupSize} · pickup {custom.pickup} · budget {peso(custom.budgetMin)}–{peso(custom.budgetMax)} per person
            </p>
            {custom.interests.length > 0 && <p>Interests: {custom.interests.join(', ')}</p>}
            {!custom.destinationId && <p className="font-medium text-warn">Place not in the catalog: check that we can serve it before quoting.</p>}
            {!custom.plan && custom.stops && custom.stops.length > 0 && (
              <p>
                {custom.planMode === 'scratch' ? 'Planned from scratch' : 'From the suggested trip'}, {(custom.pace ?? 'Balanced').toLowerCase()} pace:{' '}
                {custom.stops.join(' → ')}
              </p>
            )}
            {custom.plan && (
              <details className="mt-2 rounded-xl border border-line p-3" open>
                <summary className="cursor-pointer font-semibold text-ink">Customer’s plan from the trip planner</summary>
                <div className="mt-3">
                  <PlannedTripView plan={custom.plan} staff />
                </div>
              </details>
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

      {track && track !== 'Draft' && sentDoc && (
        <Tracking
          track={track}
          r={r}
          sentAt={sentDoc.sentAt}
          validUntil={sentDoc.validUntil}
          doc={doc}
          onRevise={
            custom && (track === 'Sent' || track === 'Expired' || (track === 'Changes requested' && !custom.draftProposal))
              ? () => {
                  const res = reviseProposal(r.id)
                  if (!res.ok) return toast(res.error, 'error')
                  setEditing(true)
                }
              : undefined
          }
        />
      )}

      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <section>
          <h3 className="mb-1 text-sm font-semibold text-ink">
            {r.status === 'Proposal ready' || r.status === 'Accepted'
              ? `Sent ${doc}`
              : kind === 'custom'
                ? custom?.draftProposal
                  ? custom.proposal
                    ? 'Revised proposal (not sent)'
                    : 'Prepared proposal (not sent)'
                  : custom?.proposal
                    ? 'Last sent proposal'
                    : 'Suggested proposal (not sent)'
                : 'Customer’s estimate'}
          </h3>
          {r.status === 'Proposal ready' || r.status === 'Accepted' ? (
            prepared ? (
              <>
                <Lines lines={prepared.lines} total={prepared.total} />
                {'validUntil' in prepared && <p className="text-xs text-ink-2">Valid until {fmtDate(prepared.validUntil, { year: false })}</p>}
              </>
            ) : null
          ) : custom ? (
            <ProposalSummary p={custom.draftProposal ?? custom.proposal ?? draftCustomProposal(custom, requestDestination(data, custom), r.createdAt)} />
          ) : preview ? (
            <Lines lines={preview.lines} total={preview.total} />
          ) : null}
          {custom && r.status === 'Under review' && (custom.draftProposal || !custom.proposal) && (
            <Button variant="secondary" size="sm" className="mt-3" onClick={() => setEditing(true)}>
              Edit proposal
            </Button>
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
        {r.status === 'Under review' && !(custom?.proposal && !custom.draftProposal) && (
          <Button onClick={() => setSend(true)} disabled={datesMissing} aria-describedby={datesMissing ? 'dates-hint' : undefined}>
            {track === 'Changes requested' || track === 'Revising' ? `Send revised ${doc}` : `Send ${doc}`}
          </Button>
        )}
        {(r.status === 'Submitted' || r.status === 'Under review' || r.status === 'Proposal ready') && (
          <Button variant="secondary" onClick={() => setClose(true)}>
            Close request
          </Button>
        )}
        {r.status === 'Proposal ready' && <p className="self-center text-sm text-ink-2">Waiting for the customer to accept or ask for changes.</p>}
        {datesMissing && r.status === 'Under review' && !(custom?.proposal && !custom.draftProposal) && (
          <p id="dates-hint" className="self-center text-sm font-medium text-warn">
            The customer’s dates are not fixed yet. Set the trip dates in the proposal first.
          </p>
        )}
      </div>

      <ConfirmDialog
        open={send}
        onClose={() => setSend(false)}
        title={`Send ${doc}?`}
        body={`The customer sees the ${doc} in My Trips and can accept it or ask for changes. It stays open for ${custom?.draftProposal?.validDays ?? PROPOSAL_VALID_DAYS} days.`}
        confirmLabel={`Send ${doc}`}
        onConfirm={() => {
          const res = sendProposal(kind, r.id)
          if (!res.ok) return res.error
          toast(`${doc === 'quote' ? 'Quote' : 'Proposal'} sent.`)
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
      {custom && editing && <ProposalEditor r={custom} onClose={() => setEditing(false)} />}
    </Card>
  )
}

const TRACK_TONE = {
  Sent: 'brand',
  'Changes requested': 'warn',
  Revising: 'info',
  Accepted: 'ok',
  Expired: 'neutral',
  Draft: 'neutral',
} as const

/** Acceptance tracking: what happened after the proposal or quote went out. */
function Tracking({
  track,
  r,
  sentAt,
  validUntil,
  doc,
  onRevise,
}: {
  track: NonNullable<ReturnType<typeof proposalTrack>>
  r: CustomRequest | RentalRequest
  sentAt: string
  validUntil: string
  doc: string
  onRevise?: () => void
}) {
  const left = daysBetween(DEMO_TODAY, validUntil)
  const ask = changeRequestText(r)
  return (
    <section aria-label="Customer response" className="mt-5 rounded-xl border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">Customer response</h3>
        <Badge tone={TRACK_TONE[track]}>{track}</Badge>
      </div>
      <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <li className="rounded-lg bg-surface-muted px-3 py-2">
          <span className="block text-xs text-ink-3">Sent</span>
          <span className="font-medium text-ink">{fmtStamp(sentAt)}</span>
        </li>
        <li className="rounded-lg bg-surface-muted px-3 py-2">
          <span className="block text-xs text-ink-3">{track === 'Expired' ? 'Expired' : 'Valid until'}</span>
          <span className="font-medium text-ink">
            {fmtDate(validUntil, { year: false })}
            {track === 'Sent' && ` · ${left === 0 ? 'last day' : `${left} ${left === 1 ? 'day' : 'days'} left`}`}
          </span>
        </li>
        <li className="rounded-lg bg-surface-muted px-3 py-2">
          <span className="block text-xs text-ink-3">Reply</span>
          <span className="font-medium text-ink">
            {track === 'Accepted'
              ? 'Accepted'
              : track === 'Changes requested'
                ? 'Asked for changes'
                : track === 'Revising'
                  ? 'Staff revising'
                  : track === 'Expired'
                    ? 'No reply'
                    : 'Waiting'}
          </span>
        </li>
      </ol>
      {track === 'Changes requested' && ask && <p className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">“{ask.replace(/^“|”$/g, '')}”</p>}
      {track === 'Expired' && (
        <p className="mt-3 text-sm text-ink-2">The {doc} expired without a reply. Check prices and availability again, then revise and resend it.</p>
      )}
      {onRevise && (
        <Button size="sm" variant="secondary" className="mt-3" onClick={onRevise}>
          {track === 'Changes requested' ? `Revise ${doc}` : `Revise and resend`}
        </Button>
      )}
    </section>
  )
}

function ProposalSummary({ p }: { p: Proposal }) {
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-2">
        {p.title} · {fmtRange(p.startDate, p.endDate)}
      </p>
      <Lines lines={p.lines} total={p.total} />
      <details className="text-sm text-ink-2">
        <summary className="cursor-pointer font-medium text-ink">Itinerary and inclusions</summary>
        <ul className="mt-2 list-disc space-y-0.5 pl-5">
          {p.itinerary.map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
        <p className="mt-2">Includes: {p.inclusions.join(', ')}</p>
        {p.exclusions.length > 0 && <p>Not included: {p.exclusions.join(', ')}</p>}
      </details>
      {p.note && <p className="rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-2">Note: {p.note}</p>}
    </div>
  )
}

/** Staff edit the proposal before sending: itinerary, price lines, inclusions, validity, a note, and firm dates. */
function ProposalEditor({ r, onClose }: { r: CustomRequest; onClose: () => void }) {
  const { data, saveDraftProposal } = useAdmin()
  const toast = useUi((s) => s.toast)
  const base = r.draftProposal ?? r.proposal ?? draftCustomProposal(r, requestDestination(data, r), r.createdAt)
  const flexible = needsDates(r)
  const [f, setF] = useState(() => ({
    title: base.title,
    startDate: base.startDate,
    endDate: base.endDate,
    itinerary: base.itinerary.join('\n'),
    inclusions: base.inclusions.join('\n'),
    exclusions: base.exclusions.join('\n'),
    note: base.note ?? '',
    validDays: base.validDays ?? PROPOSAL_VALID_DAYS,
    lines: base.lines.map((l) => ({ ...l })),
  }))
  const total = f.lines.reduce((n, l) => n + (Number(l.unitPrice) || 0) * (Number(l.qty) || 0), 0)
  const setLine = (i: number, patch: Partial<PriceLine>) =>
    setF({
      ...f,
      lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)),
    })
  return (
    <FormDialog
      open
      wide
      onClose={onClose}
      title="Edit proposal"
      saveLabel="Save proposal"
      onSave={() => {
        const res = saveDraftProposal(r.id, {
          ...base,
          title: f.title,
          startDate: f.startDate,
          endDate: f.endDate,
          itinerary: linesOf(f.itinerary),
          inclusions: linesOf(f.inclusions),
          exclusions: linesOf(f.exclusions),
          note: f.note,
          validDays: f.validDays,
          lines: f.lines,
          total,
          datesSet: base.datesSet || flexible,
        })
        if (!res.ok) return res.error
        toast('Proposal saved. Send it when it is ready.')
      }}
    >
      <TextField label="Title" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      {flexible && (
        <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
          The customer chose {r.flexibility.toLowerCase()}
          {r.plan?.datesNote ? ` (${r.plan.datesNote})` : ''}. Set the dates you can offer. Saving confirms these dates for the proposal.
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <TextField
          label="Start date"
          type="date"
          min={DEMO_TODAY}
          value={f.startDate}
          onChange={(e) =>
            setF({
              ...f,
              startDate: e.target.value,
              endDate: e.target.value > f.endDate ? e.target.value : f.endDate,
            })
          }
        />
        <TextField label="End date" type="date" min={f.startDate} value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} />
        <Select label="Valid for" value={f.validDays} onChange={(e) => setF({ ...f, validDays: Number(e.target.value) })}>
          {[3, 5, 7, 14].map((n) => (
            <option key={n} value={n}>
              {n} days
            </option>
          ))}
        </Select>
      </div>
      <TextArea label="Itinerary, one line per day" rows={4} value={f.itinerary} onChange={(e) => setF({ ...f, itinerary: e.target.value })} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Price lines</legend>
        <div className="space-y-2">
          {f.lines.map((l, i) => (
            <div key={i} className="grid grid-cols-[1fr_auto] gap-2 rounded-lg border border-line p-2 sm:grid-cols-[1fr_110px_70px_90px_auto] sm:items-end">
              <TextField label="Description" value={l.label} onChange={(e) => setLine(i, { label: e.target.value })} className="col-span-2 sm:col-span-1" />
              <TextField
                label="Unit price (₱)"
                type="number"
                inputMode="numeric"
                min={0}
                value={l.unitPrice}
                onChange={(e) => setLine(i, { unitPrice: Number(e.target.value) })}
              />
              <TextField label="Qty" type="number" inputMode="numeric" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} />
              <TextField label="Per" value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} />
              <button
                type="button"
                className="mb-1 grid size-10 place-items-center self-end rounded-lg text-ink-2 hover:bg-bad-bg hover:text-bad"
                aria-label={`Remove ${l.label || 'line'}`}
                onClick={() => setF({ ...f, lines: f.lines.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between">
          <Button
            size="sm"
            variant="ghost"
            icon={<Plus className="size-4" aria-hidden />}
            onClick={() =>
              setF({
                ...f,
                lines: [...f.lines, { label: '', unitPrice: 0, qty: 1, unit: 'trip', amount: 0 }],
              })
            }
          >
            Add price line
          </Button>
          <p className="text-sm font-semibold text-ink tnum">
            Total {peso(total)}
            <span className="ml-1 font-normal text-ink-2">· {peso(Math.round(total / Math.max(1, r.groupSize)))} per person</span>
          </p>
        </div>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea label="Inclusions, one per line" rows={3} value={f.inclusions} onChange={(e) => setF({ ...f, inclusions: e.target.value })} />
        <TextArea label="Not included, one per line" rows={3} value={f.exclusions} onChange={(e) => setF({ ...f, exclusions: e.target.value })} />
      </div>
      <TextArea
        label="Note to the customer (optional)"
        rows={2}
        value={f.note}
        onChange={(e) => setF({ ...f, note: e.target.value })}
        placeholder="e.g. We added a beginner surf lesson on Day 2."
      />
    </FormDialog>
  )
}
