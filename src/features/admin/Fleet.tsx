import { useAdmin } from '../../state/adminStore'
import { nextAssignment, shortRange, vehicleStatusOn } from '../../domain/rules'
import { DEMO_TODAY, overlaps } from '../../lib/demoClock'
import { StatusBadge } from '../../ui/Badge'
import { Card } from '../../ui/Card'
import { PageHeader } from './AdminRoutes'
import { MiniKpi, Table, td } from './common'
import type { Assignment, Dataset } from '../../seed/types'

const targetName = (d: Dataset, a: Assignment) => {
  if (a.target.kind === 'booking') {
    const b = d.bookings.find((x) => x.id === a.target.id)
    return `Van rental · ${b?.rental?.destination ?? a.target.id}`
  }
  const dep = d.departures.find((x) => x.id === a.target.id)
  return d.services.find((s) => s.id === dep?.serviceId)?.name ?? a.target.id
}

const NOTE = 'Read-only in the prototype. Adding or editing fleet records is not included.'

export function Vehicles() {
  const data = useAdmin((s) => s.data)
  const statuses = data.vehicles.map((v) => vehicleStatusOn(data, v))
  return (
    <div>
      <PageHeader title="Vehicles" subtitle={NOTE} />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['Available', 'On a trip', 'Maintenance', 'Unavailable'] as const).map((s) => (
          <MiniKpi key={s} label={s} value={statuses.filter((x) => x === s).length} />
        ))}
      </div>
      <Card className="min-w-0">
        <Table head={['Van', 'Model', 'Plate', 'Seats', 'Today', 'Blocks', 'Next assignment']}>
          {data.vehicles.map((v, i) => {
            const next = nextAssignment(data, { vehicleId: v.id })
            return (
              <tr key={v.id}>
                <td className={`${td} font-semibold text-ink`}>{v.name}</td>
                <td className={td}>{v.model}</td>
                <td className={td}>{v.plate}</td>
                <td className={`${td} tnum`}>{v.seats}</td>
                <td className={td}>
                  <StatusBadge status={statuses[i]} />
                </td>
                <td className={td}>{v.blocks.map((b) => `${b.note}, ${shortRange(b.from, b.to)}`).join('; ') || '—'}</td>
                <td className={td}>{next ? `${targetName(data, next)} · ${shortRange(next.from, next.to)}` : '—'}</td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </div>
  )
}

export function Drivers() {
  const data = useAdmin((s) => s.data)
  return (
    <div>
      <PageHeader title="Drivers" subtitle={NOTE} />
      <Card className="min-w-0">
        <Table head={['Driver', 'Mobile', 'Today', 'Leave', 'Next assignment']}>
          {data.drivers.map((d) => {
            const onLeave = d.blocks.some((b) => overlaps(b.from, b.to, DEMO_TODAY, DEMO_TODAY))
            const busy = data.assignments.some((a) => a.driverId === d.id && overlaps(a.from, a.to, DEMO_TODAY, DEMO_TODAY))
            const next = nextAssignment(data, { driverId: d.id })
            return (
              <tr key={d.id}>
                <td className={td}>
                  <span className="font-semibold text-ink">{d.name}</span>
                  <span className="block text-xs text-ink-2">{d.id}</span>
                </td>
                <td className={td}>{d.mobile} (sample)</td>
                <td className={td}>
                  <StatusBadge status={onLeave ? 'On leave' : busy ? 'On a trip' : 'Available'} />
                </td>
                <td className={td}>{d.blocks.map((b) => `${b.note} ${shortRange(b.from, b.to)}`).join('; ') || '—'}</td>
                <td className={td}>{next ? `${targetName(data, next)} · ${shortRange(next.from, next.to)}` : '—'}</td>
              </tr>
            )
          })}
        </Table>
      </Card>
    </div>
  )
}
