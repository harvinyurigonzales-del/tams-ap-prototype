import { CheckCircle2, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { isOffered } from '../../domain/packages'
import { UnavailableTour } from './Tours'
import { balanceDueDate, departureAvailability, downPayment, money, promoFor, rentalDays } from '../../domain/rules'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtRange, fmtTime, peso } from '../../lib/format'
import { useCustomer, useMe } from '../../state/customerStore'
import type { Booking, Service } from '../../seed/types'
import { SampleTag, StatusBadge } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { TextArea, TextField } from '../../ui/Field'
import { EmptyState } from '../../ui/EmptyState'
import { mobileError, nameError } from '../../ui/validate'
import { SampleFill } from '../../ui/SampleFill'
import { BackLink } from './Explore'
import { Steps } from './Steps'
import { bookingSteps, Stepper } from './Timeline'

export function PriceSummary({ unitPrice, promoOff, pax, total, unit = 'person', days }: { unitPrice: number; promoOff: number; pax: number; total: number; unit?: 'person' | 'day'; days?: number }) {
  return (
    <div className="divide-y divide-line">
      <div className="pb-2">
        {unit === 'person' ? (
          <>
            <Row label={`${peso(unitPrice)} × ${pax} ${pax === 1 ? 'traveller' : 'travellers'}`}>{peso(unitPrice * pax)}</Row>
            {promoOff > 0 && <Row label={`Promo, ${peso(promoOff)} off × ${pax}`}>−{peso(promoOff * pax)}</Row>}
          </>
        ) : (
          <Row label={`${peso(unitPrice)} × ${days} ${days === 1 ? 'day' : 'days'}`}>{peso(total)}</Row>
        )}
      </div>
      <div className="pt-2">
        <Row label="Total" strong>
          {peso(total)}
        </Row>
        <Row
          label={
            <>
              Down payment (50%)
              <SampleTag />
            </>
          }
        >
          {peso(downPayment(total))}
        </Row>
      </div>
    </div>
  )
}

export function BookingForm() {
  const { departureId } = useParams()
  const navigate = useNavigate()
  const { data, createBooking } = useCustomer()
  const me = useMe()
  const dep = data.departures.find((d) => d.id === departureId)
  const service = dep && data.services.find((s) => s.id === dep.serviceId)
  const [step, setStep] = useState<2 | 3>(2)
  const [params] = useSearchParams()
  // The traveller count chosen on the date page carries through login and into this form.
  const [pax, setPax] = useState(() => Math.max(1, Math.min(dep ? departureAvailability(dep, data.bookings).left || 1 : 1, Number(params.get('pax')) || 1)))
  const [contact, setContact] = useState({ name: me?.name ?? '', mobile: me?.mobile ?? '', notes: '' })
  const [errors, setErrors] = useState({ name: '', mobile: '' })
  const [confirm, setConfirm] = useState(false)

  if (!dep || !service) return <EmptyState title="Departure not found" action={<LinkButton to="/app">Back to Explore</LinkButton>} />
  if (!isOffered(service)) return <UnavailableTour />
  const avail = departureAvailability(dep, data.bookings)
  if (avail.state !== 'open')
    return (
      <EmptyState
        title={avail.state === 'full' ? 'This departure is full' : 'Online booking for this date is closed'}
        action={<LinkButton to={`/app/tours/${service.id}/dates`}>Choose another date</LinkButton>}
      />
    )
  const promo = promoFor(dep, DEMO_TODAY)
  const total = (service.price - promo) * pax
  const atMax = pax >= avail.left

  const toReview = () => {
    const errs = { name: nameError(contact.name), mobile: mobileError(contact.mobile) }
    setErrors(errs)
    if (!errs.name && !errs.mobile) {
      setStep(3)
      window.scrollTo(0, 0)
    }
  }

  const summary = (
    <Card className="p-5">
      <p className="font-display text-base font-semibold text-ink">{service.name}</p>
      <p className="mt-0.5 text-sm text-ink-2">{fmtRange(dep.startDate, dep.endDate)}</p>
      <div className="mt-4">
        <PriceSummary unitPrice={service.price} promoOff={promo} pax={pax} total={total} />
      </div>
      <p className="mt-3 text-xs text-ink-2">Balance due {fmtDate(balanceDueDate(dep.startDate), { weekday: true })}.</p>
    </Card>
  )

  return (
    <div>
      {step === 2 ? <BackLink to={`/app/tours/${service.id}/dates?d=${dep.id}`} label="Choose date" /> : <BackLink label="Edit details" />}
      <Steps current={step} />
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">{step === 2 ? 'Booking details' : 'Review booking'}</h1>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        {step === 2 ? (
          <Card className="page-in space-y-5 p-5">
            <SampleFill
              dirty={contact.notes !== '' || contact.name !== (me?.name ?? '') || contact.mobile !== (me?.mobile ?? '') || pax > 1}
              what="sample traveller details"
              onFill={() => {
                setPax(Math.min(2, avail.left))
                setContact({ name: me?.name || 'Maria Santos', mobile: me?.mobile || '0917 555 0123', notes: 'Window seats if possible. One traveller is vegetarian.' })
                setErrors({ name: '', mobile: '' })
              }}
              onClear={() => {
                setPax(1)
                setContact({ name: '', mobile: '', notes: '' })
                setErrors({ name: '', mobile: '' })
              }}
            />
            <div>
              <p className="mb-2 text-sm font-medium text-ink">Travellers</p>
              <div className="flex items-center gap-3">
                <Button variant="secondary" size="lg" aria-label="Remove a traveller" disabled={pax <= 1} onClick={() => setPax(pax - 1)}>
                  <Minus className="size-5" />
                </Button>
                <span className="w-12 text-center font-display text-2xl font-bold tnum" aria-live="polite">
                  {pax}
                </span>
                <Button variant="secondary" size="lg" aria-label="Add a traveller" disabled={atMax} onClick={() => setPax(pax + 1)}>
                  <Plus className="size-5" />
                </Button>
              </div>
              <p className={`mt-2 text-xs ${atMax ? 'font-medium text-warn' : 'text-ink-2'}`} role={atMax ? 'status' : undefined}>
                {atMax ? `Only ${avail.left} seats left on this date.` : `${avail.left} seats left on this date.`}
              </p>
            </div>
            <TextField
              label="Contact person"
              value={contact.name}
              onChange={(e) => setContact({ ...contact, name: e.target.value })}
              onBlur={() => setErrors((x) => ({ ...x, name: nameError(contact.name) }))}
              error={errors.name}
            />
            <TextField
              label="Contact mobile"
              inputMode="tel"
              value={contact.mobile}
              onChange={(e) => setContact({ ...contact, mobile: e.target.value })}
              onBlur={() => setErrors((x) => ({ ...x, mobile: mobileError(contact.mobile) }))}
              error={errors.mobile}
              hint="Staff use this number about your booking."
            />
            <TextArea label="Notes (optional)" maxLength={300} value={contact.notes} onChange={(e) => setContact({ ...contact, notes: e.target.value })} placeholder="Seat preferences, dietary needs" />
            <Button size="lg" full onClick={toReview}>
              Review booking
            </Button>
          </Card>
        ) : (
          <Card className="page-in divide-y divide-line">
            <ReviewBlock title="Trip" onChange={() => navigate(`/app/tours/${service.id}/dates?d=${dep.id}`)}>
              <p className="font-medium text-ink">{service.name}</p>
              <p>{fmtRange(dep.startDate, dep.endDate)}</p>
              <p>
                Pickup {fmtTime(service.pickupTime)} at {service.pickup}
              </p>
            </ReviewBlock>
            <ReviewBlock title="Travellers and contact" onChange={() => setStep(2)}>
              <p>
                {pax} {pax === 1 ? 'traveller' : 'travellers'}
              </p>
              <p>
                {contact.name} · {contact.mobile}
              </p>
              {contact.notes && <p>Notes: {contact.notes}</p>}
            </ReviewBlock>
            <div className="p-5">
              <p className="rounded-xl bg-info-bg px-3.5 py-2.5 text-sm text-info">
                Your seats are held once you submit. Pay the down payment within 24 hours to keep them. The agency confirms your booking after checking
                your payment.
              </p>
              <Button size="lg" full className="mt-4" onClick={() => setConfirm(true)}>
                Submit booking
              </Button>
            </div>
          </Card>
        )}
        <aside className="lg:sticky lg:top-24 lg:self-start">{summary}</aside>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit this booking?"
        body={`${service.name}, ${fmtDate(dep.startDate, { year: false })}, ${pax} ${pax === 1 ? 'traveller' : 'travellers'}. Total ${peso(total)}.`}
        confirmLabel="Submit booking"
        delay={600}
        onConfirm={() => {
          const r = createBooking({ serviceId: service.id, departureId: dep.id, pax, contactName: contact.name, contactMobile: contact.mobile, notes: contact.notes })
          if (!r.ok) return r.error
          navigate(`/app/booked/${r.value.id}`, { replace: true })
        }}
      />
    </div>
  )
}

export function ReviewBlock({ title, onChange, children }: { title: string; onChange: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 p-5 text-sm text-ink-2">
      <div className="space-y-0.5">
        <p className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">{title}</p>
        {children}
      </div>
      <button onClick={onChange} className="shrink-0 text-sm font-semibold text-brand-700 hover:underline">
        Change
      </button>
    </div>
  )
}

export const bookingTitle = (b: Booking, s: Service) => b.label ?? (b.rental ? `${s.name} · ${b.rental.destination}` : b.agreed?.title ?? s.name)

export function BookingReceived() {
  const { bookingId } = useParams()
  const data = useCustomer((s) => s.data)
  const b = data.bookings.find((x) => x.id === bookingId)
  if (!b) return <EmptyState title="Booking not found" action={<LinkButton to="/app/trips">My trips</LinkButton>} />
  const s = data.services.find((x) => x.id === b.serviceId)!
  const m = money(b, data.payments)
  return (
    <div className="mx-auto max-w-lg">
      <Card className="p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" aria-hidden />
        <h1 className="mt-3 type-head text-[32px] text-charcoal md:text-[40px]">Booking received</h1>
        <p className="mt-1 text-sm text-ink-2">
          Reference <span className="font-semibold text-ink">{b.id}</span>
        </p>
        <div className="mt-4 flex justify-center gap-2">
          <StatusBadge status={b.status} />
          <StatusBadge status={m.summary} />
        </div>
        <div className="mt-6 text-left">
          <Stepper steps={bookingSteps(data, b)} />
        </div>
        <div className="mt-5 text-left">
          <Row label="Trip">{bookingTitle(b, s)}</Row>
          <Row label="Dates">{fmtRange(b.startDate, b.endDate)}</Row>
          <Row label={b.rental ? 'Passengers' : 'Travellers'}>{b.pax}</Row>
          {b.rental && <Row label="Rental days">{rentalDays(b.startDate, b.endDate)}</Row>}
          <Row label="Total" strong>
            {peso(b.total)}
          </Row>
          <Row label="Down payment due now">{peso(m.down)}</Row>
        </div>
        <p className="mt-4 text-sm text-ink-2">Pay within 24 hours to keep your seats. The booking is confirmed after the agency verifies your payment.</p>
        <div className="mt-5 grid gap-2">
          <LinkButton to={`/app/trips/${b.id}/pay`} size="lg" full>
            Pay now
          </LinkButton>
          <LinkButton to={`/app/trips/${b.id}`} variant="secondary" size="lg" full>
            Pay later
          </LinkButton>
        </div>
      </Card>
    </div>
  )
}
