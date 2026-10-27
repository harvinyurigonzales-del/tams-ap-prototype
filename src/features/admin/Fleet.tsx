import { AlertTriangle, CalendarX2, Pencil, Plus, Power, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { affectedTrips, assignmentBookings, assignmentIssue, assignmentLabel, driverStatusOn, isActive, maintenanceView, type DriverStatus } from '../../domain/fleet'
import { assignableTargets, blockEnd, nextAssignment, shortRange, vehicleStatusOn } from '../../domain/rules'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, peso } from '../../lib/format'
import { useAdmin, useIsAdmin, type DriverInput, type PeriodInput, type VehicleInput } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import type { Assignment, Block, Dataset, Driver, Vehicle, VehicleCondition } from '../../seed/types'
import { Badge, StatusBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { FilterSelect, Select, TextArea, TextField } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { AssignDialog } from './Assign'
import { initials, PageHeader } from './AdminRoutes'
import { ActivityHistory, DetailCard, EmptyList, FilterBar, FilterTile, FormDialog, SearchInput, Table, td } from './common'
import { PhotoPicker } from './Photo'

// Vans and drivers. Active, assigned, in maintenance and unavailable are kept apart: an inactive van keeps its
// history; a van on leave from service for a few days is still active. When a van or driver stops being available
// for a trip already assigned, the trip shows "Needs reassignment" until staff choose another.

const VIEW_ONLY = 'View only. An admin can add, edit or deactivate fleet records.'
const CONDITIONS: VehicleCondition[] = ['Good', 'Minor issues', 'Not roadworthy']
const VAN_REASONS = ['Under repair', 'Registration renewal', 'Reserved for company use', 'Accident damage']
const DRIVER_REASONS = ['On leave', 'Sick leave', 'Training', 'Personal matters']

const upcomingFor = (d: Dataset, key: 'vehicleId' | 'driverId', id: string) =>
  d.assignments.filter((a) => a[key] === id && a.to >= DEMO_TODAY).sort((a, b) => a.from.localeCompare(b.from))
const pastFor = (d: Dataset, key: 'vehicleId' | 'driverId', id: string) =>
  d.assignments.filter((a) => a[key] === id && a.to < DEMO_TODAY).sort((a, b) => b.from.localeCompare(a.from))

const H3 = ({ children }: { children: React.ReactNode }) => <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">{children}</h3>

/** Upcoming trips with their bookings; a trip that can no longer run as assigned offers reassignment. */
function TripList({ list, data, onReassign }: { list: Assignment[]; data: Dataset; onReassign: (a: Assignment) => void }) {
  if (list.length === 0) return <p className="text-sm text-ink-2">No upcoming trips.</p>
  return (
    <ul className="space-y-2 text-sm">
      {list.map((a) => {
        const issue = assignmentIssue(data, a)
        const refs = assignmentBookings(data, a).map((b) => b.id)
        return (
          <li key={a.id} className={issue ? 'rounded-lg bg-bad-bg px-2.5 py-2' : ''}>
            <div className="flex justify-between gap-3">
              <span className="text-ink">{assignmentLabel(data, a)}</span>
              <span className="shrink-0 text-ink-2 tnum">{shortRange(a.from, a.to)}</span>
            </div>
            {refs.length > 0 && <p className="text-xs text-ink-3">{refs.join(', ')}</p>}
            {issue && (
              <div className="mt-1 flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1 text-xs font-semibold text-bad">
                  <AlertTriangle className="size-3.5" aria-hidden /> Needs reassignment · {issue}
                </span>
                <Button size="sm" variant="secondary" onClick={() => onReassign(a)}>
                  Reassign
                </Button>
              </div>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Unavailable periods, each editable and removable by an admin. */
function Periods({ blocks, admin, onEdit, onRemove, empty }: { blocks: Block[]; admin: boolean; onEdit: (b: Block) => void; onRemove: (b: Block) => void; empty: string }) {
  const shown = blocks.filter((b) => blockEnd(b) >= DEMO_TODAY).sort((a, b) => a.from.localeCompare(b.from))
  if (shown.length === 0) return <p className="text-sm text-ink-2">{empty}</p>
  return (
    <ul className="space-y-1.5 text-sm">
      {shown.map((b) => (
        <li key={b.id ?? b.from} className="flex items-center justify-between gap-3">
          <span className="text-ink">
            {b.note}
            <span className="block text-xs text-ink-2 tnum">{b.untilDone && b.to < DEMO_TODAY ? `Since ${fmtDate(b.from, { year: false })} · overdue` : shortRange(b.from, b.to)}</span>
          </span>
          {admin && b.kind !== 'maintenance' && b.id && (
            <span className="flex shrink-0 gap-1">
              <button type="button" onClick={() => onEdit(b)} className="rounded-lg px-2 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50" aria-label={`Edit ${b.note}, ${shortRange(b.from, b.to)}`}>
                Edit
              </button>
              <button type="button" onClick={() => onRemove(b)} className="rounded-lg px-2 py-1 text-xs font-semibold text-ink-2 hover:bg-surface-muted" aria-label={`Remove ${b.note}, ${shortRange(b.from, b.to)}`}>
                Remove
              </button>
            </span>
          )}
          {b.kind === 'maintenance' && (
            <Link to="/admin/maintenance" className="shrink-0 text-xs font-semibold text-brand-700 hover:underline">
              Maintenance
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

/** Add or change an unavailable period. Shows which assigned trips it would affect before saving. */
function PeriodDialog({ title, who, reasons, initial, onClose, onSave }: {
  title: string; who: { vehicleId?: string; driverId?: string }; reasons: string[]; initial?: Block; onClose: () => void; onSave: (x: PeriodInput) => { ok: true } | { ok: false; error: string }
}) {
  const data = useAdmin((s) => s.data)
  const toast = useUi((s) => s.toast)
  const known = !initial || reasons.includes(initial.note)
  const [f, setF] = useState({ from: initial?.from ?? DEMO_TODAY, to: initial?.to ?? DEMO_TODAY, reason: known ? (initial?.note ?? reasons[0]) : 'Other', other: known ? '' : (initial?.note ?? '') })
  const trips = f.from && f.to && f.to >= f.from ? affectedTrips(data, who, f.from, f.to) : []
  return (
    <FormDialog
      open
      onClose={onClose}
      title={title}
      saveLabel={initial ? 'Save period' : 'Mark unavailable'}
      onSave={() => {
        const r = onSave({ id: initial?.id, from: f.from, to: f.to, note: f.reason === 'Other' ? f.other : f.reason })
        if (!r.ok) return r.error
        toast(trips.length ? `Saved. ${trips.length} ${trips.length === 1 ? 'trip needs' : 'trips need'} reassignment.` : 'Saved.')
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="From" type="date" min={initial && initial.from < DEMO_TODAY ? initial.from : DEMO_TODAY} value={f.from} onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })} />
        <TextField label="To" type="date" min={f.from > DEMO_TODAY ? f.from : DEMO_TODAY} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </div>
      <Select label="Reason" value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })}>
        {[...reasons, 'Other'].map((r) => (
          <option key={r}>{r}</option>
        ))}
      </Select>
      {f.reason === 'Other' && <TextField label="Describe the reason" value={f.other} onChange={(e) => setF({ ...f, other: e.target.value })} />}
      {trips.length > 0 && (
        <div role="status" className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
          <p className="font-semibold">
            {trips.length} assigned {trips.length === 1 ? 'trip falls' : 'trips fall'} in this period
          </p>
          <ul className="mt-1 list-disc pl-4">
            {trips.map((a) => (
              <li key={a.id}>
                {assignmentLabel(data, a)}, {shortRange(a.from, a.to)}
                {assignmentBookings(data, a).length > 0 && ` (${assignmentBookings(data, a).map((b) => b.id).join(', ')})`}
              </li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Saving marks {trips.length === 1 ? 'it' : 'them'} “Needs reassignment” so staff can choose another.</p>
        </div>
      )}
    </FormDialog>
  )
}

/** Deactivate (with a reason and the trips it affects) or reactivate a van or driver. */
function ActiveDialog({ name, active, trips, data, onClose, onSave }: { name: string; active: boolean; trips: Assignment[]; data: Dataset; onClose: () => void; onSave: (reason: string) => { ok: true } | { ok: false; error: string } }) {
  const toast = useUi((s) => s.toast)
  const [reason, setReason] = useState('')
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      title={active ? `Deactivate ${name}?` : `Reactivate ${name}?`}
      body={active ? `${name} keeps its history but cannot be assigned to new trips.` : `${name} can be assigned to trips again.`}
      confirmLabel={active ? 'Deactivate' : 'Reactivate'}
      tone={active ? 'danger' : 'primary'}
      onConfirm={() => {
        const r = onSave(reason)
        if (!r.ok) return r.error
        toast(active ? `${name} deactivated.` : `${name} reactivated.`)
      }}
    >
      {active && (
        <div className="mt-3 space-y-3">
          <TextArea label="Reason" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Sold, or resigned" />
          {trips.length > 0 && (
            <div className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
              <p className="font-semibold">These upcoming trips will need reassignment</p>
              <ul className="mt-1 list-disc pl-4">
                {trips.map((a) => (
                  <li key={a.id}>
                    {assignmentLabel(data, a)}, {shortRange(a.from, a.to)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </ConfirmDialog>
  )
}

function useReassign() {
  const data = useAdmin((s) => s.data)
  const [target, setTarget] = useState<Assignment | null>(null)
  const t = target && assignableTargets(data).find((x) => x.kind === target.target.kind && x.id === target.target.id)
  return { open: setTarget, dialog: t ? <AssignDialog target={t} onClose={() => setTarget(null)} /> : null }
}

type VanStatus = 'Available' | 'On a trip' | 'Maintenance' | 'Unavailable' | 'Inactive'
const VAN_TILES: { key: VanStatus; note: string; tone: 'ok' | 'info' | 'warn' | 'bad' | 'neutral' }[] = [
  { key: 'Available', note: 'Free today', tone: 'ok' },
  { key: 'On a trip', note: 'Assigned today', tone: 'info' },
  { key: 'Maintenance', note: 'In the shop', tone: 'warn' },
  { key: 'Unavailable', note: 'Marked out of service', tone: 'bad' },
  { key: 'Inactive', note: 'Kept for history', tone: 'neutral' },
]

export function Vehicles() {
  const { data, maintenance, deleteVehicle, setVehicleActive, saveVehicleBlock, removeVehicleBlock } = useAdmin()
  const admin = useIsAdmin()
  const toast = useUi((s) => s.toast)
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<Vehicle | 'new' | null>(null)
  const [del, setDel] = useState(false)
  const [activeDlg, setActiveDlg] = useState(false)
  const [period, setPeriod] = useState<Block | 'new' | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<VanStatus | ''>('')
  const [type, setType] = useState('')
  const reassign = useReassign()
  const statusOf = (v: Vehicle) => vehicleStatusOn(data, v) as VanStatus
  const needle = q.trim().toLowerCase()
  const rows = data.vehicles.filter(
    (v) => (!status || statusOf(v) === status) && (!type || v.categoryId === type) && (!needle || `${v.id} ${v.name} ${v.plate} ${v.model} ${v.color ?? ''}`.toLowerCase().includes(needle)),
  )
  const filtered = !!status || !!type || !!needle
  const reset = () => (setQ(''), setStatus(''), setType(''))
  const sel = data.vehicles.find((v) => v.id === params.get('id'))
  const cat = sel && data.vehicleCategories.find((c) => c.id === sel.categoryId)
  const flagged = (v: Vehicle) => upcomingFor(data, 'vehicleId', v.id).filter((a) => assignmentIssue(data, a)).length
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
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {VAN_TILES.map((t) => (
          <FilterTile key={t.key} label={t.key} value={data.vehicles.filter((v) => statusOf(v) === t.key).length} note={t.note} tone={t.tone} active={status === t.key} onClick={() => setStatus(status === t.key ? '' : t.key)} />
        ))}
      </div>
      <div className={`grid gap-6 ${sel ? 'xl:grid-cols-[1fr_400px]' : ''}`}>
        <Card className="min-w-0">
          <FilterBar active={filtered} onReset={reset} count={rows.length} noun={['van', 'vans']}>
            <SearchInput value={q} onChange={setQ} placeholder="Search name, plate or model" />
            <FilterSelect label="Type" value={type} onChange={(e) => setType(e.target.value)}>
              <option value="">All types</option>
              {data.vehicleCategories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value as VanStatus | '')}>
              <option value="">All statuses</option>
              {VAN_TILES.map((t) => (
                <option key={t.key}>{t.key}</option>
              ))}
            </FilterSelect>
          </FilterBar>
          <Table head={['Van', 'Model', 'Plate', 'Seats', 'Condition', 'Today', 'Next assignment']} empty={rows.length === 0 && <EmptyList filtered={filtered} onReset={reset}>No vans yet. Add the first one.</EmptyList>}>
            {rows.map((v) => {
              const next = nextAssignment(data, { vehicleId: v.id })
              const n = flagged(v)
              return (
                <tr key={v.id} className={sel?.id === v.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}>
                  <td className={td}>
                    <button className="font-semibold text-brand-700 hover:underline" onClick={() => setParams({ id: v.id })} aria-label={`${v.name} details`}>
                      {v.name}
                    </button>
                    {n > 0 && <span className="block text-xs font-semibold text-bad">{n} {n === 1 ? 'trip needs' : 'trips need'} reassignment</span>}
                  </td>
                  <td className={td}>{v.model}</td>
                  <td className={td}>{v.plate}</td>
                  <td className={`${td} tnum`}>{v.seats}</td>
                  <td className={td}>{v.condition ?? 'Good'}</td>
                  <td className={td}>
                    <StatusBadge status={statusOf(v)} />
                  </td>
                  <td className={td}>{next ? `${assignmentLabel(data, next)} · ${shortRange(next.from, next.to)}` : '—'}</td>
                </tr>
              )
            })}
          </Table>
        </Card>
        {sel && (
          <DetailCard label={`${sel.name} details`} title={sel.name} subtitle={`${sel.model} · ${sel.plate}`} onClose={() => setParams({})}>
            {(sel.photo ?? cat?.image) && <Picture image={(sel.photo ?? cat?.image)!} className="mb-4 aspect-[16/9] rounded-xl" sizes="400px" />}
            <div className="mb-3 flex flex-wrap gap-1.5">
              <Badge tone={isActive(sel) ? 'ok' : 'neutral'}>{isActive(sel) ? 'Active' : 'Inactive'}</Badge>
              {isActive(sel) && <StatusBadge status={statusOf(sel)} />}
              <Badge tone={sel.condition === 'Not roadworthy' ? 'bad' : sel.condition === 'Minor issues' ? 'warn' : 'neutral'}>Condition: {sel.condition ?? 'Good'}</Badge>
            </div>
            <Row label="Type">{cat?.name ?? '—'}</Row>
            <Row label="Seats">{sel.seats}</Row>
            <Row label="Color">{sel.color || '—'}</Row>
            <Row label="Odometer">{sel.odometer ? `${sel.odometer.toLocaleString('en-PH')} km` : '—'}</Row>
            <H3>Upcoming trips</H3>
            <TripList list={upcomingFor(data, 'vehicleId', sel.id)} data={data} onReassign={reassign.open} />
            <p className="mt-2 text-xs text-ink-3">{pastFor(data, 'vehicleId', sel.id).length} past trips on record.</p>
            <div className="mt-5 mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Out of service</h3>
              {admin && isActive(sel) && (
                <button type="button" onClick={() => setPeriod('new')} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                  <CalendarX2 className="size-3.5" aria-hidden /> Mark unavailable
                </button>
              )}
            </div>
            <Periods
              blocks={sel.blocks}
              admin={admin}
              empty="Nothing scheduled."
              onEdit={(b) => setPeriod(b)}
              onRemove={(b) => {
                const r = removeVehicleBlock(sel.id, b.id!)
                toast(r.ok ? 'Period removed.' : r.error, r.ok ? 'info' : 'error')
              }}
            />
            <H3>Maintenance history</H3>
            {maintenance.filter((m) => m.vehicleId === sel.id).length === 0 ? (
              <p className="text-sm text-ink-2">No maintenance on record.</p>
            ) : (
              <ul className="space-y-1.5 text-sm">
                {maintenance
                  .filter((m) => m.vehicleId === sel.id)
                  .sort((a, b) => b.from.localeCompare(a.from))
                  .slice(0, 5)
                  .map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3">
                      <span className="text-ink">
                        {m.type}
                        <span className="block text-xs text-ink-2 tnum">
                          {shortRange(m.from, m.to)}
                          {m.cost ? ` · ${peso(m.cost)}` : ''}
                        </span>
                      </span>
                      <StatusBadge status={maintenanceView(m)} />
                    </li>
                  ))}
              </ul>
            )}
            <p className="mt-2 text-sm">
              <Link to={`/admin/maintenance?van=${sel.id}`} className="font-semibold text-brand-700 hover:underline">
                Open in Maintenance
              </Link>
            </p>
            {admin ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEdit(sel)}>
                  Edit
                </Button>
                <Button variant="secondary" icon={<Power className="size-4" aria-hidden />} onClick={() => setActiveDlg(true)}>
                  {isActive(sel) ? 'Deactivate' : 'Reactivate'}
                </Button>
                <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDel(true)}>
                  Remove van
                </Button>
              </div>
            ) : (
              <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">{VIEW_ONLY}</p>
            )}
            <ActivityHistory module="Vans" recordId={sel.id} />
          </DetailCard>
        )}
      </div>
      {!sel && <ActivityHistory module="Vans" title="Recent van activity" />}
      <VehicleForm key={edit === 'new' ? 'new' : edit?.id ?? 'none'} target={edit} onClose={() => setEdit(null)} onSaved={(id) => setParams({ id })} />
      {reassign.dialog}
      {sel && period && (
        <PeriodDialog
          title={period === 'new' ? `Mark ${sel.name} unavailable` : `Change ${sel.name} unavailability`}
          who={{ vehicleId: sel.id }}
          reasons={VAN_REASONS}
          initial={period === 'new' ? undefined : period}
          onClose={() => setPeriod(null)}
          onSave={(x) => saveVehicleBlock(sel.id, x)}
        />
      )}
      {sel && activeDlg && (
        <ActiveDialog
          name={sel.name}
          active={isActive(sel)}
          trips={upcomingFor(data, 'vehicleId', sel.id)}
          data={data}
          onClose={() => setActiveDlg(false)}
          onSave={(reason) => setVehicleActive(sel.id, !isActive(sel), reason)}
        />
      )}
      {sel && (
        <ConfirmDialog
          open={del}
          onClose={() => setDel(false)}
          title={`Remove ${sel.name}?`}
          body="Only a van with no trips or maintenance on record can be removed. Otherwise deactivate it, so its history stays."
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

function VehicleForm({ target, onClose, onSaved }: { target: Vehicle | 'new' | null; onClose: () => void; onSaved: (id: string) => void }) {
  const { data, saveVehicle } = useAdmin()
  const toast = useUi((s) => s.toast)
  const v = target && target !== 'new' ? target : undefined
  const n = Math.max(0, ...data.vehicles.map((x) => Number(x.id.slice(4)) || 0)) + 1
  const [f, setF] = useState<VehicleInput>(() => ({
    name: v?.name ?? `Van ${String(n).padStart(2, '0')}`, model: v?.model ?? '', plate: v?.plate ?? '', seats: v?.seats ?? 12,
    categoryId: v?.categoryId ?? data.vehicleCategories[0].id, color: v?.color ?? '', odometer: v?.odometer ?? 0, condition: v?.condition ?? 'Good', photo: v?.photo,
  }))
  const cat = data.vehicleCategories.find((c) => c.id === f.categoryId)
  return (
    <FormDialog
      open={!!target}
      onClose={onClose}
      wide
      title={v ? `Edit ${v.name}` : 'Add a van'}
      saveLabel={v ? 'Save changes' : 'Add van'}
      onSave={() => {
        const r = saveVehicle(v?.id ?? null, f)
        if (!r.ok) return r.error
        toast(v ? 'Van details saved.' : `${f.name} added to the fleet.`)
        if (r.id) onSaved(r.id)
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
        <TextField label="Seats" type="number" inputMode="numeric" min={4} max={18} value={f.seats} onChange={(e) => setF({ ...f, seats: Number(e.target.value) })} hint="4 to 18 passengers" />
        <Select label="Condition" value={f.condition} onChange={(e) => setF({ ...f, condition: e.target.value as VehicleCondition })}>
          {CONDITIONS.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </Select>
        <TextField label="Color (optional)" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} />
        <TextField label="Odometer, km (optional)" type="number" inputMode="numeric" min={0} value={f.odometer || ''} onChange={(e) => setF({ ...f, odometer: Number(e.target.value) || 0 })} />
      </div>
      {f.condition === 'Not roadworthy' && <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">A van that is not roadworthy cannot be assigned. Its upcoming trips will show “Needs reassignment”.</p>}
      <PhotoPicker label="Photo" value={f.photo} fallback={cat?.image} gallery={data.vehicleCategories.map((c) => c.image)} alt={`${f.name}, ${f.model}`} onChange={(photo) => setF({ ...f, photo })} />
    </FormDialog>
  )
}

const DRIVER_TILES: { key: DriverStatus | ''; label: string; note: string; tone: 'ok' | 'info' | 'bad' | 'neutral' }[] = [
  { key: '', label: 'Total', note: 'Active drivers', tone: 'neutral' },
  { key: 'Available', label: 'Available', note: 'Free today', tone: 'ok' },
  { key: 'Assigned', label: 'Assigned', note: 'On a trip today', tone: 'info' },
  { key: 'Unavailable', label: 'Unavailable', note: 'Leave or other reason', tone: 'bad' },
]

export function Drivers() {
  const { data, deleteDriver, setDriverActive, saveDriverBlock, removeDriverBlock } = useAdmin()
  const admin = useIsAdmin()
  const toast = useUi((s) => s.toast)
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<Driver | 'new' | null>(null)
  const [del, setDel] = useState(false)
  const [activeDlg, setActiveDlg] = useState(false)
  const [period, setPeriod] = useState<Block | 'new' | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<DriverStatus | ''>('')
  const reassign = useReassign()
  const statusOf = (d: Driver) => driverStatusOn(data, d)
  const needle = q.trim().toLowerCase()
  const rows = data.drivers.filter((d) => (status ? statusOf(d) === status : true) && (!needle || `${d.id} ${d.name} ${d.mobile} ${d.email ?? ''} ${d.base ?? ''} ${d.license ?? ''}`.toLowerCase().includes(needle)))
  const filtered = !!status || !!needle
  const reset = () => (setQ(''), setStatus(''))
  const sel = data.drivers.find((d) => d.id === params.get('id'))
  const soon = (d: Driver) => !!d.licenseExpiry && d.licenseExpiry <= fmtIso(addMonths(DEMO_TODAY, 3))
  const active = data.drivers.filter(isActive)
  const flagged = (d: Driver) => upcomingFor(data, 'driverId', d.id).filter((a) => assignmentIssue(data, a)).length
  return (
    <div>
      <PageHeader
        title="Drivers"
        subtitle={admin ? 'Drivers, their availability and their next trips.' : VIEW_ONLY}
        actions={
          admin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit('new')}>
              Add driver
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {DRIVER_TILES.map((t) => (
          <FilterTile
            key={t.label}
            label={t.label}
            value={t.key ? active.filter((d) => statusOf(d) === t.key).length : active.length}
            note={t.key ? t.note : `${t.note}${data.drivers.length > active.length ? ` · ${data.drivers.length - active.length} inactive` : ''}`}
            tone={t.tone}
            active={t.key ? status === t.key : !status && !needle}
            onClick={() => (t.key ? setStatus(status === t.key ? '' : t.key) : reset())}
          />
        ))}
      </div>
      <div className={`grid gap-6 ${sel ? 'xl:grid-cols-[1fr_400px]' : ''}`}>
        <Card className="min-w-0">
          <FilterBar active={filtered} onReset={reset} count={rows.length} noun={['driver', 'drivers']}>
            <SearchInput value={q} onChange={setQ} placeholder="Search name, mobile, email or base" />
            <FilterSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value as DriverStatus | '')}>
              <option value="">All statuses</option>
              {(['Available', 'Assigned', 'Unavailable', 'Inactive'] as const).map((s) => (
                <option key={s}>{s}</option>
              ))}
            </FilterSelect>
          </FilterBar>
          <Table head={['Driver', 'Mobile', 'Base', 'Today', 'License expiry', 'Next assignment']} empty={rows.length === 0 && <EmptyList filtered={filtered} onReset={reset}>No drivers yet. Add the first one.</EmptyList>}>
            {rows.map((d) => {
              const next = nextAssignment(data, { driverId: d.id })
              const n = flagged(d)
              return (
                <tr key={d.id} className={sel?.id === d.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}>
                  <td className={td}>
                    <button className="font-semibold text-brand-700 hover:underline" onClick={() => setParams({ id: d.id })} aria-label={`${d.name} details`}>
                      {d.name}
                    </button>
                    <span className="block text-xs text-ink-2">{d.id}</span>
                    {n > 0 && <span className="block text-xs font-semibold text-bad">{n} {n === 1 ? 'trip needs' : 'trips need'} reassignment</span>}
                  </td>
                  <td className={td}>{d.mobile}</td>
                  <td className={td}>{d.base ?? '—'}</td>
                  <td className={td}>
                    <StatusBadge status={statusOf(d)} />
                  </td>
                  <td className={`${td} ${soon(d) ? 'font-medium text-warn' : ''}`}>{d.licenseExpiry ? fmtDate(d.licenseExpiry, { year: true }) : '—'}</td>
                  <td className={td}>{next ? `${assignmentLabel(data, next)} · ${shortRange(next.from, next.to)}` : '—'}</td>
                </tr>
              )
            })}
          </Table>
        </Card>
        {sel && (
          <DetailCard label={`${sel.name} details`} title={sel.name} subtitle={sel.id} onClose={() => setParams({})}>
            <div className="mb-4 flex items-center gap-3">
              {sel.photo ? (
                <Picture image={sel.photo} label={false} sizes="56px" className="size-14 rounded-full" />
              ) : (
                <span className="grid size-14 place-items-center rounded-full bg-navy font-display text-lg font-bold text-white" aria-hidden>
                  {initials(sel.name)}
                </span>
              )}
              <div className="flex flex-wrap gap-1.5">
                <Badge tone={isActive(sel) ? 'ok' : 'neutral'}>{isActive(sel) ? 'Active' : 'Inactive'}</Badge>
                {isActive(sel) && <StatusBadge status={statusOf(sel)} />}
              </div>
            </div>
            <Row label="Mobile">{sel.mobile}</Row>
            <Row label="Email">{sel.email ?? '—'}</Row>
            <Row label="Address or base">{sel.base ?? '—'}</Row>
            <Row label="License no.">{sel.license ?? '—'}</Row>
            <Row label="License expiry">
              <span className={soon(sel) ? 'font-medium text-warn' : ''}>
                {sel.licenseExpiry ? fmtDate(sel.licenseExpiry, { year: true }) : '—'}
                {soon(sel) && ' · renew soon'}
              </span>
            </Row>
            <Row label="Driving with TAMS since">{sel.since ? fmtDate(sel.since, { year: true }) : '—'}</Row>
            <H3>Upcoming trips</H3>
            <TripList list={upcomingFor(data, 'driverId', sel.id)} data={data} onReassign={reassign.open} />
            <p className="mt-2 text-xs text-ink-3">{pastFor(data, 'driverId', sel.id).length} past trips on record.</p>
            <div className="mt-5 mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">Unavailability</h3>
              {admin && isActive(sel) && (
                <button type="button" onClick={() => setPeriod('new')} className="inline-flex items-center gap-1 text-xs font-semibold text-brand-700 hover:underline">
                  <CalendarX2 className="size-3.5" aria-hidden /> Add unavailability
                </button>
              )}
            </div>
            <Periods
              blocks={sel.blocks}
              admin={admin}
              empty="No leave or other unavailability scheduled."
              onEdit={(b) => setPeriod(b)}
              onRemove={(b) => {
                const r = removeDriverBlock(sel.id, b.id!)
                toast(r.ok ? 'Period removed.' : r.error, r.ok ? 'info' : 'error')
              }}
            />
            {admin ? (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={() => setEdit(sel)}>
                  Edit
                </Button>
                <Button variant="secondary" icon={<Power className="size-4" aria-hidden />} onClick={() => setActiveDlg(true)}>
                  {isActive(sel) ? 'Deactivate' : 'Reactivate'}
                </Button>
                <Button variant="ghost" icon={<Trash2 className="size-4" aria-hidden />} onClick={() => setDel(true)}>
                  Remove driver
                </Button>
              </div>
            ) : (
              <p className="mt-5 border-t border-line pt-4 text-xs text-ink-3">{VIEW_ONLY}</p>
            )}
            <ActivityHistory module="Drivers" recordId={sel.id} />
          </DetailCard>
        )}
      </div>
      {!sel && <ActivityHistory module="Drivers" title="Recent driver activity" />}
      <DriverForm key={edit === 'new' ? 'new' : edit?.id ?? 'none'} target={edit} onClose={() => setEdit(null)} onSaved={(id) => setParams({ id })} />
      {reassign.dialog}
      {sel && period && (
        <PeriodDialog
          title={period === 'new' ? `${sel.name}: add unavailability` : `${sel.name}: change unavailability`}
          who={{ driverId: sel.id }}
          reasons={DRIVER_REASONS}
          initial={period === 'new' ? undefined : period}
          onClose={() => setPeriod(null)}
          onSave={(x) => saveDriverBlock(sel.id, x)}
        />
      )}
      {sel && activeDlg && (
        <ActiveDialog
          name={sel.name}
          active={isActive(sel)}
          trips={upcomingFor(data, 'driverId', sel.id)}
          data={data}
          onClose={() => setActiveDlg(false)}
          onSave={(reason) => setDriverActive(sel.id, !isActive(sel), reason)}
        />
      )}
      {sel && (
        <ConfirmDialog
          open={del}
          onClose={() => setDel(false)}
          title={`Remove ${sel.name}?`}
          body="Only a driver with no trips on record can be removed. Otherwise deactivate them, so their history stays."
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

function DriverForm({ target, onClose, onSaved }: { target: Driver | 'new' | null; onClose: () => void; onSaved: (id: string) => void }) {
  const saveDriver = useAdmin((s) => s.saveDriver)
  const toast = useUi((s) => s.toast)
  const d = target && target !== 'new' ? target : undefined
  const [f, setF] = useState<DriverInput>(() => ({
    name: d?.name ?? '', mobile: d?.mobile ?? '', email: d?.email ?? '', base: d?.base ?? '', license: d?.license ?? '', licenseExpiry: d?.licenseExpiry ?? '', since: d?.since ?? DEMO_TODAY, photo: d?.photo,
  }))
  return (
    <FormDialog
      open={!!target}
      onClose={onClose}
      wide
      title={d ? `Edit ${d.name}` : 'Add a driver'}
      saveLabel={d ? 'Save changes' : 'Add driver'}
      onSave={() => {
        const r = saveDriver(d?.id ?? null, f)
        if (!r.ok) return r.error
        toast(d ? 'Driver details saved.' : `${f.name.trim()} added.`)
        if (r.id) onSaved(r.id)
      }}
    >
      <TextField label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Mobile" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} placeholder="09XX XXX XXXX" />
        <TextField label="Email (optional)" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
      </div>
      <TextField label="Address or base (optional)" value={f.base} onChange={(e) => setF({ ...f, base: e.target.value })} placeholder="e.g. Malolos garage" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="License number" value={f.license} onChange={(e) => setF({ ...f, license: e.target.value })} placeholder="N01-24-000000" />
        <TextField label="License expiry" type="date" value={f.licenseExpiry} onChange={(e) => setF({ ...f, licenseExpiry: e.target.value })} />
      </div>
      <TextField label="Driving with TAMS since" type="date" value={f.since} onChange={(e) => setF({ ...f, since: e.target.value })} />
      <PhotoPicker label="Photo (optional)" value={f.photo} gallery={[]} alt={f.name || 'Driver'} onChange={(photo) => setF({ ...f, photo })} />
    </FormDialog>
  )
}
