import { CalendarDays, Check, Clock, Luggage, MapPin, Plus, Trash2, Users } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  DESTINATION_AREAS, DRIVER_OVERNIGHT_ALLOWANCE, MAX_RENTAL_DAYS, OUTSIDE_AREA, OVERTIME_PER_HOUR, PICKUP_AREAS, proposalExpired,
  rentalEndDate, rentalEstimate, SERVICE_HOURS_PER_DAY, validateRental,
} from '../../domain/requests'
import { BOOKING_CUTOFF_DAYS, money } from '../../domain/rules'
import { addDays, DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtRange, fmtStamp, fmtTime, peso } from '../../lib/format'
import { useCustomer, useMe, type RentalForm } from '../../state/customerStore'
import type { Dataset, RentalTripType, VehicleCategory } from '../../seed/types'
import { SampleTag, StatusBadge } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { Select, TextArea, TextField } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { Combobox } from '../../ui/Combobox'
import { SampleFill } from '../../ui/SampleFill'
import { landmarkOptions } from '../../domain/places'
import { mobileError, nameError } from '../../ui/validate'
import { BackLink } from './Explore'
import { AskAboutButton, DecisionActions, LinkedBooking, PriceLines, RequestStatusBadge, requestTimeline, SimulateStaff, WithdrawButton } from './Requests'
import { Timeline } from './Timeline'

const TRIP_TYPES: { value: RentalTripType; hint: string }[] = [
  { value: 'Round trip (same day)', hint: 'Out and back on one day' },
  { value: 'Multi-day', hint: 'Driver stays with your group' },
  { value: 'One-way', hint: 'Drop-off only, e.g. airport' },
]

export function RentalLanding() {
  const data = useCustomer((s) => s.data)
  return (
    <div>
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px] md:text-[28px]">Van rental with driver</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        A private van and professional driver for your own route: family trips, outings and transfers within Luzon. Every rental comes with a driver; we don’t offer self-drive.
      </p>
      <ul className="mt-5 grid gap-4 md:grid-cols-2">
        {data.vehicleCategories.map((c) => (
          <li key={c.id}>
            <CategoryCard cat={c} />
          </li>
        ))}
      </ul>

      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="type-head text-[22px] text-charcoal">
            How pricing works
          </h2>
          <ul className="mt-3 space-y-2 text-sm text-ink-2">
            <li>Rates are per service day: up to {SERVICE_HOURS_PER_DAY} hours of driving and waiting, with fuel and the driver included.</li>
            <li>Each calendar day the van is out counts as one service day.</li>
            <li>Multi-day trips add {peso(DRIVER_OVERNIGHT_ALLOWANCE)} per night for the driver’s meals and lodging.</li>
            <li>Same-day trips longer than {SERVICE_HOURS_PER_DAY} hours add about {peso(OVERTIME_PER_HOUR)} per extra hour.</li>
            <li>One-way trips are billed as a full service day because the van returns empty.</li>
            <li>Tolls, parking and entrance fees are not included.</li>
          </ul>
        </Card>
        <Card className="p-5">
          <h2 className="type-head text-[22px] text-charcoal">How it works</h2>
          <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-ink-2">
            <li>Send a request with your route, dates and group size. You see an estimate right away.</li>
            <li>Staff check the route and van availability, then send a quote.</li>
            <li>Accept the quote to create a booking, then pay the down payment.</li>
            <li>Staff confirm the booking and assign your van and driver.</li>
          </ol>
          <p className="mt-3 rounded-xl bg-info-bg px-3 py-2 text-sm text-info">A request does not reserve a van. You pay only after you accept a quote.</p>
          <p className="mt-3 text-xs text-ink-2">
            Pickup areas: {PICKUP_AREAS.join(', ')}. Destinations anywhere in Luzon. Requests close {BOOKING_CUTOFF_DAYS} days before travel; online requests are up to {MAX_RENTAL_DAYS} days.
          </p>
          <LinkButton to="/app/rental/request" className="mt-4">
            Request a van
          </LinkButton>
        </Card>
      </div>
    </div>
  )
}

function CategoryCard({ cat }: { cat: VehicleCategory }) {
  return (
    <Card className="flex h-full flex-col overflow-hidden">
      <Picture image={cat.image} className="h-40" />
      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-lg font-semibold text-ink">{cat.name}</h2>
          <p className="text-sm">
            <span className="font-display text-lg font-bold text-brand-700 tnum">{peso(cat.ratePerDay)}</span>
            <span className="text-ink-2"> /service day</span>
          </p>
        </div>
        <p className="text-sm text-ink-2">{cat.models}</p>
        <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1">
            <Users className="size-4" aria-hidden /> Up to {cat.seats} passengers
          </span>
          <span className="inline-flex items-center gap-1">
            <Luggage className="size-4" aria-hidden /> {cat.luggage}
          </span>
        </p>
        <ul className="mt-3 grid grid-cols-2 gap-1 text-sm">
          {cat.features.map((f) => (
            <li key={f} className="flex gap-1.5">
              <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> {f}
            </li>
          ))}
        </ul>
        <LinkButton to={`/app/rental/request?category=${cat.id}`} variant="secondary" className="mt-auto self-start" style={{ marginTop: 16 }}>
          Request a {cat.name.toLowerCase()}
        </LinkButton>
      </div>
    </Card>
  )
}

function blankRental(categoryId: string, name = '', mobile = ''): RentalForm {
  const start = addDays(DEMO_TODAY, 14)
  return {
    categoryId, tripType: 'Round trip (same day)', pickupArea: 'Bulacan', pickup: '', dropoff: '', destinationArea: '', stops: [],
    startDate: start, startTime: '06:00', endDate: start, endTime: '18:00', passengers: 8, requests: '', contactName: name, contactMobile: mobile,
  }
}

/** Sample answers for the demo helper: a same-day Bataan heritage trip on the first date the van is free. */
function sampleRental(d: Dataset, categoryId: string, name?: string, mobile?: string): RentalForm {
  const cat = d.vehicleCategories.find((c) => c.id === categoryId) ?? d.vehicleCategories[0]
  const base: RentalForm = {
    ...blankRental(cat.id, name, mobile), pickupArea: 'Bulacan', pickup: 'Malolos Cathedral, Malolos', destinationArea: 'Bataan', dropoff: 'Las Casas Filipinas de Acuzar, Bagac',
    stops: ['Mt. Samat Shrine, Pilar'], startTime: '05:30', endTime: '17:30', passengers: Math.min(8, cat.seats),
    requests: 'One child seat, please. We would like a lunch stop in Balanga.', contactName: name || 'Maria Santos', contactMobile: mobile || '0917 555 0123',
  }
  for (let i = 14; i < 75; i++) {
    const f = { ...base, startDate: addDays(DEMO_TODAY, i), endDate: addDays(DEMO_TODAY, i) }
    if (!Object.keys(validateRental(d, f)).length) return f
  }
  return base
}

const destinationChoices = (d: Dataset) =>
  d.destinations.map((x) => ({ value: x.id, label: x.name, sub: x.province, keywords: x.province }))

export function RentalRequestForm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const loc = useLocation()
  const me = useMe()
  const { data, drafts, saveDraft, submitRental } = useCustomer()
  const [f, setF] = useState<RentalForm>(() => {
    const d = drafts.rental
    if (d) return { ...d, contactName: d.contactName || me?.name || '', contactMobile: d.contactMobile || me?.mobile || '' }
    return blankRental(params.get('category') ?? 'CAT-STD', me?.name, me?.mobile)
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  useEffect(() => {
    saveDraft('rental', f)
  }, [f, saveDraft])
  const upd = (patch: Partial<RentalForm>) => setF((x) => ({ ...x, ...patch }))
  const cat = data.vehicleCategories.find((c) => c.id === f.categoryId)
  const live = validateRental(data, f)
  const timingOk = !live.startDate && !live.endDate && !live.endTime && !live.startTime
  const estimate = cat && timingOk ? rentalEstimate(cat, { ...f, endDate: rentalEndDate(f) }) : undefined

  const dirty = !!f.pickup || !!f.dropoff || !!f.destinationArea || f.stops.some(Boolean) || !!f.requests

  const submit = () => {
    const e = validateRental(data, f)
    const name = nameError(f.contactName)
    const mobile = mobileError(f.contactMobile)
    if (name) e.contactName = name
    if (mobile) e.contactMobile = mobile
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
      <BackLink to="/app/rental" label="Van rental" />
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">Request a van with driver</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">You’ll see an estimate as you fill this in. Staff confirm the final quote; a request does not reserve a van.</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="space-y-5 p-5">
          <SampleFill
            dirty={dirty}
            what="a sample Bataan day trip"
            onFill={() => (setF(sampleRental(data, f.categoryId, me?.name, me?.mobile)), setErrors({}))}
            onClear={() => (setF(blankRental(f.categoryId, me?.name, me?.mobile)), setErrors({}))}
          />
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Vehicle</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {data.vehicleCategories.map((c) => (
                <label key={c.id} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 ${f.categoryId === c.id ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-brand-300'}`}>
                  <input type="radio" name="category" className="mt-1 accent-brand-600" checked={f.categoryId === c.id} onChange={() => upd({ categoryId: c.id })} />
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">{c.name}</span>
                    <span className="block text-ink-2">
                      Up to {c.seats} · {peso(c.ratePerDay)}/service day
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Trip type</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TRIP_TYPES.map((t) => (
                <label key={t.value} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border p-3 ${f.tripType === t.value ? 'border-brand-500 bg-brand-50' : 'border-line hover:border-brand-300'}`}>
                  <input type="radio" name="tripType" className="mt-1 accent-brand-600" checked={f.tripType === t.value} onChange={() => upd({ tripType: t.value })} />
                  <span className="text-sm">
                    <span className="block font-semibold text-ink">{t.value}</span>
                    <span className="block text-xs text-ink-2">{t.hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Pickup area" value={f.pickupArea} onChange={(e) => upd({ pickupArea: e.target.value })} error={errors.pickupArea}>
              {PICKUP_AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
            </Select>
            <Combobox
              label="Pickup address or landmark"
              value={f.pickup}
              onChange={(pickup) => upd({ pickup })}
              onPick={(o) => {
                const [landmark, city] = o.value.split('|')
                upd({ pickup: `${landmark}, ${city}` })
              }}
              options={landmarkOptions('', f.pickupArea)}
              error={errors.pickup}
              placeholder="Search or type an address"
              hint="Staff confirm the exact pickup spot with you."
              freeTextNote="We'll use the address you typed."
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Select label="Destination province" value={f.destinationArea} onChange={(e) => upd({ destinationArea: e.target.value })} error={errors.destinationArea}>
              <option value="">Choose a province</option>
              {DESTINATION_AREAS.map((a) => (
                <option key={a}>{a}</option>
              ))}
              <option>{OUTSIDE_AREA}</option>
            </Select>
            <Combobox
              label={f.tripType === 'One-way' ? 'Drop-off point' : 'Main destination'}
              value={f.dropoff}
              onChange={(dropoff) => upd({ dropoff })}
              onPick={(o) => {
                const dest = data.destinations.find((x) => x.id === o.value)
                if (dest) upd({ dropoff: `${dest.name}, ${dest.province}`, ...(DESTINATION_AREAS.includes(dest.province) ? { destinationArea: dest.province } : {}) })
              }}
              options={destinationChoices(data)}
              error={errors.dropoff}
              placeholder="e.g. Morong, Bataan"
              freeTextNote="We'll use the place you typed."
            />
          </div>
          <div>
            <p className="mb-1.5 text-sm font-medium text-ink">Stops along the way (optional)</p>
            <ul className="space-y-2">
              {f.stops.map((s, i) => (
                <li key={i} className="flex items-center gap-2">
                  <label className="sr-only" htmlFor={`stop-${i}`}>
                    Stop {i + 1}
                  </label>
                  <input
                    id={`stop-${i}`}
                    value={s}
                    onChange={(e) => upd({ stops: f.stops.map((x, j) => (j === i ? e.target.value : x)) })}
                    placeholder={`Stop ${i + 1}`}
                    className="h-11 flex-1 rounded-xl border border-line px-3.5 text-[15px] focus:border-brand-500 focus:outline-none"
                  />
                  <button type="button" onClick={() => upd({ stops: f.stops.filter((_, j) => j !== i) })} aria-label={`Remove stop ${i + 1}`} className="rounded-lg p-2 text-ink-3 hover:bg-surface-muted hover:text-bad">
                    <Trash2 className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            {f.stops.length < 3 && (
              <Button size="sm" variant="ghost" className="mt-1 -ml-2" icon={<Plus className="size-4" aria-hidden />} onClick={() => upd({ stops: [...f.stops, ''] })}>
                Add a stop
              </Button>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Departure date" type="date" min={addDays(DEMO_TODAY, BOOKING_CUTOFF_DAYS + 1)} value={f.startDate} onChange={(e) => upd({ startDate: e.target.value })} error={errors.startDate} />
            <TextField label="Pickup time" type="time" value={f.startTime} onChange={(e) => upd({ startTime: e.target.value })} error={errors.startTime} />
          </div>
          {f.tripType !== 'One-way' && (
            <div className="grid gap-4 sm:grid-cols-2">
              {f.tripType === 'Multi-day' ? (
                <TextField label="Return date" type="date" min={f.startDate} value={f.endDate} onChange={(e) => upd({ endDate: e.target.value })} error={errors.endDate} />
              ) : (
                <div className="hidden sm:block" />
              )}
              <TextField label="Return time" type="time" value={f.endTime} onChange={(e) => upd({ endTime: e.target.value })} error={errors.endTime} />
            </div>
          )}
          <TextField
            label="Passengers"
            type="number"
            inputMode="numeric"
            min={1}
            max={cat?.seats}
            value={Number.isNaN(f.passengers) ? '' : f.passengers}
            onChange={(e) => upd({ passengers: e.target.value === '' ? NaN : Number(e.target.value) })}
            error={errors.passengers}
            hint={cat ? `A ${cat.name.toLowerCase()} seats up to ${cat.seats}.` : undefined}
          />
          <TextArea label="Special requests (optional)" maxLength={300} value={f.requests} onChange={(e) => upd({ requests: e.target.value })} placeholder="Child seats, extra luggage, a stop for lunch" />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Contact person" value={f.contactName} onChange={(e) => upd({ contactName: e.target.value })} error={errors.contactName} />
            <TextField label="Contact mobile" inputMode="tel" value={f.contactMobile} onChange={(e) => upd({ contactMobile: e.target.value })} error={errors.contactMobile} hint="Staff use this number about your request." />
          </div>
          {(errors.availability || (live.availability && timingOk)) && (
            <p role="alert" className="rounded-xl bg-warn-bg px-3.5 py-2.5 text-sm text-warn">
              {errors.availability ?? live.availability}
            </p>
          )}
          <Button size="lg" full onClick={submit}>
            {me ? 'Send request' : 'Log in to send request'}
          </Button>
          {!me && <p className="text-center text-xs text-ink-2">Your answers stay on this page while you log in.</p>}
        </Card>
        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="font-display text-base font-semibold text-ink">
              Estimate <SampleTag>Not a quote</SampleTag>
            </h2>
            {estimate ? (
              <>
                <p className="mt-1 text-sm text-ink-2">
                  {fmtRange(f.startDate, rentalEndDate(f))} · {estimate.serviceDays} service {estimate.serviceDays === 1 ? 'day' : 'days'}
                </p>
                <div className="mt-3">
                  <PriceLines lines={estimate.lines} total={estimate.total} />
                </div>
                <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink-2">
                  {estimate.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-sm text-ink-2">Enter valid dates and times to see an estimate.</p>
            )}
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Send this request?"
        body={`${cat?.name} to ${f.dropoff}, ${fmtRange(f.startDate, rentalEndDate(f))}, ${f.passengers} passengers. Estimate ${estimate ? peso(estimate.total) : ''}. Staff will send a quote; nothing is reserved or charged yet.`}
        confirmLabel="Send request"
        delay={500}
        onConfirm={() => {
          const r = submitRental(f)
          if (!r.ok) return r.error
          navigate(`/app/rentals/${r.value.id}`, { replace: true })
        }}
      />
    </div>
  )
}

export function RentalRequestDetails() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { data, customerId, acceptQuote } = useCustomer()
  const r = data.rentalRequests.find((x) => x.id === requestId && x.customerId === customerId)
  if (!r) return <EmptyState title="Request not found" action={<LinkButton to="/app/trips?tab=rental">My Trips</LinkButton>} />
  const cat = data.vehicleCategories.find((c) => c.id === r.categoryId)!
  const booking = r.bookingId ? data.bookings.find((b) => b.id === r.bookingId) : undefined
  const q = r.quote
  const expired = !!q && proposalExpired(q.validUntil)
  const steps = requestTimeline(r.events, r.status, 'rental', booking, booking ? money(booking, data.payments).paid : 0)

  return (
    <div>
      <BackLink to="/app/trips?tab=rental" label="My Trips" />
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <Card className="p-5">
            <p className="text-sm text-ink-2">{r.id} · van rental request</p>
            <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">
              {cat.name} to {r.dropoff}
            </h1>
            <div className="mt-2 flex flex-wrap gap-1.5">
              <RequestStatusBadge status={r.status} kind="rental" />
              {r.status === 'Proposal ready' && expired && <StatusBadge status="Expired" />}
            </div>
            <div className="mt-4 space-y-1 text-sm text-ink-2">
              <p className="flex items-center gap-2">
                <CalendarDays className="size-4" aria-hidden /> {r.tripType} · {fmtRange(r.startDate, r.endDate)}
              </p>
              <p className="flex items-center gap-2">
                <Clock className="size-4" aria-hidden /> Pickup {fmtTime(r.startTime)}
                {r.endTime && ` · return ${fmtTime(r.endTime)}`}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4" aria-hidden /> {r.pickup} ({r.pickupArea}) → {r.dropoff} ({r.destinationArea})
              </p>
              {r.stops.length > 0 && <p>Stops: {r.stops.join('; ')}</p>}
              <p className="flex items-center gap-2">
                <Users className="size-4" aria-hidden /> {r.passengers} passengers
              </p>
              {r.requests && <p>Requests: {r.requests}</p>}
              <p>
                Contact {r.contactName}, {r.contactMobile} · sent {fmtStamp(r.createdAt)}
              </p>
            </div>
          </Card>

          <Card className="p-5">
            {q && (r.status === 'Proposal ready' || r.status === 'Accepted') ? (
              <>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="type-head text-[22px] text-charcoal">Quote from staff</h2>
                  <p className={`text-xs ${expired && r.status === 'Proposal ready' ? 'font-semibold text-bad' : 'text-ink-2'}`}>
                    Sent {fmtStamp(q.sentAt)} · valid until {fmtDate(q.validUntil, { year: false })}
                  </p>
                </div>
                {q.note && <p className="mt-1 text-sm text-ink-2">{q.note}</p>}
                <div className="mt-3">
                  <PriceLines lines={q.lines} total={q.total} />
                </div>
                {q.total !== r.estimate.total && (
                  <p className="mt-2 text-xs text-ink-2">
                    Your estimate was {peso(r.estimate.total)}. The quote is what you’ll pay.
                  </p>
                )}
              </>
            ) : (
              <>
                <h2 className="type-head text-[22px] text-charcoal">
                  Estimate <SampleTag>Not a quote</SampleTag>
                </h2>
                <div className="mt-3">
                  <PriceLines lines={r.estimate.lines} total={r.estimate.total} />
                </div>
              </>
            )}
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-ink-2">
              {(q ?? r.estimate).notes.map((n) => (
                <li key={n}>{n}</li>
              ))}
            </ul>
          </Card>

          <Card className="p-5">
            <h2 className="type-head text-[22px] text-charcoal">Status</h2>
            <Timeline steps={steps} />
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          {booking && <LinkedBooking booking={booking} />}
          <Card className="space-y-3 p-5">
            {r.status === 'Proposal ready' && q ? (
              <>
                <Row label="Quoted total" strong>
                  {peso(q.total)}
                </Row>
                <DecisionActions
                  kind="rental"
                  id={r.id}
                  expired={expired}
                  acceptLabel="Accept quote"
                  acceptBody={`This creates a pending booking for ${peso(q.total)}. Pay the ${peso(Math.ceil(q.total / 2))} down payment next; staff confirm it and assign your van and driver.`}
                  onAccept={() => {
                    const res = acceptQuote(r.id)
                    if (!res.ok) return res.error
                    navigate(`/app/trips/${res.value.id}`)
                  }}
                />
              </>
            ) : (
              <p className="text-sm text-ink-2">
                {r.status === 'Submitted' && 'Request sent. A request does not reserve a van; staff will check availability and send a quote.'}
                {r.status === 'Under review' && 'Staff are checking your route and van availability.'}
                {r.status === 'Accepted' && 'You accepted the quote. Continue with your linked booking.'}
                {r.status === 'Closed' && 'This request is closed.'}
              </p>
            )}
            {(r.status === 'Submitted' || r.status === 'Under review' || r.status === 'Proposal ready') && <WithdrawButton kind="rental" id={r.id} />}
            <AskAboutButton kind="rental" id={r.id} />
          </Card>
          <SimulateStaff kind="rental" id={r.id} status={r.status} />
          <p className="text-center text-xs text-ink-3">
            Requests never count as bookings or revenue. <Link to="/app/rental/request" className="underline">New request</Link>
          </p>
        </aside>
      </div>
    </div>
  )
}
