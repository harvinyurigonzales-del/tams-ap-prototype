import { ArrowDown, ArrowUp, CalendarDays, Compass, Info, MapPin, Minus, Plus, Route, Sparkles, Trash2, Users } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { areaOfCity, destinationOptions, joinPickup, landmarkOptions, pickupCityOptions, stopOptions } from '../../domain/places'
import { draftCustomProposal, MAX_GROUP, proposalExpired, requestDestination, stopsByDay, tooManyStops, validateCustom } from '../../domain/requests'
import { money } from '../../domain/rules'
import { addDays, daysBetween, DEMO_NOW, DEMO_TODAY, weekday } from '../../lib/demoClock'
import { fmtDate, fmtRange, fmtStamp, peso } from '../../lib/format'
import { planStops, useCustomer, useMe, type CustomForm, type PlanStop } from '../../state/customerStore'
import { INTERESTS, type CustomRequest, type Dataset, type Destination, type TripPace } from '../../seed/types'
import { SampleTag, StatusBadge } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { Combobox } from '../../ui/Combobox'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { Select, TextArea, TextField } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { SampleFill } from '../../ui/SampleFill'
import { BackLink } from './Explore'
import { AskAboutButton, DecisionActions, LinkedBooking, PriceLines, RequestStatusBadge, requestTimeline, SimulateStaff, WithdrawButton } from './Requests'
import { Timeline } from './Timeline'
import { plannedBudget, plannedDates, PlannedTripView } from './planner/PlannedTripView'

const FLEX: CustomRequest['flexibility'][] = ['Exact dates', '± 3 days', 'Any weekend this month']
const PACES: { value: TripPace; note: string }[] = [
  { value: 'Relaxed', note: 'About 2 stops a day, long breaks' },
  { value: 'Balanced', note: 'About 3 stops a day' },
  { value: 'Packed', note: 'About 4 stops a day, early starts' },
]

const template = (dest: Destination | undefined): PlanStop[] => (dest ? dest.highlights.map((name) => ({ name, on: true })) : [])

function blankForm(d: Dataset, destinationId: string, name = '', mobile = ''): CustomForm {
  const start = addDays(DEMO_TODAY, 21)
  const dest = d.destinations.find((x) => x.id === destinationId)
  return {
    destinationId: dest ? dest.id : '', destinationName: '', startDate: start, endDate: addDays(start, Math.max(0, (dest?.suggestedDays ?? 2) - 1)), flexibility: 'Exact dates',
    groupSize: 4, pickup: '', pickupCity: '', pickupLandmark: '', budgetMin: 3000, budgetMax: 5000, interests: [], requests: '', contactName: name, contactMobile: mobile,
    planMode: 'suggested', plan: template(dest), planFor: dest?.id, pace: 'Balanced',
  }
}

/** Sample answers for the demo helper: a Baguio weekend three weeks out, picked up in Malolos. */
function sampleForm(d: Dataset, name?: string, mobile?: string): CustomForm {
  let start = addDays(DEMO_TODAY, 21)
  while (weekday(start) !== 6) start = addDays(start, 1)
  const dest = d.destinations.find((x) => x.id === 'DST-BAGUIO') ?? d.destinations[0]
  const plan = template(dest)
  if (plan[2]) plan[2] = { ...plan[2], on: false }
  return {
    ...blankForm(d, dest.id, name, mobile),
    startDate: start, endDate: addDays(start, 1), flexibility: '± 3 days', groupSize: 6,
    pickupCity: 'Malolos', pickupLandmark: 'Barasoain Church', pickup: joinPickup('Barasoain Church', 'Malolos'),
    budgetMin: 3500, budgetMax: 6000, interests: ['Food', 'Cool weather'], pace: 'Balanced',
    plan: [...plan, { name: 'Good Shepherd Convent for pasalubong', on: true, own: true }],
    requests: 'Two seniors in the group, so please keep walks short. One vegetarian.',
    contactName: name || 'Maria Santos', contactMobile: mobile || '0917 555 0123',
  }
}

export function CustomRequestForm() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const loc = useLocation()
  const me = useMe()
  const { data, drafts, saveDraft, submitCustom } = useCustomer()
  const blank = () => blankForm(data, params.get('destination') ?? '', me?.name, me?.mobile)
  const [f, setF] = useState<CustomForm>(() => {
    const d = drafts.custom
    if (d) return { ...blank(), ...d, contactName: d.contactName || me?.name || '', contactMobile: d.contactMobile || me?.mobile || '' }
    return blank()
  })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirm, setConfirm] = useState(false)
  const landmarkRef = useRef<HTMLInputElement>(null)
  const dest = data.destinations.find((x) => x.id === f.destinationId)
  const place = requestDestination(data, f)
  const hasPlace = !!dest || (f.destinationName ?? '').trim().length >= 3

  // Keep the draft in memory so it survives going to the login page and back.
  useEffect(() => {
    saveDraft('custom', f)
  }, [f, saveDraft])

  const upd = (patch: Partial<CustomForm>) => setF((x) => ({ ...x, ...patch }))
  const num = (v: string) => (v === '' ? NaN : Number(v))

  // Choosing another destination offers its suggested trip; stops the person added themselves are kept.
  const setDestination = (id: string, typed = '') =>
    setF((x) => {
      const next = data.destinations.find((d) => d.id === id)
      if (x.destinationId === id && x.destinationName === typed) return x
      const own = x.plan.filter((s) => s.own)
      return { ...x, destinationId: next ? next.id : '', destinationName: next ? '' : typed, plan: [...template(next), ...own], planFor: next?.id }
    })
  const onDestText = (text: string) => {
    const match = data.destinations.find((d) => d.name.toLowerCase() === text.trim().toLowerCase())
    setDestination(match?.id ?? '', match ? '' : text)
  }
  const setPickup = (patch: { pickupCity?: string; pickupLandmark?: string }) =>
    setF((x) => {
      const n = { ...x, ...patch }
      return { ...n, pickup: joinPickup(n.pickupLandmark, n.pickupCity) }
    })

  const days = f.startDate && f.endDate >= f.startDate ? daysBetween(f.startDate, f.endDate) + 1 : 0
  const stops = planStops(f)
  const guide =
    hasPlace && days > 0 && f.groupSize > 0 && f.groupSize <= MAX_GROUP ? draftCustomProposal({ ...f, plan: undefined, stops, pickup: f.pickup || 'your pickup point' }, place, DEMO_NOW) : undefined

  const dirty =
    !!f.pickupCity || !!f.pickupLandmark || !!f.requests || f.interests.length > 0 || f.plan.some((s) => s.own) || (f.destinationName ?? '') !== '' || f.groupSize !== 4 ||
    f.destinationId !== blank().destinationId

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

  const cityArea = areaOfCity(f.pickupCity)
  return (
    <div>
      <BackLink label="Back" />
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">Plan a custom trip</h1>
      <p className="mt-1 max-w-2xl text-sm text-ink-2">
        Tell us where you want to go and what you want to see. Staff check feasibility, timing and price, then send a proposal. This is a request, not a booking: nothing is reserved and you pay only if you accept the proposal.
      </p>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <SampleFill dirty={dirty} what="a sample Baguio weekend" onFill={() => (setF(sampleForm(data, me?.name, me?.mobile)), setErrors({}))} onClear={() => (setF(blankForm(data, '', me?.name, me?.mobile)), setErrors({}))} />

          <Card className="space-y-5 p-5">
            <SectionTitle n={1} title="Where and when" />
            <Combobox
              label="Destination"
              icon={<Compass className="size-4" aria-hidden />}
              value={dest ? dest.name : (f.destinationName ?? '')}
              onChange={onDestText}
              onPick={(o) => setDestination(o.value)}
              options={destinationOptions(data)}
              selected={f.destinationId}
              placeholder="Search Baguio, Vigan, La Union…"
              error={errors.destinationId}
              hint={dest ? `${dest.province} · ${dest.travelTime} from Manila` : f.destinationName ? 'Not in our list yet. Staff check whether we can take you there.' : 'Pick one of our places or type another destination in Luzon.'}
              freeTextNote="Not in our list. We'll send it to staff as you typed it."
            />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Start date" type="date" min={addDays(DEMO_TODAY, 7)} value={f.startDate} onChange={(e) => upd({ startDate: e.target.value, endDate: f.endDate < e.target.value ? e.target.value : f.endDate })} error={errors.startDate} />
              <TextField label="End date" type="date" min={f.startDate || addDays(DEMO_TODAY, 7)} max={f.startDate ? addDays(f.startDate, 9) : undefined} value={f.endDate} onChange={(e) => upd({ endDate: e.target.value })} error={errors.endDate} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Select label="How flexible are your dates?" value={f.flexibility} onChange={(e) => upd({ flexibility: e.target.value as CustomForm['flexibility'] })}>
                {FLEX.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </Select>
              <GroupStepper value={f.groupSize} onChange={(groupSize) => upd({ groupSize })} error={errors.groupSize} />
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <SectionTitle n={2} title="Pickup" />
            <div className="grid gap-4 sm:grid-cols-2">
              <Combobox
                label="Pickup city"
                icon={<MapPin className="size-4" aria-hidden />}
                value={f.pickupCity}
                onChange={(pickupCity) => setPickup({ pickupCity })}
                onPick={(o) => {
                  setPickup({ pickupCity: o.value, pickupLandmark: '' })
                  requestAnimationFrame(() => landmarkRef.current?.focus())
                }}
                options={pickupCityOptions()}
                selected={f.pickupCity}
                placeholder="e.g. Quezon City"
                hint={cityArea ? `${cityArea}` : f.pickupCity ? 'Outside our usual pickup areas? Staff will confirm.' : 'Metro Manila, Bulacan, Pampanga, Rizal, Cavite or Laguna'}
              />
              <Combobox
                ref={landmarkRef}
                label="Pickup landmark"
                value={f.pickupLandmark}
                onChange={(pickupLandmark) => setPickup({ pickupLandmark })}
                onPick={(o) => {
                  const [landmark, city] = o.value.split('|')
                  setPickup({ pickupLandmark: landmark, pickupCity: f.pickupCity && areaOfCity(f.pickupCity) ? f.pickupCity : city })
                }}
                options={landmarkOptions(f.pickupCity)}
                placeholder={cityArea ? `Landmark in ${f.pickupCity}` : 'Choose a city first, or type any landmark'}
                error={errors.pickup}
                freeTextNote="We'll use the pickup point you typed."
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setPickup({ pickupLandmark: '' })
                landmarkRef.current?.focus()
              }}
              className="-mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline"
            >
              <Plus className="size-4" aria-hidden /> Enter another pickup point
            </button>
            <p className="flex gap-2 rounded-xl bg-info-bg px-3 py-2.5 text-xs text-info">
              <Info className="mt-px size-4 shrink-0" aria-hidden />
              Suggestions are common meeting points, not a promise of pickup. Staff confirm that the van can reach your pickup point and agree the exact spot and time with you.
            </p>
          </Card>

          <Card className="space-y-5 p-5">
            <SectionTitle n={3} title="Your itinerary" />
            <fieldset>
              <legend className="sr-only">How do you want to plan?</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <ModeOption
                  checked={f.planMode === 'suggested'}
                  onChange={() => upd({ planMode: 'suggested', ...(dest && f.planFor !== dest.id ? { plan: [...template(dest), ...f.plan.filter((s) => s.own)], planFor: dest.id } : {}) })}
                  title="Customize a suggested trip"
                  badge="Recommended"
                  body="Start from our usual stops for this place, then keep, drop, reorder or add your own."
                />
                <ModeOption checked={f.planMode === 'scratch'} onChange={() => upd({ planMode: 'scratch' })} title="Build from scratch" body="List the stops you want, in your order. Staff fill in the timing." />
              </div>
            </fieldset>

            <StopEditor f={f} dest={dest} hasPlace={hasPlace} onChange={(plan) => upd({ plan })} data={data} />

            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Pace</legend>
              <div className="grid gap-2 sm:grid-cols-3">
                {PACES.map((p) => (
                  <label key={p.value} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 text-sm transition-colors ${f.pace === p.value ? 'border-brand-500 bg-brand-50' : 'border-line bg-surface hover:border-brand-300'}`}>
                    <input type="radio" name="pace" checked={f.pace === p.value} onChange={() => upd({ pace: p.value })} className="mt-0.5 accent-brand-600" />
                    <span>
                      <span className="block font-semibold text-ink">{p.value}</span>
                      <span className="text-xs text-ink-2">{p.note}</span>
                    </span>
                  </label>
                ))}
              </div>
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
                      className={`h-9 rounded-full px-3.5 text-sm font-semibold transition-colors ${on ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-ink-2 hover:border-brand-300'}`}
                    >
                      {i}
                    </button>
                  )
                })}
              </div>
            </fieldset>
          </Card>

          <Card className="space-y-5 p-5">
            <SectionTitle n={4} title="Budget and contact" />
            <fieldset>
              <legend className="mb-1.5 text-sm font-medium text-ink">Budget per person</legend>
              <div className="grid grid-cols-2 gap-4">
                <TextField label="Minimum (₱)" type="number" inputMode="numeric" min={0} step={100} value={Number.isNaN(f.budgetMin) ? '' : f.budgetMin} onChange={(e) => upd({ budgetMin: num(e.target.value) })} />
                <TextField label="Maximum (₱)" type="number" inputMode="numeric" min={0} step={100} value={Number.isNaN(f.budgetMax) ? '' : f.budgetMax} onChange={(e) => upd({ budgetMax: num(e.target.value) })} />
              </div>
              {errors.budget && (
                <p className="mt-1.5 text-xs font-medium text-bad" role="alert">
                  {errors.budget}
                </p>
              )}
            </fieldset>
            <TextArea label="Special requests (optional)" maxLength={400} value={f.requests} onChange={(e) => upd({ requests: e.target.value })} placeholder="Seniors or children in the group, dietary needs, anything staff should know" />
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Contact person" autoComplete="name" value={f.contactName} onChange={(e) => upd({ contactName: e.target.value })} error={errors.contactName} />
              <TextField label="Contact mobile" type="tel" autoComplete="tel" inputMode="tel" value={f.contactMobile} onChange={(e) => upd({ contactMobile: e.target.value })} error={errors.contactMobile} hint="Staff use this number about your request." />
            </div>
            <Button size="lg" full onClick={submit}>
              {me ? 'Send request' : 'Log in to send request'}
            </Button>
            <p className="text-center text-xs text-ink-2">{me ? 'Sending does not reserve anything. Staff reply with a proposal you can accept or change.' : 'Your answers stay on this page while you log in.'}</p>
          </Card>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <TripSummary f={f} place={hasPlace ? place : undefined} days={days} stops={stops} perPerson={guide ? Math.ceil(guide.total / f.groupSize) : undefined} />
          <Card className="p-4 text-sm text-ink-2">
            <p className="font-semibold text-ink">What happens next</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li>Staff check feasibility, timing and price.</li>
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
        body={`${place.name}, ${f.startDate && f.endDate ? fmtRange(f.startDate, f.endDate) : ''}, ${f.groupSize} people${stops.length ? `, ${stops.length} stops` : ''}. Staff will review feasibility, timing and price and send a proposal. Nothing is reserved yet.`}
        confirmLabel="Send request"
        onConfirm={() => {
          const r = submitCustom(f)
          if (!r.ok) return r.error
          navigate(`/app/custom/${r.value.id}`, { replace: true })
        }}
      />
    </div>
  )
}

function SectionTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="flex items-center gap-2.5 font-display text-lg font-semibold text-ink">
      <span className="grid size-7 place-items-center rounded-full bg-brand-600 text-sm text-white" aria-hidden>
        {n}
      </span>
      {title}
    </h2>
  )
}

function GroupStepper({ value, onChange, error }: { value: number; onChange: (n: number) => void; error?: string }) {
  const n = Number.isNaN(value) ? 0 : value
  const btn = 'grid size-12 shrink-0 place-items-center rounded-xl border border-line bg-surface text-ink hover:border-brand-300 disabled:cursor-not-allowed disabled:text-ink-3'
  return (
    <div>
      <label htmlFor="group-size" className="mb-1.5 block text-sm font-medium text-ink">
        Group size
      </label>
      <div className="flex gap-2">
        <button type="button" className={btn} onClick={() => onChange(Math.max(1, n - 1))} disabled={n <= 1} aria-label="One less traveler">
          <Minus className="size-4" aria-hidden />
        </button>
        <input
          id="group-size"
          type="number"
          inputMode="numeric"
          min={1}
          max={MAX_GROUP}
          value={Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? 'group-size-err' : 'group-size-hint'}
          className={`h-12 w-full min-w-0 rounded-xl border bg-surface px-3 text-center text-[15px] text-ink focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none ${error ? 'border-bad' : 'border-line'}`}
        />
        <button type="button" className={btn} onClick={() => onChange(Math.min(MAX_GROUP, n + 1))} disabled={n >= MAX_GROUP} aria-label="One more traveler">
          <Plus className="size-4" aria-hidden />
        </button>
      </div>
      {error ? (
        <p id="group-size-err" className="mt-1.5 text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      ) : (
        <p id="group-size-hint" className="mt-1.5 text-xs text-ink-2">
          Up to {MAX_GROUP} online
        </p>
      )}
    </div>
  )
}

function ModeOption({ checked, onChange, title, body, badge }: { checked: boolean; onChange: () => void; title: string; body: string; badge?: string }) {
  return (
    <label className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors ${checked ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'border-line bg-surface hover:border-brand-300'}`}>
      <input type="radio" name="plan-mode" checked={checked} onChange={onChange} className="mt-1 accent-brand-600" />
      <span>
        <span className="flex flex-wrap items-center gap-2 font-semibold text-ink">
          {title}
          {badge && <span className="rounded-full bg-sili px-2 py-0.5 text-[11px] font-bold text-white">{badge}</span>}
        </span>
        <span className="mt-0.5 block text-sm text-ink-2">{body}</span>
      </span>
    </label>
  )
}

/** Stop list with keep/drop checkboxes, up/down reordering (announced), removal, and an "add your own stop" search. */
function StopEditor({ f, dest, hasPlace, onChange, data }: { f: CustomForm; dest?: Destination; hasPlace: boolean; onChange: (plan: PlanStop[]) => void; data: Dataset }) {
  const [text, setText] = useState('')
  const [said, setSaid] = useState('')
  const suggested = f.planMode === 'suggested'
  // In scratch mode only the person's own stops show; switching back restores the suggested ones.
  const rows = f.plan.map((s, i) => ({ s, i })).filter(({ s }) => suggested || s.own)

  const move = (pos: number, dir: -1 | 1) => {
    const a = rows[pos]
    const b = rows[pos + dir]
    if (!a || !b) return
    const plan = f.plan.slice()
    ;[plan[a.i], plan[b.i]] = [plan[b.i], plan[a.i]]
    onChange(plan)
    setSaid(`${a.s.name} moved to position ${pos + dir + 1} of ${rows.length}.`)
    requestAnimationFrame(() => document.getElementById(`stop-${dir === -1 ? 'up' : 'down'}-${pos + dir}`)?.focus())
  }
  const add = (name: string) => {
    const n = name.trim()
    if (!n) return
    if (f.plan.some((s) => s.name.toLowerCase() === n.toLowerCase() && (s.own || suggested))) {
      setSaid(`${n} is already in your plan.`)
      onChange(f.plan.map((s) => (s.name.toLowerCase() === n.toLowerCase() ? { ...s, on: true } : s)))
    } else {
      onChange([...f.plan, { name: n, on: true, own: true }])
      setSaid(`${n} added as stop ${rows.length + 1}.`)
    }
    setText('')
  }
  const onAdd = (e: FormEvent) => {
    e.preventDefault()
    add(text)
  }

  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-medium text-ink">{suggested ? 'Suggested stops' : 'Your stops'}</h3>
        {suggested && dest && f.plan.some((s) => !s.own && !s.on) && (
          <button type="button" className="text-xs font-semibold text-brand-700 hover:underline" onClick={() => onChange([...template(dest), ...f.plan.filter((s) => s.own)])}>
            Reset suggested stops
          </button>
        )}
      </div>
      {suggested && !dest && (
        <p className="mt-2 rounded-xl bg-surface-muted px-3 py-2.5 text-sm text-ink-2">
          {hasPlace ? 'We have no suggested trip for this place yet. Add the stops you have in mind, or build from scratch.' : 'Choose a destination to see its suggested stops.'}
        </p>
      )}
      {rows.length > 0 && (
        <ol className="mt-2 space-y-2">
          {rows.map(({ s, i }, pos) => (
            <li key={`${s.name}-${i}`} className={`fade-in flex items-center gap-2 rounded-xl border px-3 py-2 transition-colors ${s.on ? 'border-line bg-surface' : 'border-dashed border-line bg-surface-muted/60'}`}>
              <span className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${s.on ? 'bg-brand-100 text-brand-800' : 'bg-surface-muted text-ink-3'}`} aria-hidden>
                {pos + 1}
              </span>
              <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 text-sm">
                <input type="checkbox" checked={s.on} onChange={() => onChange(f.plan.map((x, j) => (j === i ? { ...x, on: !x.on } : x)))} className="size-4 shrink-0 accent-brand-600" />
                <span className="flex min-w-0 flex-col items-start gap-0.5 sm:flex-row sm:items-center sm:gap-2">
                  <span className={s.on ? 'text-ink' : 'text-ink-3 line-through'}>{s.name}</span>
                  {s.own && <span className="shrink-0 rounded-full bg-sili-50 px-2 py-0.5 text-[11px] font-semibold text-sili-600">Your stop</span>}
                </span>
              </label>
              <div className="flex shrink-0 items-center">
                <IconBtn id={`stop-up-${pos}`} label={`Move ${s.name} up`} disabled={pos === 0} onClick={() => move(pos, -1)}>
                  <ArrowUp className="size-4" aria-hidden />
                </IconBtn>
                <IconBtn id={`stop-down-${pos}`} label={`Move ${s.name} down`} disabled={pos === rows.length - 1} onClick={() => move(pos, 1)}>
                  <ArrowDown className="size-4" aria-hidden />
                </IconBtn>
                <IconBtn
                  label={`Remove ${s.name}`}
                  onClick={() => {
                    onChange(f.plan.filter((_, j) => j !== i))
                    setSaid(`${s.name} removed.`)
                  }}
                  danger
                >
                  <Trash2 className="size-4" aria-hidden />
                </IconBtn>
              </div>
            </li>
          ))}
        </ol>
      )}
      {!suggested && rows.length === 0 && <p className="mt-2 rounded-xl bg-surface-muted px-3 py-2.5 text-sm text-ink-2">No stops yet. Add the places you want to see, or leave it to staff.</p>}
      <form onSubmit={onAdd} className="mt-3 flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <Combobox
            label="Add your own stop"
            value={text}
            onChange={setText}
            onPick={(o) => add(o.label)}
            options={stopOptions(data, dest)}
            placeholder="Search attractions or type a place"
            freeTextNote="Press Add to use what you typed."
          />
        </div>
        <Button type="submit" variant="secondary" className="h-12" icon={<Plus className="size-4" aria-hidden />} disabled={!text.trim()}>
          Add
        </Button>
      </form>
      <p className="sr-only" aria-live="polite">
        {said}
      </p>
    </div>
  )
}

function IconBtn({ label, onClick, disabled, danger, id, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; id?: string; children: React.ReactNode }) {
  return (
    <button
      id={id}
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-9 place-items-center rounded-lg text-ink-2 transition-colors hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-35 ${danger ? 'hover:text-bad' : 'hover:text-ink'}`}
    >
      {children}
    </button>
  )
}

/** Live summary of the request, laid out by day at the chosen pace. */
function TripSummary({ f, place, days, stops, perPerson }: { f: CustomForm; place?: Destination; days: number; stops: string[]; perPerson?: number }) {
  const byDay = days > 0 ? stopsByDay(stops, days, f.pace) : []
  const crowded = days > 0 && tooManyStops(stops.length, days, f.pace)
  return (
    <Card className="overflow-hidden">
      {place ? <Picture image={place.image} className="h-32" sizes="360px" /> : <div className="grid h-20 place-items-center bg-surface-muted text-ink-3"><Route className="size-6" aria-hidden /></div>}
      <div className="space-y-3 p-4 text-sm text-ink-2" aria-live="polite">
        <div>
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Your request</p>
          <p className="font-display text-lg font-semibold text-ink">{place ? place.name : 'Choose a destination'}</p>
          {place && <p>{place.id ? `${place.travelTime} from Manila` : 'Not in our list yet · staff confirm we can serve it'}</p>}
        </div>
        <ul className="space-y-1">
          <li className="flex items-center gap-2">
            <CalendarDays className="size-4 shrink-0" aria-hidden />
            {days > 0 ? `${fmtRange(f.startDate, f.endDate)} · ${days === 1 ? 'day trip' : `${days} days`}` : 'Dates to choose'}
          </li>
          <li className="flex items-center gap-2">
            <Users className="size-4 shrink-0" aria-hidden />
            {Number.isNaN(f.groupSize) ? 'Group size to enter' : `${f.groupSize} ${f.groupSize === 1 ? 'traveler' : 'travelers'}`} · {f.pace.toLowerCase()} pace
          </li>
          <li className="flex items-center gap-2">
            <MapPin className="size-4 shrink-0" aria-hidden />
            {f.pickup ? `Pickup: ${f.pickup}` : 'Pickup to choose'}
          </li>
        </ul>
        {byDay.length > 0 && stops.length > 0 && (
          <ol className="space-y-2 border-t border-line pt-3">
            {byDay.map((d, i) => (
              <li key={i}>
                <p className="text-xs font-semibold text-ink">Day {i + 1}</p>
                <p>{d.length ? d.join(' → ') : 'Free time or travel'}</p>
              </li>
            ))}
          </ol>
        )}
        {stops.length === 0 && <p className="border-t border-line pt-3">{f.planMode === 'scratch' ? 'No stops yet: staff will suggest some.' : 'No stops chosen yet.'}</p>}
        {crowded && <p className="rounded-lg bg-warn-bg px-3 py-2 text-xs text-warn">That is a lot for {days === 1 ? 'one day' : `${days} days`} at a {f.pace.toLowerCase()} pace. Staff may suggest dropping or moving some stops.</p>}
        {perPerson !== undefined && (
          <p className="rounded-xl bg-surface-muted px-3 py-2">
            Rough guide: about <strong className="text-ink">{peso(perPerson)} per person</strong> for a private trip like this at our sample rates. Staff confirm the real price in your proposal. <SampleTag>Estimate</SampleTag>
          </p>
        )}
        <p className="flex gap-2 text-xs">
          <Sparkles className="size-4 shrink-0 text-sili" aria-hidden />
          A request, not a booking. Nothing is reserved until you accept a proposal.
        </p>
      </div>
    </Card>
  )
}

export function CustomRequestDetails() {
  const { requestId } = useParams()
  const navigate = useNavigate()
  const { data, customerId, acceptProposal } = useCustomer()
  const r = data.customRequests.find((x) => x.id === requestId && x.customerId === customerId)
  if (!r) return <EmptyState title="Request not found" action={<LinkButton to="/app/trips?tab=custom">My Trips</LinkButton>} />
  const dest = requestDestination(data, r)
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
                <CalendarDays className="size-4" aria-hidden /> {plannedDates(r.plan) ?? `${fmtRange(r.startDate, r.endDate)} · ${r.flexibility}`}
              </p>
              <p className="flex items-center gap-2">
                <Users className="size-4" aria-hidden /> {r.groupSize} people · budget {r.plan ? plannedBudget(r.plan) : `${peso(r.budgetMin)}–${peso(r.budgetMax)} per person`}
              </p>
              <p className="flex items-center gap-2">
                <MapPin className="size-4" aria-hidden /> Pickup: {r.pickup}
              </p>
              {r.interests.length > 0 && <p>Interests: {r.interests.join(', ')}</p>}
              {!r.plan && r.stops && r.stops.length > 0 && (
                <p>
                  Stops ({r.planMode === 'scratch' ? 'built from scratch' : 'from the suggested trip'}, {(r.pace ?? 'Balanced').toLowerCase()} pace): {r.stops.join(' → ')}
                </p>
              )}
              {!r.destinationId && <p>Staff are checking whether we can serve this destination.</p>}
              {r.requests && <p>Requests: {r.requests}</p>}
              <p>
                Contact {r.contactName}, {r.contactMobile} · sent {fmtStamp(r.createdAt)}
              </p>
            </div>
          </Card>

          {r.plan && (
            <Card className="p-5">
              <h2 className="type-head text-[22px] text-charcoal">Your planned trip</h2>
              <p className="mt-1 mb-4 text-sm text-ink-2">The plan you sent. Staff use it as the starting point for your proposal.</p>
              <PlannedTripView plan={r.plan} />
            </Card>
          )}

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
