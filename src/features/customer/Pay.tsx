import { CheckCircle2, Eye, FileImage, Upload, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { money, payableOptions } from '../../domain/rules'
import { fmtDate, peso } from '../../lib/format'
import { DEMO_NOW } from '../../lib/demoClock'
import { demoReceiptSrc, sampleReference } from '../../lib/receipt'
import { useCustomer, useMe } from '../../state/customerStore'
import type { Payment, PaymentMethod, PaymentType } from '../../seed/types'
import { StatusBadge } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog, Dialog } from '../../ui/Dialog'
import { SampleFill } from '../../ui/SampleFill'
import { TextField } from '../../ui/Field'
import { EmptyState } from '../../ui/EmptyState'
import { bookingTitle } from './Book'
import { BackLink } from './Explore'
import { Steps } from './Steps'

/** Fictional payee details. Nothing is ever charged; there is no payment gateway. */
const PAYEE: Record<Exclude<PaymentMethod, 'Cash'>, { label: string; lines: string[] }> = {
  GCash: { label: 'GCash', lines: ['Account name: TAMS AP Travel', 'Number: 0900 555 0300'] },
  Maya: { label: 'Maya', lines: ['Account name: TAMS AP Travel', 'Number: 0900 555 0301'] },
  'Bank transfer': { label: 'Bank transfer', lines: ['Account name: TAMS AP Travel', 'Account no.: 0000-1234-5678'] },
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
  // The last reference the demo helper generated, so switching method can swap it for one in the right shape.
  const [sampleRef, setSampleRef] = useState('')
  const [viewReceipt, setViewReceipt] = useState(false)
  const me = useMe()
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

  // Demo helper: a reference in the chosen method's format plus a fictional receipt drawn from the same details.
  // It never submits on its own; the customer still reviews and confirms.
  const fillSample = (keepReference = false) => {
    const ref = keepReference && reference.trim() ? reference : sampleReference(method)
    setReference(ref)
    setSampleRef(ref)
    setProof({ kind: 'sample', name: 'demo-receipt.svg' })
    setErrors({ reference: '', proof: '' })
  }
  const changeMethod = (k: Exclude<PaymentMethod, 'Cash'>) => {
    setMethod(k)
    if (sampleRef && reference === sampleRef) {
      const ref = sampleReference(k)
      setReference(ref)
      setSampleRef(ref)
    }
  }
  const receipt = demoReceiptSrc({ method, amount: chosen.amount, reference: reference.trim() || '(enter reference)', at: DEMO_NOW, note: chosen.type === 'Full' ? 'Full payment' : chosen.type, from: me?.mobile })

  return (
    <div>
      <BackLink to={`/app/trips/${b.id}`} label="Trip details" />
      <Steps current={4} />
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">Payment</h1>
      {m.lastRejected && (
        <p className="mt-3 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
          Your last payment was not accepted: {m.lastRejected.rejectReason} Please send new proof.
        </p>
      )}
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="space-y-6 p-5">
          <SampleFill
            dirty={!!reference || !!proof}
            label="Use sample payment details"
            what={`a sample ${method} reference and a matching sample receipt`}
            onFill={() => fillSample()}
            onClear={() => (setReference(''), setSampleRef(''), setProof(null), setErrors({ reference: '', proof: '' }))}
          />

          <fieldset>
            <legend className="mb-2 text-sm font-medium text-ink">Payment method</legend>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map((k) => (
                <label key={k} className={`cursor-pointer rounded-xl border px-3 py-3 text-center text-sm font-semibold ${method === k ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line text-ink-2 hover:border-brand-300'}`}>
                  <input type="radio" name="method" value={k} checked={method === k} onChange={() => changeMethod(k)} className="sr-only" />
                  {PAYEE[k].label}
                </label>
              ))}
            </div>
            <div className="mt-3 rounded-xl bg-surface-muted px-4 py-3 text-sm">
              <p className="mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">
                Send to
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
                  <button type="button" onClick={() => setViewReceipt(true)} className="shrink-0 rounded focus-visible:outline-2" aria-label="View sample receipt">
                    <img src={receipt} alt="" className="h-16 w-12 rounded border border-line object-cover object-top" />
                  </button>
                ) : proof.url ? (
                  <img src={proof.url} alt="Your receipt preview" className="h-16 w-12 rounded border border-line object-cover" />
                ) : (
                  <FileImage className="size-10 text-ink-3" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">{proof.name}</p>
                  <p className="text-xs text-ink-2">{proof.kind === 'sample' ? 'Sample receipt with your method, amount and reference.' : 'Preview only. The file stays on this device.'}</p>
                </div>
                {proof.kind === 'sample' && (
                  <Button size="sm" variant="ghost" icon={<Eye className="size-4" aria-hidden />} onClick={() => setViewReceipt(true)}>
                    View
                  </Button>
                )}
                <button onClick={() => setProof(null)} aria-label="Remove proof" className="rounded p-1 text-ink-3 hover:text-ink">
                  <X className="size-4" />
                </button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="secondary" size="lg" icon={<Upload className="size-4" aria-hidden />} onClick={() => fileRef.current?.click()}>
                  Upload receipt
                </Button>
                <Button variant="secondary" size="lg" onClick={() => fillSample(true)}>
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
      <Dialog open={viewReceipt} onClose={() => setViewReceipt(false)} title="Sample receipt">
        <img src={receipt} alt={`Fictional ${method} receipt for ${peso(chosen.amount)}, reference ${reference.trim()}`} className="mx-auto max-h-[60vh] rounded-lg border border-line" />
        <p className="mt-3 text-center text-xs text-ink-3">Made from the details on this form.</p>
      </Dialog>
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
        <h1 className="mt-3 type-head text-[32px] text-charcoal md:text-[40px]">Payment submitted</h1>
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
