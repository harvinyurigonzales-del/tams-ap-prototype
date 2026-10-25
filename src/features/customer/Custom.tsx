import { CalendarDays, MapPin, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { draftCustomProposal, MAX_GROUP, proposalExpired, validateCustom } from '../../domain/requests'
import { money } from '../../domain/rules'
import { addDays, DEMO_NOW, DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtRange, fmtStamp, peso } from '../../lib/format'
import { useCustomer, useMe, type CustomForm } from '../../state/customerStore'
import { INTERESTS, type CustomRequest } from '../../seed/types'
import { SampleTag, StatusBadge } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { Select, TextArea, TextField } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { BackLink } from './Explore'
import { AskAboutButton, DecisionActions, LinkedBooking, PriceLines, RequestStatusBadge, requestTimeline, SimulateStaff, WithdrawButton } from './Requests'
import { Timeline } from './Timeline'

const FLEX: CustomRequest['flexibility'][] = ['Exact dates', '± 3 days', 'Any weekend this month']

function blankForm(destinationId: string, name = '', mobile = ''): CustomForm {
  const start = addDays(DEMO_TODAY, 21)
  return {
    destinationId, startDate: start, endDate: addDays(start, 1), flexibility: 'Exact dates', groupSize: 4, pickup: '', budgetMin: 3000, budgetMax: 5000,
    interests: [], requests: '', contactName: name, contactMobile: mobile,
  }
}

export function CustomRequestForm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const loc = useLocation()
  const me = useMe()
  const { data, drafts, saveDraft, submitCustom } = useCustomer()
  const [f, setF] = useState<CustomForm>(() => {
    const d = drafts.custom
    if (d) return { ...d, contactName: d.contactName || me?.name || '', contactMobile: d.contactMobile || me?.mobile || '' }
    return blankForm(params.get('destination') ?? '', me?.name, me?.mobile)
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const dest = data.destinations.find((x) => x.id === f.destinationId)

  // Keep the draft in memory so it survives going to the login page and back.
  useEffect(() => {
    saveDraft('custom', f)
  }, [f, saveDraft])

  const upd = (patch: Partial<CustomForm>) => setF((x) => ({ ...x, ...patch }))
  const num = (v: string) => (v === '' ? NaN : Number(v))
  const guide = dest && f.startDate && f.endDate >= f.startDate && f.groupSize > 0 && f.groupSize <= MAX_GROUP ? draftCustomProposal({ ...f, pickup: f.pickup || 'your pickup point' }, dest, DEMO_NOW) : undefined

  const submit = () => {
    const e = validateCustom(f)
    setErrors(e)
    if (Object.keys(e).length) {
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
      return
    }
    if (!me) {
      navigate(`/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}`)
      return
    }
    setConfirm(true)
  }

  return (
    <div>
      <BackLink label="Back" />
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">Plan a custom trip</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        Tell us about your trip. Staff prepare a proposal with an itinerary and price. A request is not a booking: nothing is reserved and you pay only if you accept the proposal.
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="space-y-5 p-5">
          <Select label="Destination" value={f.destinationId} onChange={(e) => upd({ destinationId: e.target.value })} error={errors.destinationId}>
            <option value="">Choose a destination</option>
            {data.destinations.map((x) => (
              <option key={x.id} value={x.id}>
                {x.name}, {x.province}
              </option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Start date" type="date" min={addDays(DEMO_TODAY, 7)} value={f.startDate} onChange={(e) => upd({ startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} error={errors.startDate} />
            <TextField label="End date" type="date" min={f.startDate} value={f.endDate} onChange={(e) => upd({ endDate: e.target.value })} error={errors.endDate} />
          </div>
          <Select label="How flexible are your dates?" value={f.flexibility} onChange={(e) => upd({ flexibility: e.target.value as CustomForm['flexibility'] })}>
            {FLEX.map((x) => (
              <option key={x}>{x}</option>
            ))}
          </Select>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Group size" type="number" inputMode="numeric" min={1} max={MAX_GROUP} value={Number.isNaN(f.groupSize) ? '' : f.groupSize} onChange={(e) => upd({ groupSize: num(e.target.value) })} error={errors.groupSize} />
            <TextField label="Pickup city or landmark" value={f.pickup} onChange={(e) => upd({ pickup: e.target.value })} error={errors.pickup} placeholder="e.g. Malolos, Bulacan" />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Budget per person</legend>
            <div className="grid grid-cols-2 gap-4">
              <TextField label="Minimum (₱)" type="number" inputMode="numeric" min={0} value={Number.isNaN(f.budgetMin) ? '' : f.budgetMin} onChange={(e) => upd({ budgetMin: num(e.target.value) })} />
              <TextField label="Maximum (₱)" type="number" inputMode="numeric" min={0} value={Number.isNaN(f.budgetMax) ? '' : f.budgetMax} onChange={(e) => upd({ budgetMax: num(e.target.value) })} />
            </div>
            {errors.budget && (
              <p className="mt-1.5 text-xs font-medium text-bad" role="alert">
                {errors.budget}
              </p>
            )}
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink">Interests (optional)</legend>
            <div className="flex flex-wrap gap-2">
              {INTERESTS.map((i) => {
                const on = f.interests.includes(i)
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={on}
                    onClick={() => upd({ interests: on ? f.interests.filter((x) => x !== i) : [...f.interests, i] })}
                    className={`h-9 rounded-full px-3.5 text-sm font-semibold ${on ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-ink-2 hover:border-brand-300'}`}
                  >
                    {i}
                  </button>
                )
              })}
            </div>
          </fieldset>
          <TextArea label="Special requests (optional)" maxLength={400} value={f.requests} onChange={(e) => upd({ requests: e.target.value })} placeholder="Seniors or children in the group, dietary needs, places you want to see" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Contact person" value={f.contactName} onChange={(e) => upd({ contactName: e.target.value })} error={errors.contactName} />
            <TextField label="Contact mobile" inputMode="tel" value={f.contactMobile} onChange={(e) => upd({ contactMobile: e.target.value })} error={errors.contactMobile} hint="Sample number. No messages are sent." />
          </div>
          <Button size="lg" full onClick={submit}>
            {me ? 'Send request' : 'Log in to send request'}
          </Button>
          {!me && <p className="text-center text-xs text-ink-2">Your answers stay on this page while you log in.</p>}
        </Card>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {dest ? (
            <Card className="overflow-hidden">
              <Picture image={dest.image} className="h-32" />
              <div className="p-4 text-sm text-ink-2">
                <p className="font-display text-base font-semibold text-ink">{dest.name}</p>
                <p>
                  {dest.travelTime} from Manila · suggested {dest.suggestedDays === 1 ? 'day trip' : `${dest.suggestedDays} days`}
                </p>
                {guide && (
                  <p className="mt-3 rounded-xl bg-surface-muted px-3 py-2">
                    Rough guide: about <strong className="text-ink">{peso(Math.ceil(guide.total / f.groupSize))} per person</strong> for a private trip like this at our sample rates. Staff confirm the real price in your proposal.
                    <SampleTag>Estimate</SampleTag>
                  </p>
                )}
              </div>
            </Card>
          ) : (
            <Card className="p-4 text-sm text-ink-2">Choose a destination to see travel time and a rough price guide.</Card>
          )}
          <Card className="p-4 text-sm text-ink-2">
            <p className="font-semibold text-ink">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Staff review your request.</li>
              <li>You get a proposal with an itinerary and price.</li>
              <li>Accept it to create a booking, or ask for changes.</li>
              <li>Pay the down payment; staff confirm your trip.</li>
            </ol>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Send this request?"
        body={`${dest?.name ?? ''}, ${f.startDate && f.endDate ? fmtRange(f.startDate, f.endDate) : ''}, ${f.groupSize} people. Staff will review it and send a proposal. Nothing is reserved yet.`}
        confirmLabel="Send request"
        delay={500}
        onConfirm={() => {
          const r = submitCustom(f)
          if (!r.ok) return r.error
          navigate(`/app/custom/${r.value.id}`, { replace: true })
        }}
      />
    </div>
  )
}

export function CustomRequestDetails() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { data, customerId, acceptProposal } = useCustomer()
  const r = data.customRequests.find((x) => x.id === requestId && x.customerId === customerId)
  if (!r) return <EmptyState title="Request not found" action={<LinkButton to="/app/trips?tab=custom">My Trips</LinkButton>} />
  const dest = data.destinations.find((x) => x.id === r.destinationId)!
  const booking = r.bookingId ? data.bookings.find((b) => b.id === r.bookingId) : undefined
  const p = r.proposal
  const expired = !!p && proposalExpired(p.validUntil)
  const steps = requestTimeline(r.events, r.status, 'custom', booking, booking ? money(booking, data.payments).paid : 0)

  return (
    <div>
      <BackLink to="/app/trips?tab=custom" label="My Trips" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-sm text-ink-2">{r.id} · custom trip request</p>
            <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">{dest.name} custom trip</h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <RequestStatusBadge status={r.status} kind="custom" />
              {r.status === 'Proposal ready' && expired && <StatusBadge status="Expired" />}
            </div>
            <div className="mt-4 space-y-1 text-sm text-ink-2">
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden /> {fmtRange(r.startDate, r.endDate)} · {r.flexibility}
              </p>
              <p className="flex items-center gap-2">
                <Users className="size-4" aria-hidden /> {r.groupSize} people · budget {peso(r.budgetMin)}–{peso(r.budgetMax)} per person
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4" aria-hidden /> Pickup: {r.pickup}
              </p>
              {r.interests.length > 0 && <p>Interests: {r.interests.join(', ')}</p>}
              {r.requests && <p>Requests: {r.requests}</p>}
              <p>
                Contact {r.contactName}, {r.contactMobile} · sent {fmtStamp(r.createdAt)}
              </p>
            </div>
          </Card>

          {p && (r.status === 'Proposal ready' || r.status === 'Accepted') && (
            <Card className="p-5">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="type-head text-[22px] text-charcoal">Proposal: {p.title}</h2>
                <p className={`text-xs ${expired && r.status === 'Proposal ready' ? 'font-semibold text-bad' : 'text-ink-2'}`}>
                  Sent {fmtStamp(p.sentAt)} · valid until {fmtDate(p.validUntil, { year: false })}
                </p>
              </div>
              <p className="mt-1 text-sm text-ink-2">
                {fmtRange(p.startDate, p.endDate)} · {p.groupSize} people
              </p>
              <h3 className="mt-4 text-sm font-semibold text-ink">Itinerary</h3>
              <ol className="mt-2 space-y-2 text-sm">
                {p.itinerary.map((i) => (
                  <li key={i} className="rounded-xl bg-surface-muted px-4 py-2.5">
                    {i}
                  </li>
                ))}
              </ol>
              <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
                <div>
                  <h3 className="font-semibold text-ink">Included</h3>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
                    {p.inclusions.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <h3 className="font-semibold text-ink">Not included</h3>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-ink-2">
                    {p.exclusions.map((i) => (
                      <li key={i}>{i}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <h3 className="mt-4 text-sm font-semibold text-ink">Price</h3>
              <PriceLines lines={p.lines} total={p.total} perPerson={p.groupSize} />
            </Card>
          )}
          {r.status === 'Under review' && p && <p className="rounded-xl bg-info-bg px-4 py-3 text-sm text-info">Staff are updating your proposal after your change request.</p>}

          <Card className="p-5">
            <h2 className="type-head text-[22px] text-charcoal">Status</h2>
            <Timeline steps={steps} />
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {booking && <LinkedBooking booking={booking} />}
          <Card className="space-y-3 p-5">
            {r.status === 'Proposal ready' && p ? (
              <>
                <Row label="Proposal total" strong>
                  {peso(p.total)}
                </Row>
                <DecisionActions
                  kind="custom"
                  id={r.id}
                  expired={expired}
                  acceptLabel="Accept proposal"
                  acceptBody={`This creates a pending booking for ${p.title} at ${peso(p.total)}. Pay the ${peso(Math.ceil(p.total / 2))} down payment next; staff confirm the booking after verifying it.`}
                  onAccept={() => {
                    const res = acceptProposal(r.id)
                    if (!res.ok) return res.error
                    navigate(`/app/trips/${res.value.id}`)
                  }}
                />
              </>
            ) : (
              <p className="text-sm text-ink-2">
                {r.status === 'Submitted' && 'Request sent. Staff will review it soon.'}
                {r.status === 'Under review' && 'Staff are preparing your proposal.'}
                {r.status === 'Accepted' && 'You accepted the proposal. Continue with your linked booking.'}
                {r.status === 'Closed' && 'This request is closed.'}
              </p>
            )}
            {(r.status === 'Submitted' || r.status === 'Under review' || r.status === 'Proposal ready') && <WithdrawButton kind="custom" id={r.id} />}
            <AskAboutButton kind="custom" id={r.id} />
          </Card>
          <SimulateStaff kind="custom" id={r.id} status={r.status} />
          <p className="text-center text-xs text-ink-3">
            Requests never count as bookings or revenue. <Link to="/app/custom/new" className="underline">New request</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
