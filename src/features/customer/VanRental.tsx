import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BOOKING_CUTOFF_DAYS, rentalDays, VAN_RENTAL_MAX_PAX } from '../../domain/rules'
import { addDays, DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtRange } from '../../lib/format'
import { useCustomer, useMe } from '../../state/customerStore'
import { SampleTag } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { TextArea, TextField } from '../../ui/Field'
import { mobileError, nameError } from '../../ui/validate'
import { PriceSummary, ReviewBlock } from './Book'
import { BackLink } from './Explore'

const MAX_DAYS = 7

export function VanRental() {
  const navigate = useNavigate()
  const { data, createBooking } = useCustomer()
  const me = useMe()
  const service = data.services.find((s) => s.type === 'van')!
  const minStart = addDays(DEMO_TODAY, BOOKING_CUTOFF_DAYS + 1)
  const [f, setF] = useState({ start: '', end: '', pax: '6', pickup: '', destination: '', name: me?.name ?? '', mobile: me?.mobile ?? '', notes: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [review, setReview] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const validate = () => {
    const e: Record<string, string> = {}
    if (!f.start) e.start = 'Choose a start date.'
    else if (f.start < minStart) e.start = `The earliest start date is ${fmtDate(minStart, { weekday: true })}.`
    if (!f.end) e.end = 'Choose an end date.'
    else if (f.start && f.end < f.start) e.end = 'The end date must be on or after the start date.'
    else if (f.start && rentalDays(f.start, f.end) > MAX_DAYS) e.end = `Online requests are up to ${MAX_DAYS} days. Contact the office for longer trips.`
    const pax = Number(f.pax)
    if (!Number.isInteger(pax) || pax < 1 || pax > VAN_RENTAL_MAX_PAX) e.pax = `Enter 1 to ${VAN_RENTAL_MAX_PAX} passengers.`
    if (f.pickup.trim().length < 3) e.pickup = 'Enter the pickup city or address.'
    if (f.destination.trim().length < 3) e.destination = 'Enter where you are going.'
    const n = nameError(f.name)
    const m = mobileError(f.mobile)
    if (n) e.name = n
    if (m) e.mobile = m
    return e
  }

  const days = f.start && f.end && f.end >= f.start ? rentalDays(f.start, f.end) : 0
  const total = days * service.price
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <div>
      {review ? <BackLink label="Edit request" /> : <BackLink to={`/app/services/${service.id}`} label={service.name} />}
      <h1 className="font-display text-2xl font-bold text-brand-900">{review ? 'Review van rental' : 'Van rental request'}</h1>
      <p className="mt-1 text-sm text-ink-2">A private van with driver and fuel. Tolls and parking are not included.</p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        {!review ? (
          <Card className="space-y-4 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Start date" type="date" min={minStart} value={f.start} onChange={set('start')} error={errors.start} />
              <TextField label="End date" type="date" min={f.start || minStart} value={f.end} onChange={set('end')} error={errors.end} />
            </div>
            <TextField label="Passengers" type="number" inputMode="numeric" min={1} max={VAN_RENTAL_MAX_PAX} value={f.pax} onChange={set('pax')} error={errors.pax} hint={`Up to ${VAN_RENTAL_MAX_PAX} passengers per van.`} />
            <TextField label="Pickup city or address" value={f.pickup} onChange={set('pickup')} error={errors.pickup} placeholder="e.g. Malolos, Bulacan" />
            <TextField label="Destination" value={f.destination} onChange={set('destination')} error={errors.destination} placeholder="e.g. Baler, Aurora" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Contact person" value={f.name} onChange={set('name')} error={errors.name} />
              <TextField label="Contact mobile" inputMode="tel" value={f.mobile} onChange={set('mobile')} error={errors.mobile} />
            </div>
            <TextArea label="Notes (optional)" maxLength={300} value={f.notes} onChange={set('notes')} />
            <Button
              size="lg"
              full
              onClick={() => {
                const e = validate()
                setErrors(e)
                if (Object.keys(e).length === 0) setReview(true)
              }}
            >
              Review request
            </Button>
          </Card>
        ) : (
          <Card className="divide-y divide-line">
            <ReviewBlock title="Dates" onChange={() => setReview(false)}>
              <p className="font-medium text-ink">{fmtRange(f.start, f.end)}</p>
              <p>
                {days} {days === 1 ? 'day' : 'days'}
              </p>
            </ReviewBlock>
            <ReviewBlock title="Trip" onChange={() => setReview(false)}>
              <p>
                {f.pickup} → {f.destination}
              </p>
              <p>{f.pax} passengers</p>
            </ReviewBlock>
            <ReviewBlock title="Contact" onChange={() => setReview(false)}>
              <p>
                {f.name} · {f.mobile}
              </p>
            </ReviewBlock>
            <div className="p-5">
              <p className="rounded-xl bg-info-bg px-3.5 py-2.5 text-sm text-info">The agency assigns a van and driver after your booking is confirmed.</p>
              <Button size="lg" full className="mt-4" onClick={() => setConfirm(true)}>
                Submit request
              </Button>
            </div>
          </Card>
        )}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <p className="font-display text-base font-semibold text-ink">{service.name}</p>
            {days > 0 ? (
              <div className="mt-3">
                <PriceSummary unitPrice={service.price} promoOff={0} pax={Number(f.pax) || 1} total={total} unit="day" days={days} />
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-2">
                ₱6,500 per day, both dates included. Choose dates to see the total.
                <SampleTag />
              </p>
            )}
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit this van rental request?"
        body={`${fmtRange(f.start, f.end)}, ${f.pax} passengers, ${f.pickup} to ${f.destination}.`}
        confirmLabel="Submit request"
        delay={600}
        onConfirm={() => {
          const r = createBooking({
            serviceId: service.id,
            pax: Number(f.pax),
            contactName: f.name,
            contactMobile: f.mobile,
            notes: f.notes,
            rental: { startDate: f.start, endDate: f.end, pickup: f.pickup, destination: f.destination },
          })
          if (!r.ok) return r.error
          navigate(`/app/booked/${r.value.id}`, { replace: true })
        }}
      />
    </div>
  )
}
