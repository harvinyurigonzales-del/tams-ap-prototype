import {
  ArrowLeft, ArrowRight, Bike, Briefcase, Camera, Compass, Heart, Info, Landmark, MapPin, Mountain, Plus, Sofa, Sparkles, Trees, User, Users, UtensilsCrossed, Waves,
} from 'lucide-react'
import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { PLANNER_INTERESTS, type PlannerInterest } from '../../../domain/planner/data'
import {
  dateWindows, earliestStart, GROUP_TYPES, LODGING, MAX_DAYS, QUESTIONS, tripDays, validateQuestion, type GroupType, type PlannerAnswers, type QuestionId,
} from '../../../domain/planner/engine'
import { areaOfCity, destinationOptions, landmarkOptions, pickupCityOptions } from '../../../domain/places'
import { MAX_GROUP } from '../../../domain/requests'
import { addDays, daysBetween } from '../../../lib/demoClock'
import { fmtDate, fmtRange, peso } from '../../../lib/format'
import type { TripPace } from '../../../seed/types'
import { useCustomer } from '../../../state/customerStore'
import { useLauncherRaise } from '../../../state/assistant'
import { usePlanner } from '../../../state/planner'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { Combobox } from '../../../ui/Combobox'
import { Dialog } from '../../../ui/Dialog'
import { Select, TextArea, TextField } from '../../../ui/Field'
import { budgetText, ChoiceCard, datesText, PlannerLabel, groupText, Stepper } from './bits'
import { formLink } from './Planner'

const TITLES: Record<QuestionId, { title: string; help: string; optional?: boolean }> = {
  destination: { title: 'May destination ka na?', help: 'Pick a place, type one, or let us suggest somewhere that fits.' },
  interests: { title: 'Anong klaseng getaway?', help: 'Choose as many as you like. We use these to pick the stops.' },
  group: { title: 'Sino ang kasama?', help: 'This sets the van, the rooms and how easy the stops should be.' },
  dates: { title: 'Kailan ang alis?', help: 'Exact dates, a rough window, or just how long. Dates are in Philippine time.' },
  budget: { title: 'Magkano ang comfortable budget?', help: 'Say whether it’s per person or for the whole group, or let us estimate.' },
  pickup: { title: 'Saan kayo manggagaling?', help: 'Where the van picks you up. Staff confirm the exact spot.' },
  pace: { title: 'Anong pace ang gusto ninyo?', help: 'How full each day should be.' },
  prefs: { title: 'Anything we should include?', help: 'All optional. Skip this if nothing comes to mind.', optional: true },
}

export const INTEREST_ICON: Record<PlannerInterest, ReactNode> = {
  Beach: <Waves className="size-5" aria-hidden />,
  Mountains: <Mountain className="size-5" aria-hidden />,
  Food: <UtensilsCrossed className="size-5" aria-hidden />,
  Heritage: <Landmark className="size-5" aria-hidden />,
  Adventure: <Bike className="size-5" aria-hidden />,
  Relaxation: <Sofa className="size-5" aria-hidden />,
  Nature: <Trees className="size-5" aria-hidden />,
  Photography: <Camera className="size-5" aria-hidden />,
}
const INTEREST_NOTE: Record<PlannerInterest, string> = {
  Beach: 'Swimming, surf, island hopping',
  Mountains: 'Cool air and viewpoints',
  Food: 'Local dishes and food trips',
  Heritage: 'Old towns, churches, museums',
  Adventure: 'Hikes, rides, waterfalls',
  Relaxation: 'Slow mornings and long breaks',
  Nature: 'Parks, rivers, farms',
  Photography: 'Scenic spots for photos',
}
const GROUP_ICON: Record<GroupType, ReactNode> = {
  Barkada: <Users className="size-5" aria-hidden />,
  Family: <Heart className="size-5" aria-hidden />,
  Couple: <Heart className="size-5" aria-hidden />,
  Officemates: <Briefcase className="size-5" aria-hidden />,
  Other: <User className="size-5" aria-hidden />,
}
const PACES: { value: TripPace; body: string }[] = [
  { value: 'Relaxed', body: 'Up to 2 stops a day with long breaks and about 2 hours of free time. Later starts.' },
  { value: 'Balanced', body: 'Up to 3 stops a day and about an hour of free time. A good mix.' },
  { value: 'Packed', body: 'Up to 4 stops a day, early starts and later evenings. See as much as you can.' },
]

export function Questions() {
  const { q, answers: a, setAnswers, go, editing, plan, reapply, sample } = usePlanner()
  const data = useCustomer((s) => s.data)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [askKeep, setAskKeep] = useState(false)
  const id = QUESTIONS[q]
  const meta = TITLES[id]
  const headRef = useRef<HTMLHeadingElement>(null)
  useLauncherRaise(68)
  const set = (fn: (a: PlannerAnswers) => PlannerAnswers) => {
    setAnswers(fn)
    if (Object.keys(errors).length) setErrors({})
  }

  const finish = () => {
    if (editing && plan) {
      if (plan.edited) return setAskKeep(true)
      reapply(data.destinations, 'replace')
      return go('result')
    }
    go('planning')
  }
  const move = (to: number) => {
    setErrors({})
    go('questions', to)
    requestAnimationFrame(() => headRef.current?.focus())
  }
  const next = (e?: FormEvent) => {
    e?.preventDefault()
    const errs = validateQuestion(id, a)
    if (Object.keys(errs).length) {
      setErrors(errs)
      return
    }
    if (q === QUESTIONS.length - 1) return finish()
    move(q + 1)
  }
  /** "Update plan" while editing: every answer must still be valid. */
  const applyNow = () => {
    const bad = QUESTIONS.findIndex((x) => Object.keys(validateQuestion(x, a)).length > 0)
    if (bad >= 0) {
      setErrors(validateQuestion(QUESTIONS[bad], a))
      if (bad !== q) go('questions', bad)
      return
    }
    finish()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
      <form onSubmit={next} noValidate className="min-w-0 pb-24 md:pb-0" aria-labelledby="planner-q">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <PlannerLabel />
          {sample && <p className="text-xs font-medium text-ink-2">Sample trip filled in. Change anything you like.</p>}
        </div>
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs font-semibold text-ink-2">
            <span>
              Question {q + 1} of {QUESTIONS.length}
              {meta.optional && ' · optional'}
            </span>
            {editing && plan && <button type="button" onClick={() => go('result')} className="text-brand-700 hover:underline">Back to your plan</button>}
          </div>
          <div className="mt-2 flex gap-1" role="progressbar" aria-label="Planner progress" aria-valuemin={1} aria-valuemax={QUESTIONS.length} aria-valuenow={q + 1}>
            {QUESTIONS.map((x, i) => (
              <span key={x} className={`h-1.5 flex-1 rounded-full transition-colors duration-300 ${i <= q ? 'bg-brand-600' : 'bg-sand-2'}`} />
            ))}
          </div>
        </div>

        <Card key={id} className="page-in mt-5 p-5 md:p-7">
          <h1 id="planner-q" ref={headRef} tabIndex={-1} className="type-head text-[28px] leading-tight text-charcoal focus:outline-none md:text-[34px]">
            {meta.title}
          </h1>
          <p className="mt-1.5 text-[15px] text-ink-2">{meta.help}</p>
          <div className="mt-6">
            {id === 'destination' && <DestinationQ a={a} set={set} errors={errors} />}
            {id === 'interests' && <InterestsQ a={a} set={set} errors={errors} />}
            {id === 'group' && <GroupQ a={a} set={set} errors={errors} />}
            {id === 'dates' && <DatesQ a={a} set={set} errors={errors} />}
            {id === 'budget' && <BudgetQ a={a} set={set} errors={errors} />}
            {id === 'pickup' && <PickupQ a={a} set={set} errors={errors} />}
            {id === 'pace' && <PaceQ a={a} set={set} errors={errors} />}
            {id === 'prefs' && <PrefsQ a={a} set={set} />}
          </div>
        </Card>

        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom))] backdrop-blur md:static md:mt-5 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-2 md:max-w-none">
            <Button variant="secondary" onClick={() => (q === 0 ? go('intro') : move(q - 1))} icon={<ArrowLeft className="size-4" aria-hidden />}>
              Back
            </Button>
            <div className="flex gap-2">
              {editing && plan && q < QUESTIONS.length - 1 && (
                <Button variant="ghost" onClick={applyNow}>
                  Update plan
                </Button>
              )}
              {meta.optional && !editing && (
                <Button variant="ghost" onClick={finish}>
                  Skip
                </Button>
              )}
              <Button type="submit" icon={q === QUESTIONS.length - 1 ? <Sparkles className="size-4" aria-hidden /> : undefined}>
                {q === QUESTIONS.length - 1 ? (editing ? 'Update my plan' : 'Plan my trip') : 'Continue'}
                {q < QUESTIONS.length - 1 && <ArrowRight className="size-4" aria-hidden />}
              </Button>
            </div>
          </div>
        </div>
        <p className="mt-4 hidden text-sm text-ink-2 md:block">
          <Link to={formLink(a.destination.mode === 'chosen' ? a.destination.id : null)} className="font-semibold text-brand-700 hover:underline">
            Prefer to fill out the details yourself?
          </Link>
        </p>
      </form>

      <aside className="hidden lg:block">
        <Card className="sticky top-24 p-5">
          <h2 className="font-display text-base font-bold text-charcoal">Your trip so far</h2>
          <dl className="mt-3 space-y-2.5 text-sm">
            {QUESTIONS.slice(0, 7).map((x, i) => {
              const answered = i < q || Object.keys(validateQuestion(x, a)).length === 0
              return (
                <div key={x} className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-3">{SHORT[x]}</dt>
                    <dd className={answered ? 'text-ink' : 'text-ink-3'}>{answered ? answerText(x, a, data.destinations) : 'Not answered yet'}</dd>
                  </div>
                  {answered && i !== q && (
                    <button type="button" onClick={() => move(i)} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline" aria-label={`Change ${SHORT[x].toLowerCase()}`}>
                      Change
                    </button>
                  )}
                </div>
              )
            })}
          </dl>
        </Card>
      </aside>

      <Dialog
        open={askKeep}
        onClose={() => setAskKeep(false)}
        title="Keep your changes to the plan?"
        footer={
          <>
            <Button variant="secondary" onClick={() => (reapply(data.destinations, 'replace'), setAskKeep(false), go('result'))}>
              Start fresh
            </Button>
            <Button onClick={() => (reapply(data.destinations, 'keep'), setAskKeep(false), go('result'))}>Keep my changes</Button>
          </>
        }
      >
        <p>You edited the plan. We can keep your stops and fit them to your new answers, or make a fresh plan. Stops you locked stay either way, and you can undo.</p>
      </Dialog>
    </div>
  )
}

const SHORT: Record<QuestionId, string> = {
  destination: 'Destination', interests: 'Getaway', group: 'Group', dates: 'When', budget: 'Budget', pickup: 'Pickup', pace: 'Pace', prefs: 'Extras',
}

export function answerText(x: QuestionId, a: PlannerAnswers, catalog: { id: string; name: string }[]) {
  switch (x) {
    case 'destination':
      return a.destination.mode === 'suggest' ? 'Suggest somewhere' : a.destination.mode === 'other' ? a.destination.text : catalog.find((d) => d.id === a.destination.id)?.name ?? ''
    case 'interests':
      return a.interests.join(', ')
    case 'group':
      return groupText(a)
    case 'dates':
      return `${datesText(a, fmtRange)} · ${tripDays(a)} ${tripDays(a) === 1 ? 'day' : 'days'}`
    case 'budget':
      return budgetText(a)
    case 'pickup':
      return [a.pickup.landmark, a.pickup.city].filter(Boolean).join(', ')
    case 'pace':
      return a.pace
    default:
      return [a.prefs.mustVisit, a.prefs.lodging !== 'No preference' ? a.prefs.lodging : '', a.prefs.notes].filter(Boolean).join(' · ') || 'Nothing added'
  }
}

interface QProps {
  a: PlannerAnswers
  set: (fn: (a: PlannerAnswers) => PlannerAnswers) => void
  errors: Record<string, string>
}

function FieldError({ children }: { children?: string }) {
  return children ? <p className="mt-2 text-sm font-medium text-bad" role="alert">{children}</p> : null
}

function Note({ children, tone = 'info' }: { children: ReactNode; tone?: 'info' | 'warn' }) {
  return (
    <p className={`flex gap-2 rounded-xl px-3 py-2.5 text-[13px] ${tone === 'warn' ? 'bg-warn-bg text-warn' : 'bg-info-bg text-info'}`}>
      <Info className="mt-px size-4 shrink-0" aria-hidden />
      <span>{children}</span>
    </p>
  )
}

function DestinationQ({ a, set, errors }: QProps) {
  const data = useCustomer((s) => s.data)
  const chosen = a.destination.mode === 'chosen' ? data.destinations.find((d) => d.id === a.destination.id) : undefined
  const text = a.destination.mode === 'chosen' ? chosen?.name ?? '' : a.destination.mode === 'other' ? a.destination.text : ''
  const onText = (t: string) => {
    const match = data.destinations.find((d) => d.name.toLowerCase() === t.trim().toLowerCase())
    set((x) => ({ ...x, destination: match ? { mode: 'chosen', id: match.id, text: '' } : t.trim() ? { mode: 'other', id: '', text: t } : { mode: '', id: '', text: '' } }))
  }
  const popular = ['DST-LAUNION', 'DST-BAGUIO', 'DST-TAGAYTAY', 'DST-BATANGAS', 'DST-VIGAN', 'DST-SUBIC'].map((id) => data.destinations.find((d) => d.id === id)!).filter(Boolean)
  return (
    <div className="space-y-5">
      <Combobox
        label="Destination"
        icon={<Compass className="size-4" aria-hidden />}
        value={text}
        onChange={onText}
        onPick={(o) => set((x) => ({ ...x, destination: { mode: 'chosen', id: o.value, text: '' } }))}
        options={destinationOptions(data)}
        selected={a.destination.mode === 'chosen' ? a.destination.id : undefined}
        placeholder="Search La Union, Baguio, Vigan…"
        hint={chosen ? `${chosen.province} · ${chosen.travelTime} from Manila` : 'Choose from our places, or type somewhere else in Luzon.'}
        freeTextNote="Not one of our places yet. You can still plan it with staff."
      />
      <div>
        <p className="text-xs font-semibold text-ink-3">Popular</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {popular.map((d) => {
            const on = a.destination.mode === 'chosen' && a.destination.id === d.id
            return (
              <button
                key={d.id}
                type="button"
                aria-pressed={on}
                onClick={() => set((x) => ({ ...x, destination: { mode: 'chosen', id: d.id, text: '' } }))}
                className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-surface text-ink hover:border-brand-300'}`}
              >
                {d.name}
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex items-center gap-3 text-xs text-ink-3">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <ChoiceCard
        name="destination-mode"
        checked={a.destination.mode === 'suggest'}
        onChange={() => set((x) => ({ ...x, destination: { mode: 'suggest', id: '', text: '' } }))}
        icon={<Sparkles className="size-5" aria-hidden />}
        title="Suggest somewhere"
        body="We’ll match a place to your interests, group, pickup, budget and pace, with a couple of alternatives."
      />
      {a.destination.mode === 'other' && a.destination.text.trim().length >= 3 && (
        <Note tone="warn">
          We don’t have planning data for “{a.destination.text.trim()}” yet, so we can’t suggest stops or travel times for it. Continue and we’ll send it to staff as a manual request, or pick one of our places.
        </Note>
      )}
      <FieldError>{errors.destination}</FieldError>
    </div>
  )
}

function InterestsQ({ a, set, errors }: QProps) {
  const toggle = (i: PlannerInterest) => set((x) => ({ ...x, interests: x.interests.includes(i) ? x.interests.filter((y) => y !== i) : [...x.interests, i] }))
  return (
    <fieldset>
      <legend className="sr-only">Kinds of getaway</legend>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {PLANNER_INTERESTS.map((i) => (
          <ChoiceCard key={i} compact type="checkbox" name="interests" checked={a.interests.includes(i)} onChange={() => toggle(i)} icon={INTEREST_ICON[i]} title={i} body={INTEREST_NOTE[i]} />
        ))}
      </div>
      <FieldError>{errors.interests}</FieldError>
    </fieldset>
  )
}

function GroupQ({ a, set, errors }: QProps) {
  const g = a.group
  const upd = (patch: Partial<PlannerAnswers['group']>) => set((x) => ({ ...x, group: { ...x.group, ...patch } }))
  return (
    <div className="space-y-6">
      <fieldset>
        <legend className="mb-2 text-sm font-medium text-ink">Who’s coming?</legend>
        <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
          {GROUP_TYPES.map((t) => (
            <ChoiceCard
              key={t}
              compact
              name="group-type"
              checked={g.type === t}
              onChange={() => upd({ type: t, ...(t === 'Couple' ? { size: 2, children: 0 } : g.size < 1 ? { size: t === 'Family' ? 5 : 6 } : {}) })}
              icon={GROUP_ICON[t]}
              title={t}
            />
          ))}
        </div>
        <FieldError>{errors.type}</FieldError>
      </fieldset>
      <Stepper label="How many are travelling?" value={g.size} min={1} max={MAX_GROUP} onChange={(size) => upd({ size })} error={errors.size} hint={`Including everyone. Up to ${MAX_GROUP} online; one van seats 12.`} />
      <fieldset className="rounded-2xl border border-dashed border-line-strong p-4">
        <legend className="px-1 text-sm font-medium text-ink">Children and seniors <span className="font-normal text-ink-3">(optional)</span></legend>
        <p className="text-xs text-ink-2">Only counts, so we can lean towards easy walks. No names, ages or health details needed.</p>
        <div className="mt-3 flex flex-wrap gap-6">
          <Stepper label="Children" value={g.children} max={Math.max(0, g.size)} onChange={(children) => upd({ children: Number.isFinite(children) ? children : 0 })} />
          <Stepper label="Seniors" value={g.seniors} max={Math.max(0, g.size)} onChange={(seniors) => upd({ seniors: Number.isFinite(seniors) ? seniors : 0 })} />
        </div>
        <FieldError>{errors.extra}</FieldError>
      </fieldset>
    </div>
  )
}

function DatesQ({ a, set, errors }: QProps) {
  const d = a.dates
  const earliest = earliestStart()
  const upd = (patch: Partial<PlannerAnswers['dates']>) => set((x) => ({ ...x, dates: { ...x.dates, ...patch } }))
  const days = d.start && d.end && d.end >= d.start ? daysBetween(d.start, d.end) + 1 : 0
  const windows = dateWindows()
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="sr-only">How set are your dates?</legend>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <ChoiceCard compact name="date-mode" checked={d.mode === 'exact'} onChange={() => upd({ mode: 'exact' })} title="Exact dates" body="We know when." />
          <ChoiceCard compact name="date-mode" checked={d.mode === 'flexible'} onChange={() => upd({ mode: 'flexible', window: d.window || windows[0] })} title="Flexible" body="Roughly when." />
          <ChoiceCard compact name="date-mode" checked={d.mode === 'undecided'} onChange={() => upd({ mode: 'undecided' })} title="Not decided" body="Just how long." />
        </div>
        <FieldError>{errors.mode}</FieldError>
      </fieldset>
      {d.mode === 'exact' && (
        <div className="page-in space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Start date" type="date" min={earliest} value={d.start} onChange={(e) => upd({ start: e.target.value, end: !d.end || d.end < e.target.value ? e.target.value : d.end })} error={errors.start} hint={`Earliest ${fmtDate(earliest, { weekday: true })}`} />
            <TextField label="End date" type="date" min={d.start || earliest} max={d.start ? addDays(d.start, MAX_DAYS - 1) : undefined} value={d.end} onChange={(e) => upd({ end: e.target.value })} error={errors.end} />
          </div>
          {days > 0 && <p className="text-sm font-medium text-ink">{days === 1 ? 'A day trip' : `${days} days, ${days - 1} ${days === 2 ? 'night' : 'nights'}`}</p>}
        </div>
      )}
      {(d.mode === 'flexible' || d.mode === 'undecided') && (
        <div className="page-in grid gap-4 sm:grid-cols-2">
          {d.mode === 'flexible' && (
            <Select label="Roughly when?" value={d.window} onChange={(e) => upd({ window: e.target.value })} error={errors.window}>
              {windows.map((w) => (
                <option key={w}>{w}</option>
              ))}
            </Select>
          )}
          <Stepper label="How many days?" value={d.days} min={1} max={MAX_DAYS} onChange={(n) => upd({ days: n })} error={errors.days} hint={d.days === 1 ? 'A day trip' : `${d.days - 1} ${d.days === 2 ? 'night' : 'nights'} away`} />
        </div>
      )}
      <Note>Custom trips need at least a week to plan. Without exact dates the plan shows Day 1, Day 2 and staff agree the dates with you.</Note>
    </div>
  )
}

function BudgetQ({ a, set, errors }: QProps) {
  const b = a.budget
  const size = Math.max(1, a.group.size || 1)
  const upd = (patch: Partial<PlannerAnswers['budget']>) => set((x) => ({ ...x, budget: { ...x.budget, ...patch } }))
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="sr-only">How do you want to set the budget?</legend>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <ChoiceCard compact name="budget-basis" checked={b.basis === 'person'} onChange={() => upd({ basis: 'person' })} title="Per person" body="What each traveller spends." />
          <ChoiceCard compact name="budget-basis" checked={b.basis === 'group'} onChange={() => upd({ basis: 'group' })} title="Whole group" body="One total for everyone." />
          <ChoiceCard compact name="budget-basis" checked={b.basis === 'help'} onChange={() => upd({ basis: 'help', amount: null })} title="Help me estimate" body="We’ll show what it costs." />
        </div>
        <FieldError>{errors.basis}</FieldError>
      </fieldset>
      {(b.basis === 'person' || b.basis === 'group') && (
        <div className="page-in max-w-xs">
          <TextField
            label={b.basis === 'person' ? 'Budget per person' : `Budget for all ${size}`}
            type="number"
            inputMode="numeric"
            min={0}
            step={100}
            icon={<span className="text-sm font-semibold">₱</span>}
            value={b.amount ?? ''}
            onChange={(e) => upd({ amount: e.target.value === '' ? null : Number(e.target.value) })}
            error={errors.amount}
            hint={b.amount ? (b.basis === 'person' ? `About ${peso(b.amount * size)} for ${size}` : `About ${peso(Math.floor(b.amount / size))} per person`) : 'Van, driver, hotel and fees. Meals are separate.'}
          />
        </div>
      )}
      {b.basis === 'help' && <Note>We’ll show a full estimate with your plan: shared costs, per-person fees and what staff still need to quote.</Note>}
    </div>
  )
}

function PickupQ({ a, set, errors }: QProps) {
  const landmarkRef = useRef<HTMLInputElement>(null)
  const area = areaOfCity(a.pickup.city)
  const upd = (patch: Partial<PlannerAnswers['pickup']>) => set((x) => ({ ...x, pickup: { ...x.pickup, ...patch } }))
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Combobox
          label="City or town"
          icon={<MapPin className="size-4" aria-hidden />}
          value={a.pickup.city}
          onChange={(city) => upd({ city })}
          onPick={(o) => {
            upd({ city: o.value, landmark: '' })
            requestAnimationFrame(() => landmarkRef.current?.focus())
          }}
          options={pickupCityOptions()}
          selected={a.pickup.city}
          placeholder="e.g. Malolos, Bulacan"
          error={errors.city}
          hint={area ?? (a.pickup.city ? 'Outside our usual pickup areas? Staff will confirm.' : 'Metro Manila, Bulacan, Pampanga, Rizal, Cavite or Laguna')}
        />
        <Combobox
          ref={landmarkRef}
          label="Landmark (optional)"
          value={a.pickup.landmark}
          onChange={(landmark) => upd({ landmark })}
          onPick={(o) => {
            const [landmark, city] = o.value.split('|')
            upd({ landmark, city: a.pickup.city && areaOfCity(a.pickup.city) ? a.pickup.city : city })
          }}
          options={landmarkOptions(a.pickup.city)}
          placeholder={area ? `Landmark in ${a.pickup.city}` : 'Choose a city first, or type any landmark'}
          freeTextNote="We’ll use the pickup point you typed."
        />
      </div>
      <button type="button" onClick={() => (upd({ landmark: '' }), landmarkRef.current?.focus())} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
        <Plus className="size-4" aria-hidden /> Enter another pickup point
      </button>
      <Note>Suggestions are common meeting points, not a promise of pickup. Staff confirm the exact spot and time with you.</Note>
    </div>
  )
}

function PaceQ({ a, set, errors }: QProps) {
  return (
    <fieldset>
      <legend className="sr-only">Pace</legend>
      <div className="grid gap-2.5">
        {PACES.map((p) => (
          <ChoiceCard key={p.value} name="pace" checked={a.pace === p.value} onChange={() => set((x) => ({ ...x, pace: p.value }))} title={p.value} body={p.body} />
        ))}
      </div>
      <FieldError>{errors.pace}</FieldError>
    </fieldset>
  )
}

function PrefsQ({ a, set }: Omit<QProps, 'errors'>) {
  const upd = (patch: Partial<PlannerAnswers['prefs']>) => set((x) => ({ ...x, prefs: { ...x.prefs, ...patch } }))
  const p = a.prefs
  return (
    <div className="space-y-4">
      <TextField label="Places you must visit" value={p.mustVisit} onChange={(e) => upd({ mustVisit: e.target.value })} placeholder="e.g. Tangadan Falls, a cafe you’ve heard of" hint="Separate with commas. Places we don’t know are added for staff to check." />
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">Where to stay</legend>
        <div className="flex flex-wrap gap-2">
          {LODGING.map((l) => (
            <button key={l} type="button" aria-pressed={p.lodging === l} onClick={() => upd({ lodging: l })} className={`h-9 rounded-full border px-3.5 text-sm font-medium transition-colors ${p.lodging === l ? 'border-brand-600 bg-brand-600 text-white' : 'border-line-strong bg-surface text-ink hover:border-brand-300'}`}>
              {l}
            </button>
          ))}
        </div>
        <p className="mt-1.5 text-xs text-ink-2">Typical room rates: budget ₱1,800, standard ₱2,200, comfort ₱3,500 a night.</p>
      </fieldset>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Accessibility needs" value={p.accessibility} onChange={(e) => upd({ accessibility: e.target.value })} placeholder="e.g. no long stairs" />
        <TextField label="Dietary needs" value={p.dietary} onChange={(e) => upd({ dietary: e.target.value })} placeholder="e.g. no pork, vegetarian" />
      </div>
      <TextArea label="Anything else?" rows={3} value={p.notes} onChange={(e) => upd({ notes: e.target.value })} placeholder="Birthdays, a sunset you want to catch, things to avoid…" />
    </div>
  )
}
