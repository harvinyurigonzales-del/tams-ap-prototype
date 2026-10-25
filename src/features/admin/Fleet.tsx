import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { blockEnd, nextAssignment, shortRange, vehicleStatusOn } from '../../domain/rules'
import { DEMO_TODAY, overlaps } from '../../lib/demoClock'
import { fmtDate } from '../../lib/format'
import { useAdmin, useIsAdmin, type DriverInput, type VehicleInput } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import type { Assignment, Dataset, Driver, Vehicle } from '../../seed/types'
import { StatusBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { Select, TextField } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { initials, PageHeader } from './AdminRoutes'
import { DetailCard, FormDialog, MiniKpi, Table, td } from './common'

const targetName = (d: Dataset, a: Assignment) => {
  if (a.target.kind === 'booking') {
    const b = d.bookings.find((x) => x.id === a.target.id)
    return `Van rental · ${b?.rental?.destination ?? a.target.id}`
  }
  const dep = d.departures.find((x) => x.id === a.target.id)
  return d.services.find((s) => s.id === dep?.serviceId)?.name ?? a.target.id
}

const upcomingFor = (d: Dataset, key: 'vehicleId' | 'driverId', id: string) =>
  d.assignments.filter((a) => a[key] === id && a.to >= DEMO_TODAY).sort((a, b) => a.from.localeCompare(b.from))

const VIEW_ONLY = 'View only. An admin can add, edit or remove fleet records.'

function Upcoming({ list, data }: { list: Assignment[]; data: Dataset }) {
  if (list.length === 0) return <p className="text-sm text-ink-2">No upcoming trips.</p>
  return (
    <ul className="space-y-1.5 text-sm">
      {list.map((a) => (
        <li key={a.id} className="flex justify-between gap-3">
          <span className="text-ink">{targetName(data, a)}</span>
          <span className="shrink-0 text-ink-2 tnum">{shortRange(a.from, a.to)}</span>
        </li>
      ))}
    </ul>
  )
}

const H3 = ({ children }: { children: React.ReactNode }) => <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{children}</h3>

export function Vehicles() {
  const { data, maintenance, deleteVehicle } = useAdmin()
  const admin = useIsAdmin()
  const toast = useUi((s) => s.toast)
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<Vehicle | 'new' | null>(null)
  const [del, setDel] = useState(false)
  const statuses = data.vehicles.map((v) => vehicleStatusOn(data, v))
  const sel = data.vehicles.find((v) => v.id === params.get('id'))
  const cat = sel && data.vehicleCategories.find((c) => c.id === sel.categoryId)
  return (
    <div>
      <PageHeader
        title="Vehicles"
        subtitle={admin ? 'Vans, their status today and what is coming up.' : VIEW_ONLY}
        actions={
          admin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit('new')}>
              Add van
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {(['Available', 'On a trip', 'Maintenance', 'Unavailable'] as const).map((s) => (
          <MiniKpi key={s} label={s} value={statuses.filter((x) => x === s).length} />
        ))}
      </div>
      <div className={`grid gap-6 ${sel ? 'xl:grid-cols-[1fr_380px]' : ''}`}>
        <Card className="min-w-0">
          <Table head={['Van', 'Model', 'Plate', 'Seats', 'Today', 'Next assignment']}>
            {data.vehicles.map((v, i) => {
              const next = nextAssignment(data, { vehicleId: v.id })
              return (
                <tr key={v.id} className={sel?.id === v.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}>
                  <td className={td}>
                    <button className="font-semibold text-brand-700 hover:underline" onClick={() => setParams({ id: v.id })} aria-label={`${v.name} details`}>
                      {v.name}
                    </button>
                  </td>
                  <td className={td}>{v.model}</td>
                  <td className={td}>{v.plate}</td>
                  <td className={`${td} tnum`}>{v.seats}</td>
                  <td className={td}>
                    <StatusBadge status={statuses[i]} />
                  </td>
                  <td className={td}>{next ? `${targetName(data, next)} · ${shortRange(next.from, next.to)}` : '—'}</td>
                </tr>
              )
            })}
          </Table>
        </Card>
        {sel && (
          <DetailCard label={`${sel.name} details`} title={sel.name} subtitle={`${sel.model} · ${sel.plate}`} onClose={() => setParams({})}>
            {cat && <Picture image={cat.image} className="mb-4 aspect-[16/9] rounded-xl" sizes="380px" />}
            <Row label="Today">
              <StatusBadge status={vehicleStatusOn(data, sel)} />
            </Row>
            <Row label="Type">{cat?.name ?? '—'}</Row>
            <Row label="Seats">{sel.seats}</Row>
            <Row label="Color">{sel.color || '—'}</Row>
            <Row label="Odometer">{sel.odometer ? `${sel.odometer.toLocaleString('en-PH')} km` : '—'}</Row>
            <H3>Upcoming trips</H3>
            <Upcoming list={upcomingFor(data, 'vehicleId', sel.id)} data={data} />
            <H3>Out of service</H3>
            {sel.blocks.length === 0 ? (
              <p className="text-sm text-ink-2">Nothing scheduled.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {sel.blocks.map((b, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span className="text-ink">{b.note}</span>
                    <span className="shrink-0 text-ink-2 tnum">
                      {b.untilDone && b.to < DEMO_TODAY ? 'Overdue' : shortRange(b.from, blockEnd(b))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-2 text-sm">
              <Link to={`/admin/maintenance?van=${sel.id}`} className="font-semibold text-brand-700 hover:underline">
                Maintenance history ({maintenance.filter((m) => m.vehicleId === sel.id).length})
              </Link>
            </p>
            {admin ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEdit(sel)}>
                  Edit
                </Button>
                <Button variant="secondary" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDel(true)}>
                  Remove van
                </Button>
              </div>
            ) : (
              <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">{VIEW_ONLY}</p>
            )}
          </DetailCard>
        )}
      </div>
      <VehicleForm key={edit === 'new' ? 'new' : edit?.id ?? 'none'} target={edit} onClose={() => setEdit(null)} />
      {sel && (
        <ConfirmDialog
          open={del}
          onClose={() => setDel(false)}
          title={`Remove ${sel.name}?`}
          body="The van is removed from the fleet list and can no longer be assigned. Past trips keep their records."
          confirmLabel="Remove van"
          tone="danger"
          onConfirm={() => {
            const r = deleteVehicle(sel.id)
            if (!r.ok) return r.error
            setParams({})
            toast(`${sel.name} removed.`)
          }}
        />
      )}
    </div>
  )
}

function VehicleForm({ target, onClose }: { target: Vehicle | 'new' | null; onClose: () => void }) {
  const { data, saveVehicle } = useAdmin()
  const toast = useUi((s) => s.toast)
  const v = target && target !== 'new' ? target : undefined
  const n = data.vehicles.length + 1
  const [f, setF] = useState<VehicleInput>(() => ({
    name: v?.name ?? `Van ${String(n).padStart(2, '0')}`, model: v?.model ?? '', plate: v?.plate ?? '', seats: v?.seats ?? 12,
    categoryId: v?.categoryId ?? data.vehicleCategories[0].id, color: v?.color ?? '', odometer: v?.odometer ?? 0,
  }))
  return (
    <FormDialog
      open={!!target}
      onClose={onClose}
      title={v ? `Edit ${v.name}` : 'Add a van'}
      saveLabel={v ? 'Save changes' : 'Add van'}
      onSave={() => {
        const r = saveVehicle(v?.id ?? null, f)
        if (!r.ok) return r.error
        toast(v ? 'Van details saved.' : `${f.name} added to the fleet.`)
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
        <TextField label="Plate number" value={f.plate} onChange={(e) => setF({ ...f, plate: e.target.value })} placeholder="TMS 1007" />
      </div>
      <TextField label="Make, model and year" value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} placeholder="Toyota Hiace (2024)" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Type" value={f.categoryId} onChange={(e) => setF({ ...f, categoryId: e.target.value })}>
          {data.vehicleCategories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <TextField label="Seats" type="number" inputMode="numeric" min={4} max={18} value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} />
        <TextField label="Color (optional)" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
        <TextField label="Odometer, km (optional)" type="number" inputMode="numeric" min={0} value={f.odometer || ''} onChange={(e) => setF({ ...f, odometer: Number(e.target.value) || 0 })} />
      </div>
    </FormDialog>
  )
}

const driverStatus = (data: Dataset, d: Driver) => {
  const onLeave = d.blocks.some((b) => overlaps(b.from, b.to, DEMO_TODAY, DEMO_TODAY))
  const busy = data.assignments.some((a) => a.driverId === d.id && overlaps(a.from, a.to, DEMO_TODAY, DEMO_TODAY))
  return onLeave ? 'On leave' : busy ? 'On a trip' : 'Available'
}

export function Drivers() {
  const { data, deleteDriver } = useAdmin()
  const admin = useIsAdmin()
  const toast = useUi((s) => s.toast)
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<Driver | 'new' | null>(null)
  const [del, setDel] = useState(false)
  const sel = data.drivers.find((d) => d.id === params.get('id'))
  const soon = (d: Driver) => !!d.licenseExpiry && d.licenseExpiry <= fmtIso(addMonths(DEMO_TODAY, 3))
  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={admin ? 'Drivers, their license and their next trips.' : VIEW_ONLY}
        actions={
          admin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit('new')}>
              Add driver
            </Button>
          )
        }
      />
      <div className={`grid gap-6 ${sel ? 'xl:grid-cols-[1fr_380px]' : ''}`}>
        <Card className="min-w-0">
          <Table head={['Driver', 'Mobile', 'Today', 'License expiry', 'Next assignment']}>
            {data.drivers.map((d) => {
              const next = nextAssignment(data, { driverId: d.id })
              return (
                <tr key={d.id} className={sel?.id === d.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}>
                  <td className={td}>
                    <button className="font-semibold text-brand-700 hover:underline" onClick={() => setParams({ id: d.id })} aria-label={`${d.name} details`}>
                      {d.name}
                    </button>
                    <span className="block text-xs text-ink-2">{d.id}</span>
                  </td>
                  <td className={td}>{d.mobile}</td>
                  <td className={td}>
                    <StatusBadge status={driverStatus(data, d)} />
                  </td>
                  <td className={`${td} ${soon(d) ? 'font-medium text-warn' : ''}`}>{d.licenseExpiry ? fmtDate(d.licenseExpiry, { year: true }) : '—'}</td>
                  <td className={td}>{next ? `${targetName(data, next)} · ${shortRange(next.from, next.to)}` : '—'}</td>
                </tr>
              )
            })}
          </Table>
        </Card>
        {sel && (
          <DetailCard label={`${sel.name} details`} title={sel.name} subtitle={sel.id} onClose={() => setParams({})}>
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-14 place-items-center rounded-full bg-navy font-display text-lg font-bold text-white" aria-hidden>
                {initials(sel.name)}
              </span>
              <StatusBadge status={driverStatus(data, sel)} />
            </div>
            <Row label="Mobile">{sel.mobile}</Row>
            <Row label="License no.">{sel.license ?? '—'}</Row>
            <Row label="License expiry">
              <span className={soon(sel) ? 'font-medium text-warn' : ''}>
                {sel.licenseExpiry ? fmtDate(sel.licenseExpiry, { year: true }) : '—'}
                {soon(sel) && ' · renew soon'}
              </span>
            </Row>
            <Row label="Driving with TAMS since">{sel.since ? fmtDate(sel.since, { year: true }) : '—'}</Row>
            <H3>Upcoming trips</H3>
            <Upcoming list={upcomingFor(data, 'driverId', sel.id)} data={data} />
            <H3>Leave</H3>
            {sel.blocks.length === 0 ? (
              <p className="text-sm text-ink-2">No leave scheduled.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {sel.blocks.map((b, i) => (
                  <li key={i}>
                    {b.note} · {shortRange(b.from, b.to)}
                  </li>
                ))}
              </ul>
            )}
            {admin ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEdit(sel)}>
                  Edit
                </Button>
                <Button variant="secondary" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDel(true)}>
                  Remove driver
                </Button>
              </div>
            ) : (
              <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">{VIEW_ONLY}</p>
            )}
          </DetailCard>
        )}
      </div>
      <DriverForm key={edit === 'new' ? 'new' : edit?.id ?? 'none'} target={edit} onClose={() => setEdit(null)} />
      {sel && (
        <ConfirmDialog
          open={del}
          onClose={() => setDel(false)}
          title={`Remove ${sel.name}?`}
          body="The driver is removed from the list and can no longer be assigned. Past trips keep their records."
          confirmLabel="Remove driver"
          tone="danger"
          onConfirm={() => {
            const r = deleteDriver(sel.id)
            if (!r.ok) return r.error
            setParams({})
            toast(`${sel.name} removed.`)
          }}
        />
      )}
    </div>
  )
}

const addMonths = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + n)
  return d
}
const fmtIso = (d: Date) => d.toISOString().slice(0, 10)

function DriverForm({ target, onClose }: { target: Driver | 'new' | null; onClose: () => void }) {
  const saveDriver = useAdmin((s) => s.saveDriver)
  const toast = useUi((s) => s.toast)
  const d = target && target !== 'new' ? target : undefined
  const [f, setF] = useState<DriverInput>(() => ({ name: d?.name ?? '', mobile: d?.mobile ?? '', license: d?.license ?? '', licenseExpiry: d?.licenseExpiry ?? '', since: d?.since ?? DEMO_TODAY }))
  return (
    <FormDialog
      open={!!target}
      onClose={onClose}
      title={d ? `Edit ${d.name}` : 'Add a driver'}
      saveLabel={d ? 'Save changes' : 'Add driver'}
      onSave={() => {
        const r = saveDriver(d?.id ?? null, f)
        if (!r.ok) return r.error
        toast(d ? 'Driver details saved.' : `${f.name.trim()} added.`)
      }}
    >
      <TextField label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <TextField label="Mobile" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} placeholder="09XX XXX XXXX" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="License number" value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} placeholder="N01-24-000000" />
        <TextField label="License expiry" type="date" value={f.licenseExpiry} onChange={(e) => setF({ ...f, licenseExpiry: e.target.value })} />
      </div>
      <TextField label="Driving with TAMS since" type="date" value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} />
    </FormDialog>
  )
}
