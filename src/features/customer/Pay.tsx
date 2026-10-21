import { CheckCircle2, FileImage, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { money, payableOptions } from '../../domain/rules'
import { fmtDate, peso } from '../../lib/format'
import { useCustomer } from '../../state/customerStore'
import type { Payment, PaymentMethod, PaymentType } from '../../seed/types'
import { SampleTag, StatusBadge } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { TextField } from '../../ui/Field'
import { EmptyState } from '../../ui/EmptyState'
import { bookingTitle } from './Book'
import { BackLink } from './Explore'
import { Steps } from './Steps'

/** Fictional payee details. Nothing is ever charged; there is no payment gateway. */
const PAYEE: Record<Exclude<PaymentMethod, 'Cash'>, { label: string; lines: string[] }> = {
  GCash: { label: 'GCash', lines: ['Account name: TAMS AP Travel (demo)', 'Number: 0900 555 0300'] },
  Maya: { label: 'Maya', lines: ['Account name: TAMS AP Travel (demo)', 'Number: 0900 555 0301'] },
  'Bank transfer': { label: 'Bank transfer', lines: ['Bank: Sample Bank (fictional)', 'Account name: TAMS AP Travel (demo)', 'Account no.: 0000-1234-5678'] },
}
const METHODS = Object.keys(PAYEE) as Exclude<PaymentMethod, 'Cash'>[]
const MAX_BYTES = 5 * 1024 * 1024
const TYPES = ['image/png', 'image/jpeg', 'image/webp', 'application/pdf']

export const referenceError = (v: string) =>
  !v.trim() ? 'Enter the reference number from your receipt.' : /^[A-Za-z0-9 -]{6,24}$/.test(v.trim()) ? '' : 'Use 6–24 letters, numbers, spaces or dashes.'

export function Pay() {
  const { bookingId } = useParams()
  const { data, customerId, submitPayment } = useCustomer()
  const b = data.bookings.find((x) => x.id === bookingId && x.customerId === customerId)
  const options = b ? payableOptions(b, data.payments) : []
  const [method, setMethod] = useState<Exclude<PaymentMethod, 'Cash'>>('GCash')
  const [type, setType] = useState<PaymentType | null>(null)
  const [reference, setReference] = useState('')
  const [proof, setProof] = useState<{ kind: 'sample' | 'uploaded'; name: string; url?: string } | null>(null)
  const [errors, setErrors] = useState({ reference: '', proof: '' })
  const [confirm, setConfirm] = useState(false)
  const [done, setDone] = useState<Payment | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => () => {
    if (proof?.url) URL.revokeObjectURL(proof.url)
  }, [proof])

  if (done && b) return <PaymentSubmitted payment={done} bookingId={b.id} />
  if (!b) return <EmptyState title="Booking not found" action={<LinkButton to="/app/trips">My trips</LinkButton>} />
  if (options.length === 0)
    return (
      <EmptyState
        title="No payment due right now"
        body="Either a payment is awaiting verification or this booking is fully paid."
        action={<LinkButton to={`/app/trips/${b.id}`}>Back to trip</LinkButton>}
      />
    )

  const s = data.services.find((x) => x.id === b.serviceId)!
  const chosen = options.find((o) => o.type === type) ?? options[0]
  const m = money(b, data.payments)

  const onFile = (f?: File) => {
    if (!f) return
    if (!TYPES.includes(f.type)) return setErrors((e) => ({ ...e, proof: 'Upload a PNG, JPG, WEBP or PDF file.' }))
    if (f.size > MAX_BYTES) return setErrors((e) => ({ ...e, proof: 'The file is larger than 5 MB. Upload a smaller screenshot.' }))
    setErrors((e) => ({ ...e, proof: '' }))
    setProof({ kind: 'uploaded', name: f.name, url: f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined })
  }

  const review = () => {
    const errs = { reference: referenceError(reference), proof: proof ? '' : 'Add a receipt image or use the sample receipt.' }
    setErrors(errs)
    if (!errs.reference && !errs.proof) setConfirm(true)
  }

  return (
    <div>
      <BackLink to={`/app/trips/${b.id}`} label="Trip details" />
      <Steps current={4} />
      <h1 className="font-display text-2xl font-bold text-brand-900">Payment</h1>
      {m.lastRejected && (
        <p className="mt-3 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
          Your last payment was not accepted: {m.lastRejected.rejectReason} Please send new proof.
        </p>
      )}
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-6 p-5">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Payment method</legend>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((k) => (
                <label key={k} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold ${method === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-ink-2 hover:border-brand-300'}`}>
                  <input type="radio" name="method" value={k} checked={method === k} onChange={() => setMethod(k)} className="sr-only" />
                  {PAYEE[k].label}
                </label>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-surface-muted px-4 py-3 text-sm">
              <p className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">
                Send to <SampleTag>Demo only</SampleTag>
              </p>
              {PAYEE[method].lines.map((l) => (
                <p key={l} className="text-ink">
                  {l}
                </p>
              ))}
              <p className="mt-1 text-xs text-ink-2">Do not send real money. Cash payments are recorded by staff at the office.</p>
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Amount</legend>
            <div className="space-y-2">
              {options.map((o) => (
                <label key={o.type} className={`flex cursor-pointer items-center justify-between rounded-xl border px-4 py-3 ${chosen.type === o.type ? 'border-brand-600 bg-brand-50' : 'border-line hover:border-brand-300'}`}>
                  <span className="flex items-center gap-3">
                    <input type="radio" name="amount" checked={chosen.type === o.type} onChange={() => setType(o.type)} className="size-4 accent-brand-600" />
                    <span className="text-sm font-medium text-ink">{o.type === 'Full' ? 'Full amount' : o.type}</span>
                  </span>
                  <span className="font-semibold text-ink tnum">{peso(o.amount)}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <TextField
            label="Reference number"
            placeholder="e.g. 1009 8822 5531"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            onBlur={() => reference && setErrors((x) => ({ ...x, reference: referenceError(reference) }))}
            error={errors.reference}
          />

          <div>
            <p className="mb-2 text-sm font-medium text-ink">Proof of payment</p>
            {proof ? (
              <div className="flex items-center gap-3 rounded-xl border border-line p-3">
                {proof.kind === 'sample' ? (
                  <img src="/sample-receipt.svg" alt="Sample receipt" className="h-16 w-12 rounded border border-line object-cover" />
                ) : proof.url ? (
                  <img src={proof.url} alt="Your receipt preview" className="h-16 w-12 rounded border border-line object-cover" />
                ) : (
                  <FileImage className="size-10 text-ink-3" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{proof.name}</p>
                  <p className="text-xs text-ink-2">{proof.kind === 'sample' ? 'Fictional receipt for the demo' : 'Preview only. The file stays on this device.'}</p>
                </div>
                <button onClick={() => setProof(null)} aria-label="Remove proof" className="rounded p-1 text-ink-3 hover:text-ink">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" size="lg" icon={<Upload className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>
                  Upload receipt
                </Button>
                <Button variant="secondary" size="lg" onClick={() => { setProof({ kind: 'sample', name: 'sample-receipt.svg' }); setErrors((e) => ({ ...e, proof: '' })) }}>
                  Use sample receipt
                </Button>
                <input ref={fileRef} type="file" accept={TYPES.join(',')} className="hidden" onChange={(e) => onFile(e.target.files?.[0])} aria-label="Receipt file" />
              </div>
            )}
            {errors.proof ? (
              <p role="alert" className="mt-1.5 text-xs font-medium text-bad">
                {errors.proof}
              </p>
            ) : (
              <p className="mt-1.5 text-xs text-ink-2">PNG, JPG, WEBP or PDF up to 5 MB. Nothing is uploaded anywhere.</p>
            )}
          </div>

          <Button size="lg" full onClick={review}>
            Submit payment
          </Button>
        </Card>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <p className="font-display text-base font-semibold text-ink">{bookingTitle(b, s)}</p>
            <p className="text-sm text-ink-2">{b.id}</p>
            <div className="mt-3">
              <Row label="Total">{peso(b.total)}</Row>
              <Row label="Paid (verified)">{peso(m.paid)}</Row>
              <Row label="Paying now" strong>
                {peso(chosen.amount)}
              </Row>
            </div>
            <p className="mt-3 text-xs text-ink-2">Balance due {fmtDate(m.dueDate, { weekday: true })}.</p>
          </Card>
        </aside>
      </div>
      <ConfirmDialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Submit this payment?"
        body={`${chosen.type} of ${peso(chosen.amount)} via ${method}, reference ${reference.trim()}. The agency will verify it before confirming your booking.`}
        confirmLabel="Submit payment"
        delay={600}
        onConfirm={() => {
          const r = submitPayment({ bookingId: b.id, method, type: chosen.type, reference, proof: proof!.kind })
          if (!r.ok) return r.error
          setDone(r.value)
        }}
      />
    </div>
  )
}

function PaymentSubmitted({ payment, bookingId }: { payment: Payment; bookingId: string }) {
  return (
    <div className="mx-auto max-w-lg">
      <Card className="p-6 text-center">
        <CheckCircle2 className="mx-auto size-14 text-ok" aria-hidden />
        <h1 className="mt-3 font-display text-2xl font-bold text-brand-900">Payment submitted</h1>
        <p className="mt-1 text-sm text-ink-2">Awaiting verification by the agency.</p>
        <div className="mt-4 flex justify-center">
          <StatusBadge status={payment.status} customer />
        </div>
        <div className="mt-5 text-left">
          <Row label="Payment">{payment.id}</Row>
          <Row label="Amount">{peso(payment.amount)}</Row>
          <Row label="Method">{payment.method}</Row>
          <Row label="Reference">{payment.reference}</Row>
        </div>
        <LinkButton to={`/app/trips/${bookingId}`} size="lg" full className="mt-5">
          Back to trip
        </LinkButton>
      </Card>
    </div>
  )
}
