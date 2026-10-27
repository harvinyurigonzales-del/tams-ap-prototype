import {
  ArrowDown, ArrowUp, BedDouble, Bookmark, Car, ChevronRight, Clock, Coffee, Info, Lock, LockOpen, MapPin, PencilLine, Plus, RefreshCw, Repeat, Sparkles, Sun,
  Trash2, TriangleAlert, Undo2, UtensilsCrossed, Waves, Wallet,
} from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { placeFor } from '../../../domain/planner/data'
import {
  addAttraction, addCustomStop, alternativesFor, budgetOf, canMove, checkPlan, clock, estimate, findStop, hoursText, MAX_DAYS, moveStop, QUESTIONS, quickAction,
  rankDestinations, removeStop, replaceStop, replaceWithCustom, schedule, suggestAnother, toggleLock, tripDays, whyItFits, type CostLine, type Fix, type PlanIssue, type PlanStop,
  type QuickAction, type ScheduleItem, type TripPlan,
} from '../../../domain/planner/engine'
import { requestDestination } from '../../../domain/requests'
import { addDays } from '../../../lib/demoClock'
import { fmtDate, fmtRange, peso } from '../../../lib/format'
import { useCustomer } from '../../../state/customerStore'
import { useLauncherRaise } from '../../../state/assistant'
import { usePlanner } from '../../../state/planner'
import { useUi } from '../../../state/ui'
import { Badge } from '../../../ui/Badge'
import { Button } from '../../../ui/Button'
import { Card } from '../../../ui/Card'
import { Dialog } from '../../../ui/Dialog'
import { TextField } from '../../../ui/Field'
import { Picture } from '../../../ui/Picture'
import { budgetText, datesText, daysText, groupText } from './bits'
import { answerText } from './Questions'

const COST_GROUPS: { id: CostLine['group']; title: string }[] = [
  { id: 'shared', title: 'Shared by the group' },
  { id: 'person', title: 'Per person, for everyone' },
  { id: 'optional', title: 'Optional' },
  { id: 'quote', title: 'Awaiting quote from staff' },
]

export function Result() {
  const data = useCustomer((s) => s.data)
  const toast = useUi((s) => s.toast)
  const { plan, answers: a, update, undo, history, note, setNote, go, saveDraft, shown, kept, keepIssue, setAnswers, reapply, draftId, draftKey } = usePlanner()
  const saveTripDraft = useCustomer((s) => s.saveTripDraft)
  const navigate = useNavigate()
  const [replaceKey, setReplaceKey] = useState<string | null>(null)
  const [addDay, setAddDay] = useState<number | null>(null)
  const [nearer, setNearer] = useState(false)
  useLauncherRaise(68, 64)

  const view = useMemo(() => {
    if (!plan) return null
    const sched = schedule(plan, a)
    const est = estimate(plan, a)
    return { sched, est, issues: checkPlan(plan, a, sched, est), why: whyItFits(plan, a, est) }
  }, [plan, a])

  if (!plan || !view) {
    return (
      <Card className="mx-auto max-w-md p-6 text-center">
        <p className="font-semibold text-ink">No plan yet.</p>
        <Button className="mt-4" onClick={() => go('questions', 0)}>Start the questions</Button>
      </Card>
    )
  }
  const { sched, est, issues, why } = view
  const open = issues.filter((i) => !kept.includes(i.id))
  const keptIssues = issues.filter((i) => kept.includes(i.id))
  const dest = requestDestination(data, { destinationId: plan.destinationId, destinationName: plan.destinationName })
  const known = !!placeFor(plan.destinationId)
  const b = budgetOf(a)
  const days = plan.days.length

  const act = (p: TripPlan, msg: string) => update(p, msg)
  const quick = (q: QuickAction) => {
    const r = quickAction(plan, a, q)
    if (r.changed) act(r.plan, r.message)
    else setNote(r.message)
  }
  const another = () => {
    const r = suggestAnother(plan, a, data.destinations, shown)
    if (!r.changed) return setNote(r.message)
    if (r.destinationId) usePlanner.setState({ shown: [...shown, r.destinationId] })
    act(r.plan, r.message)
  }
  const addDayToTrip = () => {
    if (days >= MAX_DAYS) return setNote(`Online plans are up to ${MAX_DAYS} days.`)
    setAnswers((x) => (x.dates.mode === 'exact' ? { ...x, dates: { ...x.dates, end: addDays(x.dates.end, 1) } } : { ...x, dates: { ...x.dates, days: tripDays(x) + 1 } }))
    reapply(data.destinations, 'keep')
    setNote(`Made it ${days + 1} days and kept your stops.`)
  }
  const fix = (issue: PlanIssue, f: Fix) => {
    if (f.id === 'add-day') return addDayToTrip()
    if (f.id === 'fewer-stops') return quick('fewer')
    if (f.id === 'cheaper') return quick('cheaper')
    if (f.id === 'nearer') return setNearer(true)
    if (f.id === 'staff') {
      keepIssue(issue.id)
      return setNote('Kept as it is. Staff will look at this when they review your request.')
    }
    if (f.id === 'raise-budget') {
      const per = Math.ceil(est.perPerson / 100) * 100
      setAnswers((x) => ({ ...x, budget: x.budget.basis === 'group' ? { basis: 'group', amount: Math.ceil(est.total / 100) * 100 } : { basis: 'person', amount: per } }))
      return setNote(`Budget set to ${a.budget.basis === 'group' ? peso(Math.ceil(est.total / 100) * 100) + ' for the group' : peso(per) + ' per person'}.`)
    }
    if (f.id === 'replace-hard') {
      let p = plan
      const swapped: string[] = []
      for (const s of plan.days.flat().filter((x) => x.effort === 'hard')) {
        const alt = alternativesFor(p, a, s.key).find((x) => x.attraction.effort === 'easy')
        p = alt ? replaceStop(p, s.key, alt.attraction.id) : removeStop(p, s.key)
        swapped.push(alt ? `${s.name} → ${alt.attraction.name}` : `removed ${s.name}`)
      }
      return act(p, `Easier stops: ${swapped.join('; ')}.`)
    }
  }
  const save = () => {
    const r = saveTripDraft({ id: draftId ?? undefined, key: draftKey, kind: 'planner', title: `${dest.name}, ${days === 1 ? 'day trip' : `${days} days`}`, destination: dest.name, payload: { answers: a, plan, shown, kept } })
    if (!r.ok) return toast(r.error, 'error')
    saveDraft(r.value.id)
    if (r.value.guest) toast('Draft kept in this browser tab. Log in to keep it in My Trips.', 'info', { label: 'Log in', run: () => navigate('/app/login?next=%2Fapp%2Ftrips%3Ftab%3Ddrafts') })
    else toast('Draft saved. Find it under Drafts in My Trips.', 'success', { label: 'View drafts', run: () => navigate('/app/trips?tab=drafts') })
  }
  const editPrefs = (q = 0) => usePlanner.setState({ editing: true, step: 'questions', q })

  return (
    <div className="pb-28 lg:pb-0">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-brand-800 text-white">
        <Picture image={dest.image} eager sizes="100vw" className="absolute inset-0" imgClassName="opacity-60" labelAt="tr" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-900/90 via-brand-900/50 to-brand-900/10" aria-hidden />
        <div className="relative px-5 pt-24 pb-5 md:px-8 md:pt-32 md:pb-7">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold tracking-wide uppercase backdrop-blur">
            <Sparkles className="size-3.5" aria-hidden /> Suggested by TAMS Trip Planner
          </p>
          <h1 className="type-head mt-3 text-[32px] leading-tight md:text-[46px]">{known ? `${dest.name}, ${days === 1 ? 'a day trip' : `${days} days`}` : `${dest.name}: a request for staff`}</h1>
          <p className="mt-1 text-sm text-white/85">{known ? 'Your suggested plan. Make it your own, then send it to staff.' : 'We can’t plan this place ourselves yet, so staff will plan it with you.'}</p>
          <ul className="mt-4 flex flex-wrap gap-2 text-[13px]">
            {[groupText(a), daysText(days), datesText(a, fmtRange), `Pickup: ${[a.pickup.landmark, a.pickup.city].filter(Boolean).join(', ')}`, `${a.pace || 'Balanced'} pace`, `Budget: ${budgetText(a)}`].map((t) => (
              <li key={t} className="rounded-full bg-white/15 px-3 py-1 backdrop-blur">{t}</li>
            ))}
          </ul>
        </div>
      </div>

      {(note || history.length > 0) && (
        <div className="fade-in mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800" role="status" aria-live="polite">
          <span>{note ?? 'Your changes are saved in this session.'}</span>
          {history.length > 0 && (
            <Button size="sm" variant="secondary" onClick={undo} icon={<Undo2 className="size-4" aria-hidden />}>
              Undo
            </Button>
          )}
        </div>
      )}

      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 space-y-5">
          {open.length > 0 && (
            <section aria-label="Things to sort out" className="space-y-3">
              {open.map((i) => (
                <IssueCard key={i.id} issue={i} onFix={(f) => fix(i, f)} />
              ))}
            </section>
          )}

          <Card className="p-5">
            <h2 className="font-display text-lg font-bold text-charcoal">Why this fits your trip</h2>
            <ul className="mt-3 space-y-2 text-[15px] text-ink-2">
              {why.map((w) => (
                <li key={w} className="flex gap-2.5">
                  <span className="mt-2 size-1.5 shrink-0 rounded-full bg-sili" aria-hidden />
                  {w}
                </li>
              ))}
            </ul>
          </Card>

          {known && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Quick changes">
              <QuickChip icon={<Wallet className="size-4" aria-hidden />} onClick={() => quick('cheaper')}>Cheaper</QuickChip>
              <QuickChip icon={<Waves className="size-4" aria-hidden />} onClick={() => quick('beach')}>More beach time</QuickChip>
              <QuickChip icon={<Trash2 className="size-4" aria-hidden />} onClick={() => quick('fewer')}>Fewer stops</QuickChip>
              <QuickChip icon={<Coffee className="size-4" aria-hidden />} onClick={() => quick('free')}>More free time</QuickChip>
            </div>
          )}

          {sched.map((d, i) => (
            <DayCard
              key={d.day}
              day={d}
              stops={plan.days[i]}
              plan={plan}
              known={known}
              onAdd={() => setAddDay(i)}
              onAct={act}
              onReplace={setReplaceKey}
            />
          ))}

          {keptIssues.length > 0 && (
            <Card className="p-4">
              <h2 className="text-sm font-semibold text-ink">Left for staff to check</h2>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-sm text-ink-2">
                {keptIssues.map((i) => <li key={i.id}>{i.title}</li>)}
              </ul>
            </Card>
          )}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            <h2 className="font-display text-lg font-bold text-charcoal">Estimated cost</h2>
            <p className="text-xs text-ink-2">Estimated cost · final quotation from TAMS-AP</p>
            <div className="mt-3 flex items-end justify-between gap-3 rounded-2xl bg-surface-muted px-4 py-3">
              <div>
                <p className="text-xs text-ink-2">Per person</p>
                <p className="tnum font-display text-[28px] leading-none font-bold text-charcoal">{peso(est.perPerson)}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-2">Group of {a.group.size}</p>
                <p className="tnum text-lg font-semibold text-ink">{peso(est.total)}</p>
              </div>
            </div>
            {b && (
              <p className={`mt-2 text-xs font-medium ${est.perPerson <= b.perPerson ? 'text-ok' : 'text-warn'}`}>
                {est.perPerson <= b.perPerson ? `Within your ${peso(b.perPerson)} per person` : `${peso(est.perPerson - b.perPerson)} over your ${peso(b.perPerson)} per person`}
              </p>
            )}
            <CostLines lines={est.lines} />
          </Card>

          <Card className="p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-base font-bold text-charcoal">Your preferences</h2>
              <button type="button" onClick={() => editPrefs(0)} className="text-sm font-semibold text-brand-700 hover:underline">Edit</button>
            </div>
            <dl className="mt-2 divide-y divide-line text-sm">
              {QUESTIONS.map((x, i) => (
                <div key={x} className="flex items-start justify-between gap-3 py-2">
                  <div className="min-w-0">
                    <dt className="text-xs text-ink-3 capitalize">{x === 'prefs' ? 'Extras' : x}</dt>
                    <dd className="text-ink">{answerText(x, a, data.destinations)}</dd>
                  </div>
                  <button type="button" onClick={() => editPrefs(i)} className="shrink-0 text-xs font-semibold text-brand-700 hover:underline" aria-label={`Change ${x === 'prefs' ? 'extras' : x}`}>
                    Change
                  </button>
                </div>
              ))}
            </dl>
          </Card>

          <p className="flex gap-2 rounded-2xl bg-info-bg px-4 py-3 text-[13px] text-info">
            <Info className="mt-px size-4 shrink-0" aria-hidden />
            <span>This is a suggested plan, not a booking. Nothing is reserved. Staff check hotels, timing and prices, then send a proposal you can accept or change.</span>
          </p>

          <div className="hidden space-y-2 lg:block">
            <Button full size="lg" onClick={() => go('review')} icon={<ChevronRight className="size-5" aria-hidden />}>Review trip request</Button>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="secondary" onClick={another} icon={<RefreshCw className="size-4" aria-hidden />}>Suggest another plan</Button>
              <Button variant="secondary" onClick={() => editPrefs(0)} icon={<PencilLine className="size-4" aria-hidden />}>Edit preferences</Button>
            </div>
            <Button full variant="ghost" onClick={save} icon={<Bookmark className="size-4" aria-hidden />}>
              Save draft
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <Button variant="secondary" onClick={another} icon={<RefreshCw className="size-4" aria-hidden />}>Another plan</Button>
            <Button variant="secondary" onClick={() => editPrefs(0)} icon={<PencilLine className="size-4" aria-hidden />}>Preferences</Button>
            <Button className="col-span-2" variant="ghost" onClick={save} icon={<Bookmark className="size-4" aria-hidden />}>
              Save draft
            </Button>
          </div>
        </aside>
      </div>

      {/* Mobile: the main action stays reachable above the tab bar; the page has room below for it. */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-surface/95 px-4 pt-2.5 pb-[calc(10px+env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="tnum text-base font-bold text-charcoal">{peso(est.perPerson)} <span className="text-xs font-medium text-ink-2">per person</span></p>
            <p className="text-[11px] text-ink-3">Estimate · {peso(est.total)} for {a.group.size}</p>
          </div>
          <Button onClick={() => go('review')}>Review trip request</Button>
        </div>
      </div>

      <ReplaceDialog stopKey={replaceKey} onClose={() => setReplaceKey(null)} onDone={(p, msg) => (act(p, msg), toast(msg, 'success', { label: 'Undo', run: undo }))} />
      <AddStopDialog day={addDay} onClose={() => setAddDay(null)} onAdd={(p, msg) => (act(p, msg), setAddDay(null))} />
      <NearerDialog
        open={nearer}
        onClose={() => setNearer(false)}
        onPick={(id, name) => {
          setAnswers((x) => ({ ...x, destination: { mode: 'chosen', id, text: '' } }))
          reapply(data.destinations, 'replace')
          setNearer(false)
          setNote(`New plan for ${name}.`)
        }}
      />
    </div>
  )
}

function QuickChip({ icon, children, onClick }: { icon: ReactNode; children: ReactNode; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:border-brand-300 hover:bg-brand-50">
      <span className="text-brand-700">{icon}</span>
      {children}
    </button>
  )
}

function IssueCard({ issue, onFix }: { issue: PlanIssue; onFix: (f: Fix) => void }) {
  return (
    <div className="pop-in rounded-2xl border border-[#f0d7a8] bg-warn-bg p-4" role="alert">
      <p className="flex items-start gap-2 font-semibold text-warn">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {issue.title}
      </p>
      <p className="mt-1 pl-6 text-sm text-ink-2">{issue.detail}</p>
      <div className="mt-3 flex flex-wrap gap-2 pl-6">
        {issue.fixes.map((f, i) => (
          <Button key={f.id} size="sm" variant={i === 0 ? 'primary' : 'secondary'} onClick={() => onFix(f)}>
            {f.label}
          </Button>
        ))}
      </div>
    </div>
  )
}

const ITEM_ICON: Record<string, ReactNode> = {
  pickup: <MapPin className="size-4" aria-hidden />,
  travel: <Car className="size-4" aria-hidden />,
  return: <Car className="size-4" aria-hidden />,
  meal: <UtensilsCrossed className="size-4" aria-hidden />,
  checkin: <BedDouble className="size-4" aria-hidden />,
  free: <Sun className="size-4" aria-hidden />,
}

function DayCard({
  day, stops, plan, known, onAdd, onAct, onReplace,
}: {
  day: ReturnType<typeof schedule>[number]
  stops: PlanStop[]
  plan: TripPlan
  known: boolean
  onAdd: () => void
  onAct: (p: TripPlan, msg: string) => void
  onReplace: (key: string) => void
}) {
  const byKey = new Map(stops.map((s) => [s.key, s]))
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line bg-surface-muted/60 px-5 py-3">
        <h2 className="font-display text-lg font-bold text-charcoal">
          Day {day.day}
          <span className="ml-2 text-sm font-medium text-ink-2">{day.date ? fmtDate(day.date, { weekday: true, year: false }) : day.label}</span>
        </h2>
        {day.overflow > 0 && <Badge tone="warn">About {hoursText(day.overflow)} too long</Badge>}
      </div>
      <ol className="px-3 py-3 sm:px-5">
        {day.items.map((it, i) => {
          const s = it.stopKey ? byKey.get(it.stopKey) : undefined
          if (s) return <StopRow key={it.stopKey} item={it} stop={s} plan={plan} known={known} onAct={onAct} onReplace={onReplace} />
          return <PlainRow key={`${it.kind}-${i}`} item={it} />
        })}
        {!known && stops.length === 0 && <li className="px-2 py-3 text-sm text-ink-2">Staff will plan this day with you. Add places you want to see and they’ll check them.</li>}
      </ol>
      <div className="border-t border-line px-5 py-3">
        <button type="button" onClick={onAdd} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:underline">
          <Plus className="size-4" aria-hidden /> Add a stop to day {day.day}
        </button>
      </div>
    </Card>
  )
}

function PlainRow({ item }: { item: ScheduleItem }) {
  const timed = item.end > 0
  return (
    <li className="flex gap-3 py-1.5 text-sm">
      <span className="tnum w-[68px] shrink-0 pt-0.5 text-right text-xs text-ink-3">{timed ? clock(item.start) : ''}</span>
      <span className="relative flex min-w-0 flex-1 items-start gap-2 text-ink-2">
        <span className="mt-0.5 text-ink-3">{ITEM_ICON[item.kind]}</span>
        <span className="min-w-0">
          <span className={item.kind === 'travel' && item.title === 'Short drive' ? 'text-ink-3' : 'font-medium text-ink'}>{item.title}</span>
          {item.note && <span className="text-ink-3"> · {item.note}</span>}
          {timed && item.end > item.start && item.kind !== 'travel' && <span className="text-ink-3"> · until {clock(item.end)}</span>}
        </span>
      </span>
    </li>
  )
}

function StopRow({ item, stop: s, plan, known, onAct, onReplace }: { item: ScheduleItem; stop: PlanStop; plan: TripPlan; known: boolean; onAct: (p: TripPlan, msg: string) => void; onReplace: (key: string) => void }) {
  const timed = item.end > 0
  const iconBtn = 'grid size-9 place-items-center rounded-lg text-ink-2 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-35 disabled:hover:bg-transparent'
  return (
    <li className="flex gap-3 py-2">
      <span className="tnum w-[68px] shrink-0 pt-3 text-right text-xs font-semibold text-ink">{timed ? clock(item.start) : ''}</span>
      <div className={`min-w-0 flex-1 rounded-2xl border p-3 ${s.locked ? 'border-brand-300 bg-brand-50/50' : 'border-line bg-surface'}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-ink">{s.name}</p>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-2">
              <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {s.custom ? 'About 1 hr (to confirm)' : hoursText(s.minutes)}</span>
              <span>{s.fee === null ? 'Fee to be quoted' : s.fee ? `${peso(s.fee)} per person` : 'Free entry'}</span>
              {s.tags.length > 0 && <span className="text-ink-3">{s.tags.join(' · ')}</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-1">
            {s.locked && <Badge tone="brand"><Lock className="size-3" aria-hidden /> Kept</Badge>}
            {s.custom && <Badge tone="warn">For staff review</Badge>}
            {!s.custom && s.confirm && <Badge tone="info">{s.confirm}</Badge>}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1 border-t border-line pt-2">
          <button
            type="button"
            aria-pressed={!!s.locked}
            onClick={() => onAct(toggleLock(plan, s.key), s.locked ? `${s.name} can change again.` : `Keeping ${s.name}. It stays when you ask for another plan.`)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold ${s.locked ? 'bg-brand-600 text-white hover:bg-brand-700' : 'text-brand-700 hover:bg-brand-50'}`}
          >
            {s.locked ? <Lock className="size-4" aria-hidden /> : <LockOpen className="size-4" aria-hidden />} Keep this
          </button>
          {known && !s.custom && (
            <button type="button" onClick={() => onReplace(s.key)} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-brand-700 hover:bg-brand-50">
              <Repeat className="size-4" aria-hidden /> Replace
            </button>
          )}
          <span className="ml-auto flex gap-0.5">
            <button type="button" className={iconBtn} disabled={!canMove(plan, s.key, -1)} onClick={() => onAct(moveStop(plan, s.key, -1), `Moved ${s.name} earlier.`)} aria-label={`Move ${s.name} up`}>
              <ArrowUp className="size-4" aria-hidden />
            </button>
            <button type="button" className={iconBtn} disabled={!canMove(plan, s.key, 1)} onClick={() => onAct(moveStop(plan, s.key, 1), `Moved ${s.name} later.`)} aria-label={`Move ${s.name} down`}>
              <ArrowDown className="size-4" aria-hidden />
            </button>
            <button type="button" className={iconBtn} onClick={() => onAct(removeStop(plan, s.key), `Removed ${s.name}.`)} aria-label={`Remove ${s.name}`}>
              <Trash2 className="size-4" aria-hidden />
            </button>
          </span>
        </div>
      </div>
    </li>
  )
}

export function CostLines({ lines }: { lines: CostLine[] }) {
  return (
    <div className="mt-4 space-y-4">
      {COST_GROUPS.map((g) => {
        const xs = lines.filter((l) => l.group === g.id)
        if (!xs.length) return null
        return (
          <div key={g.id}>
            <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{g.title}</h3>
            <ul className="mt-1.5 space-y-1.5">
              {xs.map((l) => (
                <li key={l.label} className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 text-ink-2">
                    <span className="text-ink">{l.label}</span>
                    {l.detail && <span className="block text-xs text-ink-3">{l.detail}</span>}
                  </span>
                  <span className={`tnum shrink-0 ${g.id === 'optional' ? 'text-ink-3' : 'text-ink'}`}>{l.amount !== undefined ? peso(l.amount) : 'To quote'}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Replace one stop: search the places we know here, preview what changes, then confirm. A kept stop asks to be
 * unlocked first. Places already in the plan are not offered, and when nothing fits the customer can name their own.
 */
function ReplaceDialog({ stopKey, onClose, onDone }: { stopKey: string | null; onClose: () => void; onDone: (p: TripPlan, msg: string) => void }) {
  const { plan, answers } = usePlanner()
  const [q, setQ] = useState('')
  const [pick, setPick] = useState<string | null>(null)
  const [own, setOwn] = useState('')
  const [err, setErr] = useState('')
  const current = plan && stopKey ? findStop(plan, stopKey)?.stop : undefined
  const close = () => (setQ(''), setPick(null), setOwn(''), setErr(''), onClose())
  if (!plan || !stopKey || !current) return null
  const alts = alternativesFor(plan, answers, stopKey)
  const needle = q.trim().toLowerCase()
  const shown = alts.filter((x) => !needle || `${x.attraction.name} ${x.attraction.tags.join(' ')}`.toLowerCase().includes(needle))
  const chosen = alts.find((x) => x.attraction.id === pick)
  const perPerson = (p: TripPlan) => estimate(p, answers).perPerson
  const swap = () => {
    if (current.locked) return
    if (chosen) return (onDone(replaceStop(plan, stopKey, chosen.attraction.id), `Replaced ${current.name} with ${chosen.attraction.name}.`), close())
  }
  const custom = () => {
    if (own.trim().length < 3) return setErr('Type the name of the place.')
    onDone(replaceWithCustom(plan, stopKey, own), `Replaced ${current.name} with ${own.trim()}. Staff will check its timing and fees.`)
    close()
  }
  const ownForm = (
    <form className="mt-4 space-y-2" onSubmit={(e) => (e.preventDefault(), custom())}>
      <TextField label="Or name a place you want instead" value={own} onChange={(e) => (setOwn(e.target.value), setErr(''))} placeholder="e.g. a cafe or a relative’s house" error={err} hint="We don’t have data for places you name, so staff check them." />
      <Button type="submit" variant="secondary" size="sm">Use my own stop</Button>
    </form>
  )
  return (
    <Dialog open onClose={close} title={`Replace ${current.name}`} wide>
      {current.locked ? (
        <div className="space-y-3">
          <p className="flex items-start gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-ink">
            <Lock className="mt-0.5 size-4 shrink-0 text-brand-700" aria-hidden /> You chose to keep {current.name}. Unlock it to choose a replacement.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" icon={<LockOpen className="size-4" aria-hidden />} onClick={() => onDone(toggleLock(plan, stopKey), `${current.name} can change again.`)}>
              Unlock and choose a replacement
            </Button>
            <Button size="sm" variant="ghost" onClick={close}>Keep it</Button>
          </div>
        </div>
      ) : chosen ? (
        <div className="space-y-3">
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Preview</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Now', name: current.name, minutes: current.minutes, fee: current.fee, effort: current.effort, note: current.confirm },
              { label: 'Instead', name: chosen.attraction.name, minutes: chosen.attraction.minutes, fee: chosen.attraction.fee, effort: chosen.attraction.effort, note: chosen.attraction.confirm },
            ].map((x) => (
              <div key={x.label} className={`rounded-xl border p-3 ${x.label === 'Instead' ? 'border-brand-300 bg-brand-50/60' : 'border-line'}`}>
                <p className="text-xs text-ink-3">{x.label}</p>
                <p className="font-semibold text-ink">{x.name}</p>
                <p className="mt-1 text-xs text-ink-2">
                  {hoursText(x.minutes)} · {x.fee === null ? 'Fee to confirm' : x.fee ? `${peso(x.fee)} per person` : 'Free'} · {x.effort} effort
                  {x.note && ` · ${x.note}`}
                </p>
              </div>
            ))}
          </div>
          <p className="text-ink">
            Estimated cost per person: {peso(perPerson(plan))} → <span className="font-semibold">{peso(perPerson(replaceStop(plan, stopKey, chosen.attraction.id)))}</span>
            {chosen.matches.length > 0 && <span className="text-ink-2"> · Matches {chosen.matches.join(', ').toLowerCase()}</span>}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={swap}>Confirm replacement</Button>
            <Button size="sm" variant="ghost" onClick={() => setPick(null)}>Back to the list</Button>
          </div>
        </div>
      ) : (
        <>
          {alts.length > 0 && (
            <TextField label="Search places" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name or interest, e.g. beach" />
          )}
          {shown.length === 0 ? (
            <p className="mt-3 rounded-xl bg-surface-muted px-3 py-3 text-ink">
              {alts.length === 0 ? 'Every place we know here is already in your plan.' : `No places match “${q.trim()}”.`} You can name your own stop, and staff will check it.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {shown.map((x) => (
                <li key={x.attraction.id}>
                  <button type="button" onClick={() => setPick(x.attraction.id)} className="w-full rounded-xl border border-line p-3 text-left transition-colors hover:border-brand-300 hover:bg-brand-50">
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold text-ink">{x.attraction.name}</span>
                      {x.matches.length > 0 && <Badge tone="ok">Matches {x.matches.join(', ').toLowerCase()}</Badge>}
                    </span>
                    <span className="mt-1 block text-xs text-ink-2">
                      {hoursText(x.attraction.minutes)} ({x.minutesDelta === 0 ? 'same time' : x.minutesDelta > 0 ? `${hoursText(x.minutesDelta)} longer` : `${hoursText(-x.minutesDelta)} shorter`}) ·{' '}
                      {x.feeDelta === 0 ? 'same cost' : x.feeDelta > 0 ? `${peso(x.feeDelta)} more per person` : `${peso(-x.feeDelta)} less per person`}
                      {x.attraction.effort !== 'easy' && ` · ${x.attraction.effort} effort`}
                      {x.attraction.confirm && ` · ${x.attraction.confirm}`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {ownForm}
        </>
      )}
    </Dialog>
  )
}

function AddStopDialog({ day, onClose, onAdd }: { day: number | null; onClose: () => void; onAdd: (p: TripPlan, msg: string) => void }) {
  const { plan, answers } = usePlanner()
  const [name, setName] = useState('')
  const [err, setErr] = useState('')
  const alts = plan ? alternativesFor(plan, answers) : []
  const close = () => (setName(''), setErr(''), onClose())
  if (!plan) return null
  return (
    <Dialog open={day !== null} onClose={close} title={`Add a stop to day ${(day ?? 0) + 1}`} wide>
      {alts.length > 0 && (
        <>
          <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Suggested</p>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {alts.slice(0, 6).map((x) => (
              <li key={x.attraction.id}>
                <button type="button" onClick={() => (onAdd(addAttraction(plan, x.attraction.id, day ?? 0), `Added ${x.attraction.name} to day ${(day ?? 0) + 1}.`), close())} className="h-full w-full rounded-xl border border-line p-3 text-left hover:border-brand-300 hover:bg-brand-50">
                  <span className="block font-semibold text-ink">{x.attraction.name}</span>
                  <span className="text-xs text-ink-2">
                    {hoursText(x.attraction.minutes)} · {x.attraction.fee ? `${peso(x.attraction.fee)} per person` : 'Free'}
                    {x.matches.length > 0 && ` · ${x.matches.join(', ')}`}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      <form
        className="mt-5 space-y-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (name.trim().length < 3) return setErr('Type the name of the place.')
          onAdd(addCustomStop(plan, name, day ?? 0), `Added ${name.trim()}. Staff will check its timing and fees.`)
          close()
        }}
      >
        <TextField label="Or add your own stop" value={name} onChange={(e) => (setName(e.target.value), setErr(''))} placeholder="e.g. a cafe or a relative’s house" error={err} hint="We don’t have data for places you add, so they’re marked for staff review." />
        <Button type="submit" variant="secondary" icon={<Plus className="size-4" aria-hidden />}>Add my stop</Button>
      </form>
    </Dialog>
  )
}

function NearerDialog({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (id: string, name: string) => void }) {
  const data = useCustomer((s) => s.data)
  const { answers, plan } = usePlanner()
  const list = open ? rankDestinations(answers, data.destinations).filter((s) => s.destination.id !== plan?.destinationId).slice(0, 4) : []
  return (
    <Dialog open={open} onClose={onClose} title="Places that fit your answers" wide>
      <ul className="space-y-2">
        {list.map((s) => (
          <li key={s.destination.id}>
            <button type="button" onClick={() => onPick(s.destination.id, s.destination.name)} className="flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left hover:border-brand-300 hover:bg-brand-50">
              <Picture image={s.destination.image} sizes="96px" className="h-16 w-20 shrink-0 rounded-lg" label={false} />
              <span className="min-w-0">
                <span className="block font-semibold text-ink">{s.destination.name}</span>
                <span className="block text-xs text-ink-2">{s.reasons.join(' · ')}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Dialog>
  )
}
