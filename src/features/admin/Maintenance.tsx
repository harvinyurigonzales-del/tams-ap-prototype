import { CalendarClock, CheckCircle2, ChevronLeft, ChevronRight, Plus, Wrench } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { shortRange } from '../../domain/rules'
import { addDays, DEMO_TODAY, overlaps } from '../../lib/demoClock'
import { fmtDate, fmtStamp } from '../../lib/format'
import { maintenanceDatesError, useAdmin, useIsAdmin, type MaintenanceInput, type MaintenanceRecord } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { FilterSelect, Select, TextArea, TextField } from '../../ui/Field'
import { PageHeader } from './AdminRoutes'
import { FormDialog, MiniKpi, Tabs } from './common'

type Tab = 'upcoming' | 'overdue' | 'done'

export const isOverdue = (m: MaintenanceRecord, today = DEMO_TODAY) => m.status === 'Scheduled' && m.to < today
export const overdueCount = (list: MaintenanceRecord[]) => list.filter((m) => isOverdue(m)).length

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function stateOf(m: MaintenanceRecord) {
  if (m.status === 'Done') return <Badge tone="ok">Done</Badge>
  if (isOverdue(m)) return <Badge tone="bad">Overdue</Badge>
  if (m.from <= DEMO_TODAY) return <Badge tone="warn">In progress</Badge>
  return <Badge tone="info">Scheduled</Badge>
}

export function Maintenance() {
  const { data, maintenance } = useAdmin()
  const admin = useIsAdmin()
  const [params, setParams] = useSearchParams()
  const van = params.get('van') ?? ''
  const overdue = maintenance.filter((m) => isOverdue(m))
  const [tab, setTab] = useState<Tab>(overdue.length ? 'overdue' : 'upcoming')
  const [create, setCreate] = useState(false)
  const scoped = maintenance.filter((m) => !van || m.vehicleId === van)
  const lists: Record<Tab, MaintenanceRecord[]> = {
    upcoming: scoped.filter((m) => m.status === 'Scheduled' && !isOverdue(m)).sort((a, b) => a.from.localeCompare(b.from)),
    overdue: scoped.filter((m) => isOverdue(m)).sort((a, b) => a.from.localeCompare(b.from)),
    done: scoped.filter((m) => m.status === 'Done').sort((a, b) => b.from.localeCompare(a.from)),
  }
  const vanName = (id: string) => data.vehicles.find((v) => v.id === id)?.name ?? id
  return (
    <div>
      <PageHeader
        title="Maintenance"
        subtitle={
          admin
            ? 'Schedule work, move dates and confirm when a van is back in service.'
            : 'View only. An admin schedules maintenance and confirms when a van is back in service.'
        }
        actions={
          admin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setCreate(true)}>
              Schedule maintenance
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-3 gap-3">
        <MiniKpi label="Upcoming" value={maintenance.filter((m) => m.status === 'Scheduled' && !isOverdue(m)).length} />
        <MiniKpi label="Overdue" value={overdue.length} />
        <MiniKpi label="Done" value={maintenance.filter((m) => m.status === 'Done').length} />
      </div>
      {overdue.length > 0 && (
        <p role="status" className="mb-5 rounded-xl bg-bad-bg px-4 py-3 text-sm text-bad">
          {overdue.map((m) => vanName(m.vehicleId)).join(', ')} {overdue.length === 1 ? 'is' : 'are'} past the scheduled maintenance date and stays out of
          service until the work is confirmed done.
        </p>
      )}
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <MonthCalendar records={maintenance} vanName={vanName} />
        <div>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              items={[
                {
                  key: 'upcoming',
                  label: 'Upcoming',
                  count: lists.upcoming.length,
                },
                {
                  key: 'overdue',
                  label: 'Overdue',
                  count: lists.overdue.length,
                },
                { key: 'done', label: 'Done', count: lists.done.length },
              ]}
            />
            <FilterSelect
              label="Van"
              value={van}
              onChange={(e) =>
                setParams(e.target.value ? { van: e.target.value } : {}, {
                  replace: true,
                })
              }
            >
              <option value="">All vans</option>
              {data.vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </FilterSelect>
          </div>
          <Card>
            {lists[tab].length === 0 ? (
              <EmptyState
                icon={<Wrench className="size-6" aria-hidden />}
                title={tab === 'overdue' ? 'Nothing overdue' : tab === 'done' ? 'No finished maintenance yet' : 'Nothing scheduled'}
              />
            ) : (
              <ul className="divide-y divide-line">
                {lists[tab].map((m) => (
                  <RecordRow key={m.id} m={m} vanName={vanName(m.vehicleId)} admin={admin} />
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
      <ScheduleForm open={create} onClose={() => setCreate(false)} defaultVan={van} />
    </div>
  )
}

function RecordRow({ m, vanName, admin }: { m: MaintenanceRecord; vanName: string; admin: boolean }) {
  const { completeMaintenance, cancelMaintenance, rescheduleMaintenance } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [done, setDone] = useState(false)
  const [move, setMove] = useState(false)
  const [cancel, setCancel] = useState(false)
  const [note, setNote] = useState('')
  const [dates, setDates] = useState({
    from: m.from < DEMO_TODAY ? DEMO_TODAY : m.from,
    to: m.to < DEMO_TODAY ? DEMO_TODAY : m.to,
  })
  const notStarted = m.from > DEMO_TODAY
  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-ink">
            {vanName} · {m.type}
          </p>
          <p className="text-sm text-ink-2">
            {shortRange(m.from, m.to)}
            {m.note && ` · ${m.note}`}
          </p>
          {m.status === 'Done' && m.doneAt && (
            <p className="text-xs text-ink-3">
              Confirmed done {fmtStamp(m.doneAt)}
              {m.doneNote && ` · ${m.doneNote}`}
            </p>
          )}
        </div>
        {stateOf(m)}
      </div>
      {admin && m.status === 'Scheduled' && (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            icon={<CheckCircle2 className="size-4" aria-hidden />}
            disabled={notStarted}
            onClick={() => setDone(true)}
            aria-describedby={notStarted ? `${m.id}-hint` : undefined}
          >
            Mark done
          </Button>
          <Button size="sm" variant="secondary" icon={<CalendarClock className="size-4" aria-hidden />} onClick={() => setMove(true)}>
            Reschedule
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setCancel(true)}>
            Cancel
          </Button>
          {notStarted && (
            <span id={`${m.id}-hint`} className="self-center text-xs text-ink-3">
              Can be marked done from {fmtDate(m.from, { year: false })}.
            </span>
          )}
        </div>
      )}
      <ConfirmDialog
        open={done}
        onClose={() => setDone(false)}
        title={`Is ${vanName} ready for trips?`}
        body={`Confirm the ${m.type.toLowerCase()} is finished. ${vanName} becomes available for assignments right away.`}
        confirmLabel="Confirm done"
        onConfirm={() => {
          const r = completeMaintenance(m.id, note)
          if (!r.ok) return r.error
          toast(`${vanName} is back in service.`)
        }}
      >
        <TextArea
          label="Work done (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. Oil and filter changed, brake pads checked"
        />
      </ConfirmDialog>
      <FormDialog
        open={move}
        onClose={() => setMove(false)}
        title={`Reschedule ${vanName}`}
        saveLabel="Save new dates"
        onSave={() => {
          const r = rescheduleMaintenance(m.id, dates.from, dates.to)
          if (!r.ok) return r.error
          toast('Maintenance rescheduled.')
        }}
      >
        <p className="text-sm text-ink-2">{m.type}</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Start"
            type="date"
            min={DEMO_TODAY}
            value={dates.from}
            onChange={(e) =>
              setDates({
                from: e.target.value,
                to: e.target.value > dates.to ? e.target.value : dates.to,
              })
            }
          />
          <TextField label="End" type="date" min={dates.from} value={dates.to} onChange={(e) => setDates({ ...dates, to: e.target.value })} />
        </div>
      </FormDialog>
      <ConfirmDialog
        open={cancel}
        onClose={() => setCancel(false)}
        title="Cancel this maintenance?"
        body={`${vanName} is no longer blocked for ${shortRange(m.from, m.to)}.`}
        confirmLabel="Cancel maintenance"
        tone="danger"
        onConfirm={() => {
          const r = cancelMaintenance(m.id)
          if (!r.ok) return r.error
          toast('Maintenance cancelled.')
        }}
      />
    </li>
  )
}

function ScheduleForm({ open, onClose, defaultVan }: { open: boolean; onClose: () => void; defaultVan: string }) {
  const { data, scheduleMaintenance } = useAdmin()
  const toast = useUi((s) => s.toast)
  const blank = (): MaintenanceInput => ({
    vehicleId: defaultVan || data.vehicles[0]?.id || '',
    type: '',
    from: addDays(DEMO_TODAY, 7),
    to: addDays(DEMO_TODAY, 7),
    note: '',
  })
  const [f, setF] = useState(blank)
  const clash = f.vehicleId && f.from && f.to ? maintenanceDatesError(data, f.vehicleId, f.from, f.to) : null
  return (
    <FormDialog
      open={open}
      onClose={() => {
        onClose()
        setF(blank())
      }}
      title="Schedule maintenance"
      saveLabel="Schedule"
      onSave={() => {
        const r = scheduleMaintenance(f)
        if (!r.ok) return r.error
        toast('Maintenance scheduled.')
        setF(blank())
      }}
    >
      <Select label="Van" value={f.vehicleId} onChange={(e) => setF({ ...f, vehicleId: e.target.value })}>
        {data.vehicles.map((v) => (
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
          value={f.from}
          onChange={(e) =>
            setF({
              ...f,
              from: e.target.value,
              to: e.target.value > f.to ? e.target.value : f.to,
            })
          }
        />
        <TextField label="End" type="date" min={f.from} value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
      </div>
      {clash && <p className="rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">{clash}</p>}
      <TextArea label="Notes (optional)" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
    </FormDialog>
  )
}

/** Month view of maintenance, the same for staff and admin. */
function MonthCalendar({ records, vanName }: { records: MaintenanceRecord[]; vanName: (id: string) => string }) {
  const [month, setMonth] = useState(DEMO_TODAY.slice(0, 7))
  const [y, mo] = month.split('-').map(Number)
  const first = `${month}-01`
  const startDow = new Date(Date.UTC(y, mo - 1, 1)).getUTCDay()
  const days = new Date(Date.UTC(y, mo, 0)).getUTCDate()
  const shift = (n: number) => {
    const d = new Date(Date.UTC(y, mo - 1 + n, 1))
    setMonth(d.toISOString().slice(0, 7))
  }
  const cells = [...Array(startDow).fill(null), ...Array.from({ length: days }, (_, i) => addDays(first, i))]
  return (
    <Card className="h-fit p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg font-semibold text-ink" aria-live="polite">
          {MONTHS[mo - 1]} {y}
        </h2>
        <div className="flex gap-1">
          <button onClick={() => shift(-1)} className="rounded-lg border border-line p-1.5 text-ink-2 hover:bg-surface-muted" aria-label="Previous month">
            <ChevronLeft className="size-4" />
          </button>
          <button onClick={() => shift(1)} className="rounded-lg border border-line p-1.5 text-ink-2 hover:bg-surface-muted" aria-label="Next month">
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-ink-3 uppercase" aria-hidden>
        {WEEK.map((w) => (
          <span key={w}>{w}</span>
        ))}
      </div>
      <ol className="mt-1 grid grid-cols-7 gap-1">
        {cells.map((d, i) => {
          if (!d) return <li key={`x${i}`} aria-hidden />
          const items = records.filter((m) => overlaps(m.from, isOverdue(m) ? DEMO_TODAY : m.to, d, d))
          const label = `${fmtDate(d, { weekday: true })}${items.length ? `: ${items.map((m) => `${vanName(m.vehicleId)} ${m.type}`).join('; ')}` : ''}`
          return (
            <li key={d} aria-label={label} className={`min-h-16 rounded-lg border p-1 text-left ${d === DEMO_TODAY ? 'border-brand-500' : 'border-line'}`}>
              <span className={`block text-xs tnum ${d === DEMO_TODAY ? 'font-bold text-brand-700' : 'text-ink-2'}`}>{Number(d.slice(8))}</span>
              {items.slice(0, 2).map((m) => (
                <span
                  key={m.id}
                  title={`${vanName(m.vehicleId)} · ${m.type}`}
                  className={`mt-0.5 block truncate rounded px-1 text-[10px] font-semibold ${m.status === 'Done' ? 'bg-surface-muted text-ink-2' : isOverdue(m) ? 'bg-bad-bg text-bad' : 'bg-warn-bg text-warn'}`}
                >
                  <span className="sm:hidden">{vanName(m.vehicleId).replace(/^Van\s*/, '')}</span>
                  <span className="hidden sm:inline">{vanName(m.vehicleId)}</span>
                </span>
              ))}
              {items.length > 2 && <span className="block text-[10px] text-ink-3">+{items.length - 2}</span>}
            </li>
          )
        })}
      </ol>
      <p className="mt-3 flex flex-wrap gap-3 text-xs text-ink-2">
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-warn-bg ring-1 ring-warn/40" aria-hidden /> Scheduled
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-bad-bg ring-1 ring-bad/40" aria-hidden /> Overdue
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2.5 rounded-sm bg-surface-muted ring-1 ring-line" aria-hidden /> Done
        </span>
      </p>
    </Card>
  )
}
