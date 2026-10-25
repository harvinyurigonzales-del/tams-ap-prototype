import { ChevronLeft, ChevronRight, Clock, MapPin, Tag } from 'lucide-react'
import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { BOOKING_CUTOFF_DAYS, promoFor, shortRange } from '../../domain/rules'
import { addDays, DEMO_TODAY, weekday } from '../../lib/demoClock'
import { fmtDate, fmtRange, fmtTime, monthLabel, peso, shortDay } from '../../lib/format'
import { useCustomer } from '../../state/customerStore'
import { SampleTag } from '../../ui/Badge'
import { Button, LinkButton } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { BackLink } from './Explore'
import { departuresOf } from './select'
import { Steps } from './Steps'

export function ChooseDate() {
  const { serviceId } = useParams()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const data = useCustomer((s) => s.data)
  const service = data.services.find((s) => s.id === serviceId && s.type === 'tour')
  const deps = service ? departuresOf(data, service.id) : []
  const selected = deps.find((d) => d.dep.id === params.get('d') && d.avail.state === 'open')
  const firstMonth = (selected ?? deps.find((d) => d.avail.state === 'open') ?? deps[0])?.dep.startDate.slice(0, 7) ?? DEMO_TODAY.slice(0, 7)
  const [month, setMonth] = useState(firstMonth)
  const [hint, setHint] = useState('')

  if (!service) return <EmptyState title="Trip not found" action={<LinkButton to="/app">Back to Explore</LinkButton>} />

  const [y, m] = month.split('-').map(Number)
  const first = `${month}-01`
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate()
  const lead = weekday(first)
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: daysIn }, (_, i) => addDays(first, i))]
  const byDay = new Map(deps.map((d) => [d.dep.startDate, d]))
  const inMonth = deps.filter((d) => d.dep.startDate.startsWith(month))
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, m - 1 + n, 1))
    setMonth(d.toISOString().slice(0, 7))
  }
  const minMonth = DEMO_TODAY.slice(0, 7)

  const promo = selected ? promoFor(selected.dep, DEMO_TODAY) : 0
  const pickDay = (day: string) => {
    const d = byDay.get(day)
    if (!d) return
    if (d.avail.state !== 'open') {
      setHint(
        d.avail.state === 'full'
          ? `${fmtDate(day, { year: false })} is full.`
          : `Online booking for ${fmtDate(day, { year: false })} closed ${BOOKING_CUTOFF_DAYS} days before departure.`,
      )
      return
    }
    setHint('')
    setParams({ d: d.dep.id }, { replace: true })
  }

  return (
    <div>
      <BackLink to={`/app/tours/${service.id}`} label={service.name} />
      <Steps current={1} />
      <h1 className="type-head text-[32px] text-charcoal md:text-[40px]">Choose date</h1>
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_360px]">
        <Card className="p-4 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <button onClick={() => shift(-1)} disabled={month <= minMonth} aria-label="Previous month" className="rounded-xl p-2 text-ink-2 hover:bg-brand-50 disabled:opacity-30">
              <ChevronLeft className="size-5" />
            </button>
            <h2 className="font-display text-lg font-semibold" aria-live="polite">
              {monthLabel(y, m - 1)}
            </h2>
            <button onClick={() => shift(1)} aria-label="Next month" className="rounded-xl p-2 text-ink-2 hover:bg-brand-50">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-3" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => (
              <span key={i}>{shortDay(i)}</span>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1" role="grid" aria-label={`Departures in ${monthLabel(y, m - 1)}`}>
            {cells.map((day, i) => {
              if (!day) return <span key={`x${i}`} />
              const d = byDay.get(day)
              const isSel = selected && day >= selected.dep.startDate && day <= selected.dep.endDate
              const isStart = selected?.dep.startDate === day
              const state = d?.avail.state
              const label = d ? (state === 'open' ? `${d.avail.left} left` : state === 'full' ? 'Full' : 'Closed') : ''
              return (
                <button
                  key={day}
                  role="gridcell"
                  onClick={() => pickDay(day)}
                  aria-disabled={!d || state !== 'open'}
                  aria-selected={isStart || undefined}
                  aria-label={`${fmtDate(day, { weekday: true })}${d ? `, ${label}` : ', no departure'}`}
                  title={d && state !== 'open' ? label : undefined}
                  className={`flex aspect-square min-h-12 flex-col items-center justify-center rounded-xl text-sm transition ${
                    isStart
                      ? 'bg-brand-600 font-semibold text-white'
                      : isSel
                        ? 'bg-brand-100 text-brand-800'
                        : d && state === 'open'
                          ? 'bg-brand-50 font-semibold text-brand-800 ring-1 ring-brand-200 hover:bg-brand-100'
                          : d
                            ? 'cursor-not-allowed bg-surface-muted text-ink-3 line-through'
                            : 'cursor-default text-ink-3'
                  } ${day === DEMO_TODAY ? 'outline outline-1 outline-ink-3' : ''}`}
                >
                  <span>{+day.slice(8)}</span>
                  {d && <span className={`text-[10px] leading-none font-medium no-underline ${isStart ? 'text-brand-100' : ''}`}>{label}</span>}
                </button>
              )
            })}
          </div>
          {hint && (
            <p role="status" className="mt-3 rounded-xl bg-warn-bg px-3.5 py-2 text-sm text-warn">
              {hint}
            </p>
          )}
          {inMonth.length === 0 && <p className="mt-4 text-center text-sm text-ink-2">No departures this month. Try another month.</p>}
          <p className="mt-4 text-xs text-ink-3">
            Online booking closes {BOOKING_CUTOFF_DAYS} days before departure.
            <SampleTag />
          </p>
        </Card>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="p-5">
            {selected ? (
              <>
                <p className="text-xs font-semibold tracking-wide text-ink-2 uppercase">Selected departure</p>
                <p className="mt-1 font-display text-lg font-semibold text-ink">{fmtRange(selected.dep.startDate, selected.dep.endDate)}</p>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-ink-2">
                  <Clock className="size-4" aria-hidden /> Pickup {fmtTime(service.pickupTime)}
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-ink-2">
                  <MapPin className="size-4" aria-hidden /> {service.pickup}
                </p>
                <p className="mt-1 text-sm font-medium text-ok">{selected.avail.left} seats left</p>
                {selected.dep.promo &&
                  (promo > 0 ? (
                    <p className="mt-3 flex items-center gap-1.5 rounded-xl bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700">
                      <Tag className="size-4" aria-hidden /> {peso(promo)} off applied · Book by {fmtDate(selected.dep.promo.bookBy, { year: false })}
                    </p>
                  ) : (
                    <p className="mt-3 rounded-xl bg-surface-muted px-3 py-2 text-sm text-ink-2">The {selected.dep.promo.label} promo has ended for this date.</p>
                  ))}
                <p className="mt-4">
                  <span className="font-display text-2xl font-bold text-brand-700 tnum">{peso(service.price - promo)}</span>
                  <span className="text-sm text-ink-2">/person</span>
                  {promo > 0 && <span className="ml-2 text-sm text-ink-3 line-through tnum">{peso(service.price)}</span>}
                </p>
                <Button size="lg" full className="mt-4" onClick={() => navigate(`/app/book/${selected.dep.id}`)}>
                  Continue
                </Button>
              </>
            ) : (
              <p className="text-sm text-ink-2">
                Select a highlighted date to see the schedule and price. {service.name} runs on {shortRangeList(deps.map((d) => d.dep))}.
              </p>
            )}
          </Card>
        </aside>
      </div>
    </div>
  )
}

const shortRangeList = (deps: { startDate: string; endDate: string }[]) => deps.map((d) => shortRange(d.startDate, d.endDate)).join(', ') || 'no upcoming dates'
