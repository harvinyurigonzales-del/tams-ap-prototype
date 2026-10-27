import { assignmentIssue } from '../../domain/fleet'
import { CarFront, ChevronLeft, ChevronRight, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { assignableTargets, seatUse, shortRange, type AssignTarget } from '../../domain/rules'
import { addDays, DEMO_TODAY, overlaps, weekday } from '../../lib/demoClock'
import { fmtDate, monthLabel, shortDay } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import type { Assignment, Dataset } from '../../seed/types'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, SectionTitle } from '../../ui/Card'
import { PageHeader } from './AdminRoutes'
import { AssignDialog } from './Assign'
import { Tabs } from './common'

interface CalEvent {
  key: string
  kind: 'departure' | 'rental' | 'block'
  from: string
  to: string
  title: string
  detail: string
  target?: AssignTarget & { assignment?: Assignment }
  needsVan?: boolean
  link?: string
}

/** Calendar events come from departures, van rentals and fleet blocks only (spec section 7). */
function events(d: Dataset): CalEvent[] {
  const targets = assignableTargets(d, '0000-00-00')
  const resName = (a?: Assignment) => {
    if (!a) return ''
    const v = d.vehicles.find((x) => x.id === a.vehicleId)
    const dr = d.drivers.find((x) => x.id === a.driverId)
    return `${v?.name} · ${dr?.name}`
  }
  const out: CalEvent[] = []
  for (const dep of d.departures) {
    const use = seatUse(dep.id, d.bookings)
    const svc = d.services.find((s) => s.id === dep.serviceId)!
    const t = targets.find((x) => x.kind === 'departure' && x.id === dep.id)
    out.push({
      key: dep.id, kind: 'departure', from: dep.startDate, to: dep.endDate, title: svc.name,
      detail: `${use.confirmed + use.completed} confirmed, ${use.pending} pending of ${dep.capacity} seats${t?.assignment ? ` · ${resName(t.assignment)}` : ''}${t?.assignment && assignmentIssue(d, t.assignment) ? ' · Needs reassignment' : ''}`,
      target: t, needsVan: !!t && (!t.assignment || !!assignmentIssue(d, t.assignment)) && dep.endDate >= DEMO_TODAY, link: `/admin/bookings?service=${svc.id}`,
    })
  }
  for (const b of d.bookings) {
    if (b.departureId || b.status === 'Cancelled') continue
    const t = targets.find((x) => x.kind === 'booking' && x.id === b.id)
    out.push({
      key: b.id, kind: 'rental', from: b.startDate, to: b.endDate, title: `Van rental · ${b.rental?.destination ?? ''}`,
      detail: `${b.id} · ${b.contactName}, ${b.pax} pax · ${b.status}${t?.assignment ? ` · ${resName(t.assignment)}` : ''}${t?.assignment && assignmentIssue(d, t.assignment) ? ' · Needs reassignment' : ''}`,
      target: t, needsVan: !!t && (!t.assignment || !!assignmentIssue(d, t.assignment)) && b.endDate >= DEMO_TODAY, link: `/admin/bookings?id=${b.id}`,
    })
  }
  for (const v of d.vehicles)
    for (const blk of v.blocks)
      out.push({ key: blk.id ?? `${v.id}-${blk.from}`, kind: 'block', from: blk.from, to: blk.to, title: `${v.name} ${blk.kind === 'maintenance' ? 'maintenance' : 'unavailable'}`, detail: blk.note, link: '/admin/vehicles' })
  return out.sort((a, b) => a.from.localeCompare(b.from))
}

const CHIP: Record<CalEvent['kind'], string> = {
  departure: 'bg-brand-100 text-brand-800',
  rental: 'bg-info-bg text-info',
  block: 'bg-warn-bg text-warn',
}

export function Calendar() {
  const data = useAdmin((s) => s.data)
  const [view, setView] = useState<'month' | 'week'>('month')
  const [day, setDay] = useState(DEMO_TODAY)
  const [assign, setAssign] = useState<CalEvent['target'] | null>(null)
  const evs = events(data)
  const needs = assignableTargets(data).filter((t) => !t.assignment || assignmentIssue(data, t.assignment))
  const month = day.slice(0, 7)
  const first = `${month}-01`
  const [y, m] = month.split('-').map(Number)
  const daysIn = new Date(Date.UTC(y, m, 0)).getUTCDate()

  const cells =
    view === 'month'
      ? [...Array(weekday(first)).fill(null), ...Array.from({ length: daysIn }, (_, i) => addDays(first, i))]
      : Array.from({ length: 7 }, (_, i) => addDays(day, i - weekday(day)))
  const rank = (e: CalEvent) => (e.needsVan ? 0 : e.kind === 'block' ? 2 : 1)
  const on = (d: string) => evs.filter((e) => overlaps(e.from, e.to, d, d)).sort((a, b) => rank(a) - rank(b))
  const shift = (n: number) => {
    if (view === 'week') return setDay(addDays(day, n * 7))
    const dt = new Date(Date.UTC(y, m - 1 + n, 1))
    setDay(dt.toISOString().slice(0, 10))
  }
  const selected = on(day)

  return (
    <div>
      <PageHeader title="Calendar" subtitle="Departures, van rentals and fleet blocks. Assign vans to confirmed trips." />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="min-w-0 p-4 sm:p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1">
              <button onClick={() => shift(-1)} aria-label="Previous" className="rounded-lg p-2 text-ink-2 hover:bg-brand-50">
                <ChevronLeft className="size-5" />
              </button>
              <h2 className="min-w-44 text-center font-display text-lg font-semibold" aria-live="polite">
                {view === 'month' ? monthLabel(y, m - 1) : `Week of ${fmtDate(cells[0]!, { year: false })}`}
              </h2>
              <button onClick={() => shift(1)} aria-label="Next" className="rounded-lg p-2 text-ink-2 hover:bg-brand-50">
                <ChevronRight className="size-5" />
              </button>
              <Button size="sm" variant="ghost" onClick={() => setDay(DEMO_TODAY)}>
                Today
              </Button>
            </div>
            <Tabs value={view} onChange={setView} items={[{ key: 'month', label: 'Month' }, { key: 'week', label: 'Week' }]} />
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm">
            {Array.from({ length: 7 }, (_, i) => (
              <div key={i} className="bg-surface-muted px-2 py-1.5 text-center text-xs font-semibold text-ink-2">
                {shortDay(i)}
              </div>
            ))}
            {cells.map((d, i) => {
              if (!d) return <div key={`x${i}`} className="bg-surface" />
              const list = on(d)
              return (
                <button
                  key={d}
                  onClick={() => setDay(d)}
                  aria-pressed={d === day}
                  aria-label={`${fmtDate(d, { weekday: true })}, ${list.length} events`}
                  className={`flex flex-col items-stretch gap-1 bg-surface p-1.5 text-left align-top hover:bg-brand-50 ${view === 'month' ? 'min-h-24' : 'min-h-56'} ${d === day ? 'ring-2 ring-brand-500 ring-inset' : ''}`}
                >
                  <span className={`text-xs font-semibold ${d === DEMO_TODAY ? 'grid size-6 place-items-center rounded-full bg-brand-600 text-white' : d.slice(0, 7) !== month ? 'text-ink-3' : 'text-ink-2'}`}>
                    {+d.slice(8)}
                  </span>
                  {list.slice(0, view === 'month' ? 3 : 8).map((e) => (
                    <span key={e.key} className={`truncate rounded px-1 py-0.5 text-[11px] font-medium ${CHIP[e.kind]}`}>
                      {e.needsVan && '● '}
                      {e.title}
                    </span>
                  ))}
                  {list.length > (view === 'month' ? 3 : 8) && <span className="text-[11px] text-ink-2">+{list.length - 3} more</span>}
                </button>
              )
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-ink-2">
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-brand-100" /> Joiner departure</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-info-bg" /> Van rental</span>
            <span className="flex items-center gap-1.5"><span className="size-3 rounded bg-warn-bg" /> Van maintenance or unavailable</span>
            <span>● needs a van</span>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>{fmtDate(day, { weekday: true })}</SectionTitle>
            {selected.length === 0 ? (
              <p className="text-sm text-ink-2">No trips or fleet blocks on this day.</p>
            ) : (
              <ul className="space-y-3">
                {selected.map((e) => (
                  <li key={e.key} className="rounded-xl border border-line p-3">
                    <div className="flex items-start justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-ink">
                        {e.kind === 'block' ? <Wrench className="size-4 text-warn" aria-hidden /> : <CarFront className="size-4 text-brand-600" aria-hidden />}
                        {e.title}
                      </p>
                      {e.needsVan && <Badge tone="warn">Needs van</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-ink-2">{shortRange(e.from, e.to)}</p>
                    <p className="mt-1 text-sm text-ink-2">{e.detail}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {e.target && e.to >= DEMO_TODAY && (
                        <Button size="sm" variant={e.needsVan ? 'primary' : 'secondary'} onClick={() => setAssign(e.target)}>
                          {e.target.assignment ? 'Change van' : 'Assign van and driver'}
                        </Button>
                      )}
                      {e.link && (
                        <Link to={e.link} className="inline-flex h-8 items-center px-2 text-sm font-semibold text-brand-700 hover:underline">
                          {e.kind === 'block' ? 'Fleet' : 'Bookings'}
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle>Needs assignment</SectionTitle>
            {needs.length === 0 ? (
              <p className="text-sm text-ink-2">Every confirmed trip has a van and driver.</p>
            ) : (
              <ul className="divide-y divide-line">
                {needs.map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-3 py-2.5">
                    <div>
                      <p className="text-sm font-semibold text-ink">{t.label}</p>
                      <p className="text-xs text-ink-2">
                        {shortRange(t.from, t.to)} · {t.pax} pax · {t.id}
                      </p>
                      {t.assignment && <p className="text-xs font-semibold text-bad">Needs reassignment · {assignmentIssue(data, t.assignment)}</p>}
                    </div>
                    <Button size="sm" onClick={() => { setDay(t.from); setAssign(t) }}>
                      {t.assignment ? 'Reassign' : 'Assign'}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      {assign && <AssignDialog target={assign} onClose={() => setAssign(null)} />}
    </div>
  )
}
