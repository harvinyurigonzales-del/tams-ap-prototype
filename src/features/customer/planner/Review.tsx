import { ArrowLeft, Info, Lock, LogIn, Send } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { placeFor } from '../../../domain/planner/data'
import { checkPlan, estimate, QUESTIONS, schedule } from '../../../domain/planner/engine'
import { requestDestination } from '../../../domain/requests'
import { fmtDate, peso } from '../../../lib/format'
import { useCustomer, useMe } from '../../../state/customerStore'
import { usePlanner } from '../../../state/planner'
import { useUi } from '../../../state/ui'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { TextField } from '../../../ui/Field'
import { PlannerLabel } from './bits'
import { answerText } from './Questions'
import { CostLines } from './Result'

const FLOW = ['Request', 'Staff review', 'Proposal', 'You accept', 'Booking and payment']

export function Review() {
  const navigate = useNavigate()
  const loc = useLocation()
  const me = useMe()
  const data = useCustomer((s) => s.data)
  const submit = useCustomer((s) => s.submitPlannedTrip)
  const toast = useUi((s) => s.toast)
  const { plan, answers: a, go, kept, clear } = usePlanner()
  const [name, setName] = useState(me?.name ?? '')
  const [mobile, setMobile] = useState(me?.mobile ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const view = useMemo(() => (plan ? { sched: schedule(plan, a), est: estimate(plan, a), issues: checkPlan(plan, a) } : null), [plan, a])
  if (!plan || !view)
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="font-semibold text-ink">There’s no plan to review yet.</p>
        <Button className="mt-4" onClick={() => go('intro')}>Start planning</Button>
      </Card>
    )
  const dest = requestDestination(data, { destinationId: plan.destinationId, destinationName: plan.destinationName })
  const known = !!placeFor(plan.destinationId)
  const stops = plan.days.flatMap((d, i) => d.map((s) => ({ s, day: i + 1 })))
  const edit = (q: number) => usePlanner.setState({ editing: true, step: 'questions', q })

  const send = () => {
    if (!me) {
      navigate(`/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}`)
      return
    }
    setBusy(true)
    const r = submit({ answers: a, plan, contactName: name || me.name, contactMobile: mobile || me.mobile })
    setBusy(false)
    if (!r.ok) return setError(r.error)
    clear()
    toast('Trip request sent. TAMS-AP will review your plan and prepare a proposal.')
    navigate(`/app/custom/${r.value.id}`, { replace: true })
  }

  return (
    <div className="mx-auto max-w-4xl pb-10">
      <button type="button" onClick={() => go('result')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> Back to your plan
      </button>
      <div className="mt-3">
        <PlannerLabel />
      </div>
      <h1 className="type-head mt-3 text-[32px] text-charcoal md:text-[40px]">Review your trip request</h1>
      <p className="mt-1 text-[15px] text-ink-2">Check everything before you send it. You can still change any part.</p>

      <ol className="mt-5 flex flex-wrap gap-x-1 gap-y-2 text-xs font-semibold" aria-label="What happens next">
        {FLOW.map((f, i) => (
          <li key={f} className="flex items-center gap-1">
            <span className={`rounded-full px-2.5 py-1 ${i === 0 ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-2'}`}>{f}</span>
            {i < FLOW.length - 1 && <span className="text-ink-3" aria-hidden>›</span>}
          </li>
        ))}
      </ol>

      <div className="mt-6 grid gap-5 md:grid-cols-[1fr_320px]">
        <div className="min-w-0 space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold text-charcoal">{dest.name}</h2>
            <dl className="mt-2 divide-y divide-line text-sm">
              {QUESTIONS.map((x, i) => (
                <div key={x} className="flex items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-3 capitalize">{x === 'prefs' ? 'Notes and preferences' : x}</dt>
                    <dd className="text-ink">{answerText(x, a, data.destinations)}</dd>
                  </div>
                  <button type="button" onClick={() => edit(i)} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline" aria-label={`Edit ${x === 'prefs' ? 'notes' : x}`}>
                    Edit
                  </button>
                </div>
              ))}
            </dl>
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold text-charcoal">Itinerary</h2>
              <button type="button" onClick={() => go('result')} className="text-sm font-semibold text-brand-700 hover:underline">Edit stops</button>
            </div>
            {!known && <p className="mt-2 text-sm text-ink-2">Staff will plan the route and timing for {dest.name} with you.</p>}
            <ol className="mt-3 space-y-3">
              {view.sched.map((d) => (
                <li key={d.day}>
                  <p className="text-sm font-semibold text-ink">
                    Day {d.day} <span className="font-normal text-ink-2">· {d.date ? fmtDate(d.date, { weekday: true, year: false }) : d.label}</span>
                  </p>
                  <ul className="mt-1 space-y-1">
                    {stops.filter((x) => x.day === d.day).map(({ s }) => (
                      <li key={s.key} className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
                        <span className="text-ink">{s.name}</span>
                        {s.locked && <Badge tone="brand"><Lock className="size-3" aria-hidden /> Kept</Badge>}
                        {s.custom && <Badge tone="warn">For staff review</Badge>}
                      </li>
                    ))}
                    {stops.every((x) => x.day !== d.day) && <li className="text-sm text-ink-3">Free day, or for staff to plan</li>}
                  </ul>
                </li>
              ))}
            </ol>
          </Card>

          {view.issues.length > 0 && (
            <Card className="border-[#f0d7a8] bg-warn-bg p-5">
              <h2 className="font-semibold text-warn">Still open</h2>
              <p className="mt-1 text-sm text-ink-2">These go to staff with your request. {view.issues.some((i) => !kept.includes(i.id)) && 'You can also go back and adjust the plan.'}</p>
              <ul className="mt-2 list-disc space-y-0.5 pl-5 text-sm text-ink">
                {view.issues.map((i) => <li key={i.id}>{i.title}</li>)}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          <Card className="p-5">
            <h2 className="font-display text-base font-bold text-charcoal">Estimated cost</h2>
            <p className="text-xs text-ink-2">Estimated cost · final quotation from TAMS-AP</p>
            <p className="tnum mt-3 font-display text-2xl font-bold text-charcoal">{peso(view.est.perPerson)} <span className="text-sm font-medium text-ink-2">per person</span></p>
            <p className="tnum text-sm text-ink-2">{peso(view.est.total)} for {a.group.size}</p>
            <CostLines lines={view.est.lines} />
          </Card>

          <Card className="space-y-3 p-5">
            <h2 className="font-display text-base font-bold text-charcoal">Contact</h2>
            {me ? (
              <>
                <TextField label="Contact name" value={name} onChange={(e) => (setName(e.target.value), setError(''))} autoComplete="name" />
                <TextField label="Contact mobile" type="tel" inputMode="tel" value={mobile} onChange={(e) => (setMobile(e.target.value), setError(''))} autoComplete="tel" />
              </>
            ) : (
              <p className="text-sm text-ink-2">Log in to send your request. Your plan stays exactly as it is and you’ll come back to this page.</p>
            )}
            {error && <p className="text-sm font-medium text-bad" role="alert">{error}</p>}
            <Button full size="lg" loading={busy} onClick={send} icon={me ? <Send className="size-5" aria-hidden /> : <LogIn className="size-5" aria-hidden />}>
              {me ? 'Send trip request' : 'Log in to send'}
            </Button>
          </Card>

          <p className="flex gap-2 rounded-2xl bg-info-bg px-4 py-3 text-[13px] text-info">
            <Info className="mt-px size-4 shrink-0" aria-hidden />
            <span>Sending this is a request, not a booking. Nothing is reserved and nothing is charged. Staff review your plan and send a proposal; you book and pay only if you accept it.</span>
          </p>
        </aside>
      </div>
    </div>
  )
}
