import { Lock } from 'lucide-react'
import { fmtDate, peso } from '../../../lib/format'
import type { PlannedTrip } from '../../../seed/types'
import { Badge } from '../../../ui/Badge'

const GROUPS = [
  { id: 'shared', title: 'Shared by the group' },
  { id: 'person', title: 'Per person' },
  { id: 'optional', title: 'Optional' },
  { id: 'quote', title: 'Awaiting quote' },
] as const

export const plannedDates = (p: PlannedTrip | undefined) => (p?.datesTbd ? `Dates to be agreed${p.datesNote ? ` · ${p.datesNote}` : ''}` : undefined)

export function plannedBudget(p: PlannedTrip) {
  if (p.budgetBasis === 'help' || !p.budgetAmount) return 'Asked us to estimate'
  return p.budgetBasis === 'person' ? `${peso(p.budgetAmount)} per person` : `${peso(p.budgetAmount)} for the group`
}

/** Read-only view of a plan sent from the trip planner, for the customer's request page and the staff view. */
export function PlannedTripView({ plan: p, staff = false }: { plan: PlannedTrip; staff?: boolean }) {
  return (
    <div className="space-y-4 text-sm">
      <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        <Item label="Group">{p.groupType}{p.children ? `, ${p.children} children` : ''}{p.seniors ? `, ${p.seniors} seniors` : ''}</Item>
        <Item label="Pace">{p.pace}</Item>
        <Item label="Budget">{plannedBudget(p)}</Item>
        <Item label="Rooms">{p.lodging}</Item>
        {p.interests.length > 0 && <Item label="Interests">{p.interests.join(', ')}</Item>}
        {p.mustVisit && <Item label="Must visit">{p.mustVisit}</Item>}
        {p.accessibility && <Item label="Accessibility">{p.accessibility}</Item>}
        {p.dietary && <Item label="Dietary">{p.dietary}</Item>}
      </dl>

      {p.issues.length > 0 && (
        <div className="rounded-xl bg-warn-bg px-3 py-2.5 text-warn">
          <p className="font-semibold">{staff ? 'Open issues from the customer’s plan' : 'Open items for staff'}</p>
          <ul className="mt-1 list-disc pl-5">{p.issues.map((i) => <li key={i}>{i}</li>)}</ul>
        </div>
      )}

      <ol className="space-y-3">
        {p.itinerary.map((d) => (
          <li key={d.day} className="rounded-xl border border-line p-3">
            <p className="font-semibold text-ink">
              Day {d.day} <span className="font-normal text-ink-2">· {d.date ? fmtDate(d.date, { weekday: true, year: false }) : d.label}</span>
            </p>
            <ul className="mt-1.5 space-y-0.5">
              {d.items.map((i, k) => {
                const stop = i.kind === 'stop' ? p.stops.find((s) => s.name === i.title && s.day === d.day) : undefined
                return (
                  <li key={k} className={`flex flex-wrap items-center gap-x-2 ${i.kind === 'stop' ? 'text-ink' : 'text-ink-2'}`}>
                    {i.time && <span className="tnum w-16 shrink-0 text-xs text-ink-3">{i.time}</span>}
                    <span className={i.kind === 'stop' ? 'font-medium' : ''}>{i.title}</span>
                    {stop?.locked && <Badge tone="brand"><Lock className="size-3" aria-hidden /> Kept</Badge>}
                    {(stop?.custom || i.review) && <Badge tone={stop?.custom ? 'warn' : 'info'}>{stop?.custom ? 'For staff review' : i.review}</Badge>}
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ol>

      <div>
        <p className="font-semibold text-ink">
          Estimate: {peso(p.perPerson)} per person · {peso(p.total)} for the group
        </p>
        <div className="mt-2 grid gap-3 sm:grid-cols-2">
          {GROUPS.map((g) => {
            const xs = p.estimate.filter((l) => l.group === g.id)
            if (!xs.length) return null
            return (
              <div key={g.id}>
                <p className="text-xs font-semibold tracking-wide text-ink-3 uppercase">{g.title}</p>
                <ul className="mt-1 space-y-0.5">
                  {xs.map((l) => (
                    <li key={l.label} className="flex justify-between gap-3 text-ink-2">
                      <span>{l.label}</span>
                      <span className="tnum shrink-0 text-ink">{l.amount !== undefined ? peso(l.amount) : 'To quote'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-ink-3">Estimated cost · final quotation from TAMS-AP</p>
      </div>
    </div>
  )
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 text-ink-3">{label}</dt>
      <dd className="text-ink">{children}</dd>
    </div>
  )
}
