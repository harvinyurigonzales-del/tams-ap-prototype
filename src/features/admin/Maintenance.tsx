import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Pencil, Play, Plus, Wrench, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isMaintenanceOverdue, maintenanceConflicts, maintenanceView, nextFreeNote, type MaintenanceView } from '../../domain/fleet'
import { shortRange } from '../../domain/rules'
import { addDays, DEMO_TODAY, overlaps } from '../../lib/demoClock'
import { fmtDate, fmtStamp, peso } from '../../lib/format'
import { useAdmin, useIsAdmin, type MaintenanceInput, type MaintenanceRecord } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import { StatusBadge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { Dialog } from '../../ui/Dialog'
import { FilterSelect, Select, TextArea, TextField } from '../../ui/Field'
import { PageHeader } from './AdminRoutes'
import { ActivityHistory, EmptyList, FilterBar, FilterTile, FormDialog, SearchInput, Table, Tabs, td } from './common'

// Maintenance schedule. The list and the calendar read the same records and the same filters. Overdue is worked out
// from the dates (domain/fleet.ts); completing work always asks the admin to confirm, then the van's availability
// is worked out again.

export const isOverdue = (m: MaintenanceRecord, today = DEMO_TODAY) => isMaintenanceOverdue(m, today)
export const overdueCount = (list: MaintenanceRecord[]) => list.filter((m) => isOverdue(m)).length

type View = 'list' | 'calendar'
type StatusFilter = '' | 'open' | MaintenanceView

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const CHIP: Record<MaintenanceView, string> = {
  Scheduled: 'bg-info-bg text-info',
  'In Maintenance': 'bg-warn-bg text-warn',
  Overdue: 'bg-bad-bg text-bad',
  Completed: 'bg-ok-bg text-ok',
  Cancelled: 'bg-surface-muted text-ink-3 line-through',
}
const TILES: { key: MaintenanceView; label: string; note: string; tone: 'info' | 'warn' | 'bad' | 'ok' }[] = [
  { key: 'Scheduled', label: 'Upcoming', note: 'Scheduled, not started', tone: 'info' },
  { key: 'Overdue', label: 'Overdue', note: 'Past the planned end date', tone: 'bad' },
  { key: 'In Maintenance', label: 'In Maintenance', note: 'Van is in the shop', tone: 'warn' },
  { key: 'Completed', label: 'Completed', note: 'Confirmed finished', tone: 'ok' },
]

/** Last day a record shows on the calendar: open overdue work runs on to today. */
const shownTo = (m: MaintenanceRecord) => (isMaintenanceOverdue(m) ? DEMO_TODAY : m.to)

export function Maintenance() {
  const { data, maintenance } = useAdmin()
  const admin = useIsAdmin()
  const [params, setParams] = useSearchParams()
  const van = params.get('van') ?? ''
  const view: View = params.get('view') === 'calendar' ? 'calendar' : 'list'
  const [status, setStatus] = useState<StatusFilter>('open')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<string | null>(null)
  const [form, setForm] = useState<{ edit?: MaintenanceRecord; date?: string } | null>(null)
  const vanOf = (id: string) => data.vehicles.find((v) => v.id === id)
  const vanName = (id: string) => vanOf(id)?.name ?? id
  const setParam = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const needle = q.trim().toLowerCase()
  const rows = maintenance
    .filter((m) => {
      const st = maintenanceView(m)
      const v = vanOf(m.vehicleId)
      return (
        (!van || m.vehicleId === van) &&
        (status === '' || (status === 'open' ? st !== 'Completed' && st !== 'Cancelled' : st === status)) &&
        (!needle || `${m.id} ${v?.name} ${v?.plate} ${m.type} ${m.provider ?? ''} ${m.note}`.toLowerCase().includes(needle))
      )
    })
    .sort((a, b) => (status === 'Completed' || status === 'Cancelled' ? b.from.localeCompare(a.from) : a.from.localeCompare(b.from)))
  const filtered = !!van || status !== 'open' || !!needle
  const reset = () => {
    setQ('')
    setStatus('open')
    setParam('van', '')
  }
  const count = (k: MaintenanceView) => maintenance.filter((m) => maintenanceView(m) === k).length
  const overdue = maintenance.filter((m) => isOverdue(m))
  const selected = maintenance.find((m) => m.id === open)

  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle={
          admin
            ? 'Schedule work, start it, and confirm when a van is back in service. Click a date on the calendar to schedule, or an entry to open it.'
            : 'View only. An admin schedules maintenance and confirms when a van is back in service.'
        }
        actions={
          admin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setForm({})}>
              Schedule maintenance
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {TILES.map((t) => (
          <FilterTile key={t.key} label={t.label} value={count(t.key)} note={t.note} tone={t.tone} active={status === t.key} onClick={() => setStatus(status === t.key ? 'open' : t.key)} />
        ))}
      </div>
      {overdue.length > 0 && (
        <p role="status" className="mb-5 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
          {overdue.map((m) => vanName(m.vehicleId)).join(', ')} {overdue.length === 1 ? 'is' : 'are'} past the scheduled maintenance date and stays out of
          service until the work is confirmed done.
        </p>
      )}
      <Card className="min-w-0">
        <FilterBar active={filtered} onReset={reset} count={rows.length} noun={['record', 'records']}>
          <Tabs<View>
            value={view}
            onChange={(v) => setParam('view', v === 'calendar' ? 'calendar' : '')}
            items={[
              { key: 'list', label: 'List' },
              { key: 'calendar', label: 'Calendar' },
            ]}
          />
          <SearchInput value={q} onChange={setQ} placeholder="Search van, plate, work or provider" />
          <FilterSelect label="Van" value={van} onChange={(e) => setParam('van', e.target.value)}>
            <option value="">All vans</option>
            {data.vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)}>
            <option value="open">Open (not closed)</option>
            <option value="">All statuses</option>
            {(['Scheduled', 'In Maintenance', 'Overdue', 'Completed', 'Cancelled'] as const).map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </FilterSelect>
        </FilterBar>
        {view === 'list' ? (
          <Table
            head={['Van', 'Work', 'Dates', 'Provider', 'Cost', 'Status']}
            empty={rows.length === 0 && <EmptyList filtered={filtered} onReset={reset}>No maintenance on record yet.</EmptyList>}
          >
            {rows.map((m) => (
              <tr key={m.id} onClick={() => setOpen(m.id)} className="cursor-pointer hover:bg-surface-muted">
                <td className={td}>
                  <button className="font-semibold text-brand-700 hover:underline" onClick={(e) => { e.stopPropagation(); setOpen(m.id) }} aria-label={`${vanName(m.vehicleId)} · ${m.type}`}>
                    {vanName(m.vehicleId)}
                  </button>
                  <span className="block text-xs text-ink-3">{m.id}</span>
                </td>
                <td className={td}>{m.type}</td>
                <td className={`${td} whitespace-nowrap tnum`}>{shortRange(m.from, m.to)}</td>
                <td className={td}>{m.provider ?? '—'}</td>
                <td className={`${td} tnum`}>{m.cost ? peso(m.cost) : '—'}</td>
                <td className={td}>
                  <StatusBadge status={maintenanceView(m)} />
                </td>
              </tr>
            ))}
          </Table>
        ) : (
          <MonthCalendar records={rows} vanName={vanName} admin={admin} onOpen={setOpen} onSchedule={(date) => setForm({ date })} filtered={filtered} onReset={reset} />
        )}
      </Card>
      <ActivityHistory module="Maintenance" title="Recent maintenance activity" />
      {selected && <RecordDialog m={selected} admin={admin} onClose={() => setOpen(null)} onEdit={() => (setOpen(null), setForm({ edit: selected }))} />}
      {form && <MaintenanceForm edit={form.edit} date={form.date} defaultVan={van} onClose={() => setForm(null)} onSaved={(id) => setOpen(id)} />}
    </div>
  )
}

/** One record: details, what it clashes with, its history, and the next step. */
function RecordDialog({ m, admin, onClose, onEdit }: { m: MaintenanceRecord; admin: boolean; onClose: () => void; onEdit: () => void }) {
  const { data, maintenance, startMaintenance, completeMaintenance, cancelMaintenance } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [mode, setMode] = useState<'view' | 'complete' | 'cancel'>('view')
  const [done, setDone] = useState({ completedOn: DEMO_TODAY < m.from ? m.from : DEMO_TODAY, cost: m.cost ? String(m.cost) : '', note: '', confirmed: false })
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const v = data.vehicles.find((x) => x.id === m.vehicleId)
  const name = v?.name ?? m.vehicleId
  const st = maintenanceView(m)
  const openWork = m.status === 'Scheduled' || m.status === 'In Maintenance'
  const conflicts = openWork ? maintenanceConflicts(data, maintenance, m.vehicleId, m.from, shownTo(m), m.id) : []
  const run = (r: { ok: true } | { ok: false; error: string }, msg: string) => {
    if (!r.ok) return setError(r.error)
    toast(msg)
    onClose()
  }
  const footer =
    mode === 'complete' ? (
      <>
        <Button variant="secondary" onClick={() => setMode('view')}>
          Back
        </Button>
        <Button
          icon={<CheckCircle2 className="size-4" aria-hidden />}
          onClick={() => {
            if (!done.confirmed) return setError('Tick the box to confirm the van is ready for trips.')
            const cost = done.cost.trim() ? Number(done.cost) : undefined
            run(completeMaintenance(m.id, { completedOn: done.completedOn, cost, note: done.note }), v ? nextFreeNoteAfter(name) : 'Maintenance completed.')
          }}
        >
          Confirm done
        </Button>
      </>
    ) : mode === 'cancel' ? (
      <>
        <Button variant="secondary" onClick={() => setMode('view')}>
          Back
        </Button>
        <Button variant="danger" onClick={() => run(cancelMaintenance(m.id, reason), 'Maintenance cancelled.')}>
          Cancel maintenance
        </Button>
      </>
    ) : admin && openWork ? (
      <>
        <Button variant="ghost" icon={<XCircle className="size-4" aria-hidden />} onClick={() => (setMode('cancel'), setError(''))} className="mr-auto">
          Cancel…
        </Button>
        <Button variant="secondary" icon={<Pencil className="size-4" aria-hidden />} onClick={onEdit}>
          {m.status === 'Scheduled' ? 'Edit or reschedule' : 'Edit'}
        </Button>
        {m.status === 'Scheduled' && m.from <= DEMO_TODAY && (
          <Button variant="secondary" icon={<Play className="size-4" aria-hidden />} onClick={() => run(startMaintenance(m.id), `${name} is in maintenance.`)}>
            Start maintenance
          </Button>
        )}
        <Button icon={<CheckCircle2 className="size-4" aria-hidden />} disabled={m.from > DEMO_TODAY} onClick={() => (setMode('complete'), setError(''))}>
          Mark done
        </Button>
      </>
    ) : (
      <Button variant="secondary" onClick={onClose}>
        Close
      </Button>
    )
  return (
    <Dialog open wide onClose={onClose} title={mode === 'complete' ? `Is ${name} ready for trips?` : `${name} · ${m.type}`} footer={footer}>
      {mode === 'view' && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <StatusBadge status={st} />
            <span className="text-xs text-ink-3">{m.id}</span>
          </div>
          <Row label="Van">{v ? `${v.name} · ${v.plate}` : m.vehicleId}</Row>
          <Row label="Planned dates">{shortRange(m.from, m.to)}</Row>
          <Row label="Provider">{m.provider ?? '—'}</Row>
          <Row label={m.status === 'Completed' ? 'Cost' : 'Estimated cost'}>{m.cost ? peso(m.cost) : '—'}</Row>
          {m.note && <Row label="Notes">{m.note}</Row>}
          {m.startedAt && <Row label="Started">{fmtStamp(m.startedAt)}</Row>}
          {m.status === 'Completed' && (
            <Row label="Completed">
              {m.completedOn ? fmtDate(m.completedOn) : '—'}
              {m.doneNote && ` · ${m.doneNote}`}
            </Row>
          )}
          {m.status === 'Cancelled' && <Row label="Cancelled">{`${m.cancelledAt ? fmtStamp(m.cancelledAt) : ''} · ${m.cancelReason ?? ''}`}</Row>}
          {st === 'Overdue' && <p className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-bad">The planned end date has passed. {name} stays out of service until the work is confirmed done or moved.</p>}
          {m.status === 'Scheduled' && m.from > DEMO_TODAY && <p className="mt-3 text-xs text-ink-3">Can be started and marked done from {fmtDate(m.from, { year: false })}.</p>}
          {conflicts.length > 0 && (
            <div className="mt-3 rounded-lg bg-warn-bg px-3 py-2 text-warn">
              <p className="font-semibold">Conflicts on these dates</p>
              <ul className="mt-1 list-disc pl-4">
                {conflicts.map((c, i) => (
                  <li key={i}>{c.text}</li>
                ))}
              </ul>
            </div>
          )}
          <ActivityHistory module="Maintenance" recordId={m.id} title="History" />
        </>
      )}
      {mode === 'complete' && (
        <div className="space-y-4">
          <p>Confirm the {m.type.toLowerCase()} is finished. {name} becomes available for assignments again unless something else keeps it out.</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Date finished" type="date" min={m.from} max={DEMO_TODAY} value={done.completedOn} onChange={(e) => setDone({ ...done, completedOn: e.target.value })} />
            <TextField label="Final cost, ₱ (optional)" type="number" inputMode="numeric" min={0} value={done.cost} onChange={(e) => setDone({ ...done, cost: e.target.value })} />
          </div>
          <TextArea label="Work done (optional)" value={done.note} onChange={(e) => setDone({ ...done, note: e.target.value })} placeholder="e.g. Oil and filter changed, brake pads checked" />
          <label className="flex items-start gap-2 text-ink">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={done.confirmed} onChange={(e) => setDone({ ...done, confirmed: e.target.checked })} />
            I confirm the work is finished and {name} is ready for trips.
          </label>
        </div>
      )}
      {mode === 'cancel' && (
        <div className="space-y-3">
          <p>
            {name} will no longer be blocked for {shortRange(m.from, m.to)}. The record stays in the history as Cancelled.
          </p>
          <TextArea label="Reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Work moved to the next service interval" />
        </div>
      )}
      {error && (
        <p role="alert" className="mt-3 rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </Dialog>
  )
}

/** Toast after completion; the store's own message (with when the van is free) is in the activity history. */
function nextFreeNoteAfter(name: string) {
  const s = useAdmin.getState()
  const v = s.data.vehicles.find((x) => x.name === name)
  return v ? `Maintenance completed. ${nextFreeNote(s.data, v)}` : 'Maintenance completed.'
}

function MaintenanceForm({ edit, date, defaultVan, onClose, onSaved }: { edit?: MaintenanceRecord; date?: string; defaultVan: string; onClose: () => void; onSaved: (id: string) => void }) {
  const { data, maintenance, scheduleMaintenance, updateMaintenance } = useAdmin()
  const toast = useUi((s) => s.toast)
  const started = edit?.status === 'In Maintenance'
  const start = date && date >= DEMO_TODAY ? date : addDays(DEMO_TODAY, 7)
  const [f, setF] = useState<Omit<MaintenanceInput, 'cost'> & { cost: string }>(() => ({
    vehicleId: edit?.vehicleId ?? (defaultVan || data.vehicles.find((v) => v.active !== false)?.id || ''),
    type: edit?.type ?? '',
    from: edit?.from ?? start,
    to: edit?.to ?? start,
    note: edit?.note ?? '',
    provider: edit?.provider ?? '',
    cost: edit?.cost ? String(edit.cost) : '',
  }))
  const conflicts = f.vehicleId && f.from && f.to && f.to >= f.from ? maintenanceConflicts(data, maintenance, f.vehicleId, started && f.from < DEMO_TODAY ? DEMO_TODAY : f.from, f.to, edit?.id) : []
  return (
    <FormDialog
      open
      onClose={onClose}
      title={edit ? `Edit ${edit.id}` : 'Schedule maintenance'}
      saveLabel={edit ? 'Save changes' : 'Schedule'}
      onSave={() => {
        const input = { ...f, cost: f.cost.trim() ? Number(f.cost) : undefined }
        const r = edit ? updateMaintenance(edit.id, input) : scheduleMaintenance(input)
        if (!r.ok) return r.error
        toast(edit ? 'Maintenance updated.' : 'Maintenance scheduled.')
        if (r.id) onSaved(r.id)
      }}
    >
      <Select label="Van" value={f.vehicleId} disabled={started} onChange={(e) => setF({ ...f, vehicleId: e.target.value })}>
        {data.vehicles
          .filter((v) => v.active !== false || v.id === f.vehicleId)
          .map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} · {v.plate}
            </option>
          ))}
      </Select>
      <TextField label="Work to do" value={f.type} onChange={(e) => setF({ ...f, type: e.target.value })} placeholder="e.g. Oil change and brake check" />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Start"
          type="date"
          min={DEMO_TODAY}
          disabled={started}
          value={f.from}
          onChange={(e) => setF({ ...f, from: e.target.value, to: e.target.value > f.to ? e.target.value : f.to })}
        />
        <TextField label="End" type="date" min={f.from > DEMO_TODAY ? f.from : DEMO_TODAY} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <TextField label="Provider (optional)" value={f.provider} onChange={(e) => setF({ ...f, provider: e.target.value })} placeholder="e.g. Malolos Auto Care" />
        <TextField label="Estimated cost, ₱ (optional)" type="number" inputMode="numeric" min={0} value={f.cost} onChange={(e) => setF({ ...f, cost: e.target.value })} />
      </div>
      {started && <p className="text-xs text-ink-3">Work has started, so the van and start date stay as they are.</p>}
      {conflicts.length > 0 && (
        <div role="status" className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">
          <p className="font-semibold">Conflicts on these dates</p>
          <ul className="mt-1 list-disc pl-4">
            {conflicts.map((c, i) => (
              <li key={i}>{c.text}</li>
            ))}
          </ul>
          <p className="mt-1 text-xs">Reassign the trip, change the other period, or pick other dates.</p>
        </div>
      )}
      <TextArea label="Notes (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
    </FormDialog>
  )
}

/** Month view of the filtered records. Desktop shows a grid; phones get an agenda of the same month. */
function MonthCalendar({ records, vanName, admin, onOpen, onSchedule, filtered, onReset }: {
  records: MaintenanceRecord[]; vanName: (id: string) => string; admin: boolean; onOpen: (id: string) => void; onSchedule: (date: string) => void; filtered: boolean; onReset: () => void
}) {
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7))
  const [more, setMore] = useState<string | null>(null)
  const [y, mo] = month.split('-').map(Number)
  const first = `${month}-01`
  const startDow = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const last = addDays(first, days - 1)
  const shift = (n: number) => setMonth(new Date(Date.UTC(y, mo - 1 + n, 1)).toISOString().slice(0, 7))
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))]
  const on = (d: string) => records.filter((m) => overlaps(m.from, shownTo(m), d, d))
  const inMonth = records.filter((m) => overlaps(m.from, shownTo(m), first, last)).sort((a, b) => a.from.localeCompare(b.from))
  const chip = (m: MaintenanceRecord, compact = false) => (
    <button
      key={m.id}
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen(m.id)
      }}
      title={`${vanName(m.vehicleId)} · ${m.type}`}
      aria-label={`${vanName(m.vehicleId)} · ${m.type}, ${maintenanceView(m)}`}
      className={`mt-0.5 block w-full truncate rounded px-1 text-left text-[11px] font-semibold hover:ring-1 hover:ring-current ${CHIP[maintenanceView(m)]}`}
    >
      {compact ? vanName(m.vehicleId).replace(/^Van\s*/, 'V') : vanName(m.vehicleId)}
    </button>
  )
  return (
    <div className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink" aria-live="polite">
          {MONTHS[mo - 1]} {y}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} className="rounded-lg border border-line p-1.5 text-ink-2 hover:bg-surface-muted" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => setMonth(DEMO_TODAY.slice(0, 7))} className="rounded-lg border border-line px-2 text-xs font-semibold text-ink-2 hover:bg-surface-muted">
            Today
          </button>
          <button onClick={() => shift(1)} className="rounded-lg border border-line p-1.5 text-ink-2 hover:bg-surface-muted" aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-3 uppercase" aria-hidden>
          {WEEK.map((w) => (
            <span key={w}>{w}</span>
          ))}
        </div>
        <ol className="mt-1 grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <li key={`x${i}`} aria-hidden />
            const items = on(d)
            const canAdd = admin && d >= DEMO_TODAY
            return (
              <li key={d} className={`min-h-24 rounded-lg border p-1 text-left ${d === DEMO_TODAY ? 'border-brand-500' : 'border-line'} ${canAdd ? 'cursor-pointer hover:bg-surface-muted' : ''}`} onClick={() => canAdd && onSchedule(d)}>
                <div className="flex items-center justify-between">
                  <span className={`text-xs tnum ${d === DEMO_TODAY ? 'font-bold text-brand-700' : 'text-ink-2'}`}>{Number(d.slice(8))}</span>
                  {canAdd && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onSchedule(d)
                      }}
                      className="rounded p-0.5 text-ink-3 hover:bg-brand-50 hover:text-brand-700"
                      aria-label={`Schedule maintenance on ${fmtDate(d, { weekday: true })}`}
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  )}
                </div>
                {items.slice(0, 3).map((m) => chip(m))}
                {items.length > 3 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMore(d)
                    }}
                    className="mt-0.5 block text-[11px] font-semibold text-brand-700 hover:underline"
                  >
                    +{items.length - 3} more
                  </button>
                )}
              </li>
            )
          })}
        </ol>
        <p className="mt-3 flex flex-wrap gap-3 text-xs text-ink-2">
          {(Object.keys(CHIP) as MaintenanceView[]).map((k) => (
            <span key={k} className="flex items-center gap-1">
              <span className={`size-2.5 rounded-sm ${CHIP[k].split(' ')[0]}`} aria-hidden /> {k}
            </span>
          ))}
          {admin && <span className="text-ink-3">Click a date to schedule, or an entry to open it.</span>}
        </p>
      </div>
      {/* Phones: the same month as an agenda. */}
      <div className="md:hidden">
        {inMonth.length === 0 ? (
          <EmptyList filtered={filtered} onReset={onReset}>
            Nothing scheduled this month.
          </EmptyList>
        ) : (
          <ul className="divide-y divide-line">
            {inMonth.map((m) => (
              <li key={m.id}>
                <button type="button" onClick={() => onOpen(m.id)} className="flex w-full items-start justify-between gap-3 py-3 text-left">
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      {vanName(m.vehicleId)} · {m.type}
                    </span>
                    <span className="block text-xs text-ink-2 tnum">{shortRange(m.from, m.to)}</span>
                  </span>
                  <StatusBadge status={maintenanceView(m)} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {admin && (
          <Button variant="secondary" full className="mt-3" icon={<CalendarDays className="size-4" aria-hidden />} onClick={() => onSchedule(DEMO_TODAY > first ? DEMO_TODAY : first)}>
            Schedule in {MONTHS[mo - 1]}
          </Button>
        )}
      </div>
      {more && (
        <Dialog open onClose={() => setMore(null)} title={fmtDate(more, { weekday: true })}>
          <ul className="divide-y divide-line">
            {on(more).map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => {
                    setMore(null)
                    onOpen(m.id)
                  }}
                  className="flex w-full items-center justify-between gap-3 py-2.5 text-left"
                >
                  <span className="text-sm font-semibold text-ink">
                    {vanName(m.vehicleId)} · {m.type}
                  </span>
                  <StatusBadge status={maintenanceView(m)} />
                </button>
              </li>
            ))}
          </ul>
          {admin && more >= DEMO_TODAY && (
            <Button className="mt-3" variant="secondary" icon={<Wrench className="size-4" aria-hidden />} onClick={() => (setMore(null), onSchedule(more))}>
              Schedule another
            </Button>
          )}
        </Dialog>
      )}
    </div>
  )
}

