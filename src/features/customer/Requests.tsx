import { FlaskConical, MessageCircleQuestion } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { requestStatusLabel } from '../../domain/requests'
import { money } from '../../domain/rules'
import { peso } from '../../lib/format'
import { useAssistant } from '../../state/assistant'
import { useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import type { Booking, PriceLine, RequestEvent, RequestStatus } from '../../seed/types'
import { SampleTag, StatusBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Row } from '../../ui/Card'
import { ConfirmDialog, Dialog } from '../../ui/Dialog'
import { TextArea } from '../../ui/Field'
import type { TimelineStep } from './Timeline'

// Shared pieces for custom-trip and van-rental request pages.

const NEXT: Record<RequestStatus, RequestStatus[]> = {
  Submitted: ['Under review', 'Proposal ready', 'Accepted'],
  'Under review': ['Proposal ready', 'Accepted'],
  'Proposal ready': ['Accepted'],
  Accepted: [],
  Closed: [],
}

function eventLabel(e: RequestEvent, i: number, events: RequestEvent[], kind: 'custom' | 'rental') {
  const doc = kind === 'rental' ? 'Quote' : 'Proposal'
  if (e.status === 'Submitted') return 'Request sent'
  if (e.status === 'Proposal ready') return `${doc} sent`
  if (e.status === 'Under review' && events[i - 1]?.status === 'Proposal ready') return 'Changes requested'
  if (e.status === 'Accepted') return `${doc} accepted`
  return e.status
}

/** Timeline from the request's real events, then the steps still to come, then the linked booking. */
export function requestTimeline(events: RequestEvent[], status: RequestStatus, kind: 'custom' | 'rental', booking?: Booking, paid = 0): TimelineStep[] {
  const doc = kind === 'rental' ? 'Quote' : 'Proposal'
  const steps: TimelineStep[] = events.map((e, i) => ({ label: eventLabel(e, i, events, kind), at: e.at, note: e.note, done: true }))
  for (const s of NEXT[status]) steps.push({ label: s === 'Proposal ready' ? `${doc} sent` : s === 'Accepted' ? `${doc} accepted` : s, done: false })
  if (status !== 'Closed') {
    steps.push({ label: 'Down payment verified', done: !!booking && paid > 0 })
    steps.push({ label: 'Booking confirmed', at: booking?.confirmedAt, done: booking?.status === 'Confirmed' || booking?.status === 'Completed' })
  }
  return steps
}

export function RequestStatusBadge({ status, kind }: { status: RequestStatus; kind: 'custom' | 'rental' }) {
  return <StatusBadge status={requestStatusLabel(status, kind)} />
}

export function PriceLines({ lines, total, perPerson }: { lines: PriceLine[]; total: number; perPerson?: number }) {
  return (
    <div className="divide-y divide-line">
      <div className="pb-2">
        {lines.map((l) => (
          <Row key={l.label} label={`${l.label} · ${peso(l.unitPrice)} × ${l.qty} ${l.unit}${l.qty === 1 ? '' : 's'}`}>
            {peso(l.amount)}
          </Row>
        ))}
      </div>
      <div className="pt-2">
        <Row label="Total" strong>
          {peso(total)}
        </Row>
        {perPerson && <Row label={`Per person (${perPerson})`}>{peso(Math.ceil(total / perPerson))}</Row>}
        <Row
          label={
            <>
              Down payment after you accept (50%)
              <SampleTag />
            </>
          }
        >
          {peso(Math.ceil(total / 2))}
        </Row>
      </div>
    </div>
  )
}

/** Accept / request changes / withdraw for a proposal or quote that is waiting for the customer. */
export function DecisionActions({
  kind, id, expired, acceptLabel, acceptBody, onAccept,
}: { kind: 'custom' | 'rental'; id: string; expired: boolean; acceptLabel: string; acceptBody: ReactNode; onAccept: () => string | void }) {
  const { requestChanges } = useCustomer()
  const toast = useUi((s) => s.toast)
  const [accept, setAccept] = useState(false)
  const [changes, setChanges] = useState(false)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  return (
    <div className="grid gap-2">
      <Button size="lg" full disabled={expired} onClick={() => setAccept(true)}>
        {acceptLabel}
      </Button>
      {expired && <p className="text-xs text-ink-2">This {kind === 'rental' ? 'quote' : 'proposal'} has expired. Request changes to get an updated one.</p>}
      <Button size="lg" full variant="secondary" onClick={() => setChanges(true)}>
        Request changes
      </Button>
      <ConfirmDialog open={accept} onClose={() => setAccept(false)} title={`${acceptLabel}?`} body={acceptBody} confirmLabel={acceptLabel} delay={500} onConfirm={onAccept} />
      <Dialog
        open={changes}
        onClose={() => setChanges(false)}
        title="Request changes"
        footer={
          <>
            <Button variant="secondary" onClick={() => setChanges(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                const r = requestChanges(kind, id, text)
                if (!r.ok) return setError(r.error)
                setChanges(false)
                setText('')
                setError('')
                toast('Change request sent. Staff will send an updated version.')
              }}
            >
              Send change request
            </Button>
          </>
        }
      >
        <p className="mb-3">Tell staff what to change. The request goes back to review and you’ll get an updated {kind === 'rental' ? 'quote' : 'proposal'}.</p>
        <TextArea label="What would you like to change?" value={text} maxLength={400} onChange={(e) => setText(e.target.value)} error={error} placeholder="e.g. Can we leave an hour later on day 1?" />
      </Dialog>
    </div>
  )
}

export function WithdrawButton({ kind, id }: { kind: 'custom' | 'rental'; id: string }) {
  const { withdrawRequest } = useCustomer()
  const toast = useUi((s) => s.toast)
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" full onClick={() => setOpen(true)}>
        Withdraw request
      </Button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Withdraw this request?"
        body="Staff will stop working on it. You can send a new request any time."
        confirmLabel="Withdraw"
        tone="danger"
        onConfirm={() => {
          const r = withdrawRequest(kind, id)
          if (!r.ok) return r.error
          toast('Request withdrawn.')
        }}
      />
    </>
  )
}

/** Presenter control that plays the staff side forward, clearly marked as a demo shortcut. */
export function SimulateStaff({ kind, id, status }: { kind: 'custom' | 'rental'; id: string; status: RequestStatus }) {
  const simulate = useCustomer((s) => s.simulateStaffUpdate)
  const toast = useUi((s) => s.toast)
  if (status !== 'Submitted' && status !== 'Under review') return null
  const doc = kind === 'rental' ? 'quote' : 'proposal'
  return (
    <div className="rounded-2xl border border-dashed border-line-strong p-4">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
        <FlaskConical className="size-4" aria-hidden /> Demo control
      </p>
      <p className="mt-1 text-xs text-ink-2">In the real system staff do this from the admin side. This button plays their next step so you can continue the demo.</p>
      <Button
        size="sm"
        variant="secondary"
        className="mt-2"
        onClick={() => {
          const r = simulate(kind, id)
          if (r.ok) toast(r.value === 'Under review' ? 'Simulated: staff started reviewing.' : `Simulated: staff sent the ${doc}.`, 'info')
        }}
      >
        {status === 'Submitted' ? 'Simulate staff review' : `Simulate staff ${doc}`}
      </Button>
    </div>
  )
}

export function AskAboutButton({ kind, id }: { kind: 'booking' | 'custom' | 'rental'; id: string }) {
  const openWith = useAssistant((s) => s.openWith)
  return (
    <Button variant="ghost" full icon={<MessageCircleQuestion className="size-4" aria-hidden />} onClick={() => openWith({ kind, id })}>
      Ask about this {kind === 'booking' ? 'booking' : 'request'}
    </Button>
  )
}

export function LinkedBooking({ booking }: { booking: Booking }) {
  const data = useCustomer((s) => s.data)
  const m = money(booking, data.payments)
  return (
    <Link to={`/app/trips/${booking.id}`} className="block rounded-2xl border border-brand-200 bg-brand-50 p-4 hover:border-brand-400">
      <p className="text-xs font-semibold text-brand-700">Linked booking</p>
      <p className="mt-0.5 font-display font-semibold text-ink">
        {booking.id} · {booking.label}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <StatusBadge status={booking.status} />
        <StatusBadge status={m.summary} />
      </div>
      <p className="mt-2 text-sm text-ink-2">
        {m.paid === 0 && booking.status === 'Pending' ? `Pay the ${peso(m.down)} down payment so staff can confirm it.` : `Total ${peso(booking.total)} · balance ${peso(m.balance)}`}
      </p>
    </Link>
  )
}
