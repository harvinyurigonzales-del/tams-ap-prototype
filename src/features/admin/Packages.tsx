import { Copy, Eye, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { packageStatus, priceBasisOf, PACKAGE_STATUSES } from '../../domain/packages'
import { departureAvailability, shortRange } from '../../domain/rules'
import { addDays, DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtTime, peso } from '../../lib/format'
import { activationError, MAX_CAPACITY, openDeparturesOf, packageError, packageUsage, useAdmin, useIsAdmin, type DepartureInput, type PackageInput } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import type { Departure, ImageRef, PackageStatus, Service } from '../../seed/types'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { FilterSelect, Select, TextArea, TextField } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { TourPage } from '../customer/Tours'
import { PageHeader } from './AdminRoutes'
import { ActivityHistory, DetailCard, EmptyList, FilterBar, FilterTile, FormDialog, linesOf, SearchInput, Table, td } from './common'
import { PhotoPicker } from './Photo'

const TONE: Record<PackageStatus, 'ok' | 'neutral' | 'warn' | 'info'> = { Active: 'ok', Draft: 'info', Inactive: 'warn', Archived: 'neutral' }
const NOTE: Record<PackageStatus, string> = { Active: 'Bookable', Draft: 'Not published', Inactive: 'No new bookings', Archived: 'Kept for history' }

type Confirm = 'activate' | 'deactivate' | 'archive' | 'restore' | 'delete' | null

export function Packages() {
  const { data, setPackageStatus, deletePackage, duplicatePackage } = useAdmin()
  const admin = useIsAdmin()
  const toast = useUi((s) => s.toast)
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<Service | 'new' | null>(null)
  const [confirm, setConfirm] = useState<Confirm>(null)
  const [preview, setPreview] = useState<{ s: Service; deps: Departure[] } | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<PackageStatus | ''>('')
  const [dest, setDest] = useState('')
  const [season, setSeason] = useState('')
  const tours = data.services.filter((s) => s.type === 'tour')
  const seasons = [...new Set(tours.map((s) => s.season).filter(Boolean))].sort() as string[]
  const filtered = !!(q || status || dest || season)
  const reset = () => (setQ(''), setStatus(''), setDest(''), setSeason(''))
  const rows = tours.filter((s) => {
    const st = packageStatus(s)
    if (status ? st !== status : st === 'Archived') return false
    if (dest && s.destinationId !== dest) return false
    if (season && (season === '-' ? !!s.season : s.season !== season)) return false
    const text = `${s.name} ${s.id} ${s.destination} ${s.season ?? ''}`.toLowerCase()
    return !q || text.includes(q.trim().toLowerCase())
  })
  const sel = tours.find((s) => s.id === params.get('id'))
  const use = sel && packageUsage(data, sel.id)
  const selStatus = sel && packageStatus(sel)
  const count = (st: PackageStatus) => tours.filter((s) => packageStatus(s) === st).length

  return (
    <div>
      <PageHeader
        title="Tour packages"
        subtitle="Joiner tours customers can book. Only Active packages appear on the customer site."
        actions={
          admin && (
            <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit('new')}>
              Add package
            </Button>
          )
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {PACKAGE_STATUSES.map((st) => (
          <FilterTile key={st} label={st} value={count(st)} note={NOTE[st]} tone={TONE[st] === 'info' ? 'info' : TONE[st]} active={status === st} onClick={() => setStatus(status === st ? '' : st)} />
        ))}
      </div>
      <div className={`grid gap-6 ${sel ? 'xl:grid-cols-[1fr_420px]' : ''}`}>
        <Card className="min-w-0">
          <FilterBar active={filtered} onReset={reset} count={rows.length} noun={['package', 'packages']}>
            <SearchInput value={q} onChange={setQ} placeholder="Search title, destination or ID" />
            <FilterSelect label="Destination" value={dest} onChange={(e) => setDest(e.target.value)}>
              <option value="">All destinations</option>
              {data.destinations.filter((d) => tours.some((s) => s.destinationId === d.id)).map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Occasion" value={season} onChange={(e) => setSeason(e.target.value)}>
              <option value="">All occasions</option>
              <option value="-">Any seasonal package</option>
              {seasons.map((x) => (
                <option key={x} value={x}>
                  {x}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect label="Status" value={status} onChange={(e) => setStatus(e.target.value as PackageStatus | '')}>
              <option value="">All but archived</option>
              {PACKAGE_STATUSES.map((st) => (
                <option key={st}>{st}</option>
              ))}
            </FilterSelect>
          </FilterBar>
          <Table
            head={['Package', 'Destination', 'Price', 'Next open date', 'Upcoming bookings', 'Status']}
            empty={rows.length === 0 && <EmptyList filtered={filtered} onReset={reset}>No packages yet. Add the first one.</EmptyList>}
          >
            {rows.map((s) => {
              const u = packageUsage(data, s.id)
              const next = openDeparturesOf(data, s.id)[0]
              const st = packageStatus(s)
              return (
                <tr key={s.id} className={sel?.id === s.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}>
                  <td className={td}>
                    <button className="font-semibold text-brand-700 hover:underline" onClick={() => setParams({ id: s.id })} aria-label={`${s.name} details`}>
                      {s.name}
                    </button>
                    <span className="block text-xs text-ink-2">
                      {s.id}
                      {s.season && <> · {s.season}</>}
                    </span>
                  </td>
                  <td className={td}>{s.destination}</td>
                  <td className={`${td} tnum`}>
                    {peso(s.price)}
                    <span className="block text-xs text-ink-2">{priceBasisOf(s) === 'group' ? 'per group' : 'per person'}</span>
                  </td>
                  <td className={td}>{next ? shortRange(next.startDate, next.endDate) : <span className="text-ink-3">None</span>}</td>
                  <td className={`${td} tnum`}>{u.upcoming}</td>
                  <td className={td}>
                    <Badge tone={TONE[st]}>{st}</Badge>
                    {s.datesUnreviewed && <span className="block text-xs text-warn">Dates to review</span>}
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>
        {sel && use && selStatus && (
          <DetailCard label={`${sel.name} details`} title={sel.name} subtitle={`${sel.destination} · ${sel.duration}`} onClose={() => setParams({})}>
            {(sel.image || data.destinations.find((d) => d.id === sel.destinationId)) && (
              <Picture image={sel.image ?? data.destinations.find((d) => d.id === sel.destinationId)!.image} label={false} sizes="400px" className="mb-3 aspect-[16/9] rounded-xl" />
            )}
            <div className="flex flex-wrap gap-1.5">
              <Badge tone={TONE[selStatus]}>{selStatus}</Badge>
              {sel.season && <Badge tone="info">{sel.season}</Badge>}
              {sel.copiedFrom && <Badge tone="neutral">Copy of {sel.copiedFrom}</Badge>}
            </div>
            {sel.datesUnreviewed && <p className="mt-2 rounded-lg bg-warn-bg px-3 py-2 text-sm text-warn">Copied package: open Edit and confirm the departure dates before activating.</p>}
            <p className="mt-3 text-sm text-ink-2">{sel.summary}</p>
            <div className="mt-3">
              <Row label="Price">
                {peso(sel.price)} {priceBasisOf(sel) === 'group' ? 'per group' : 'per person'}
              </Row>
              <Row label="Seats per departure">{sel.capacity ?? 12}</Row>
              <Row label="Pickup">
                {fmtTime(sel.pickupTime)} at {sel.pickup}
              </Row>
              <Row label="Upcoming bookings">{use.upcoming}</Row>
              <Row label="Bookings on record">{use.bookings}</Row>
              <Row label="Reviews">{use.reviews}</Row>
            </div>
            <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Departures</h3>
            <DepartureSummary serviceId={sel.id} />
            <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Itinerary</h3>
            <ol className="list-decimal space-y-0.5 pl-5 text-sm text-ink-2">
              {sel.itinerary.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ol>
            <div className="mt-3 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <p className="font-semibold text-ink">Included</p>
                <ul className="list-disc pl-5 text-ink-2">
                  {sel.inclusions.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-ink">Not included</p>
                <ul className="list-disc pl-5 text-ink-2">
                  {sel.exclusions.length ? sel.exclusions.map((l, i) => <li key={i}>{l}</li>) : <li>Nothing listed</li>}
                </ul>
              </div>
            </div>
            {admin && (
              <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
                <Button variant="secondary" size="sm" onClick={() => setEdit(sel)}>
                  Edit
                </Button>
                <Button variant="secondary" size="sm" icon={<Eye className="size-4" aria-hidden />} onClick={() => setPreview({ s: sel, deps: data.departures.filter((d) => d.serviceId === sel.id) })}>
                  Preview customer view
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<Copy className="size-4" aria-hidden />}
                  onClick={() => {
                    const r = duplicatePackage(sel.id)
                    if (!r.ok) return toast(r.error, 'error')
                    setParams({ id: r.id! })
                    toast('Copy saved as a Draft. Review its name, prices, season and dates.')
                    setEdit(useAdmin.getState().data.services.find((s) => s.id === r.id)!)
                  }}
                >
                  Duplicate package
                </Button>
                {selStatus !== 'Active' && selStatus !== 'Archived' && (
                  <Button size="sm" onClick={() => setConfirm('activate')}>
                    {selStatus === 'Draft' ? 'Activate' : 'Reactivate'}
                  </Button>
                )}
                {selStatus === 'Active' && (
                  <Button variant="secondary" size="sm" onClick={() => setConfirm('deactivate')}>
                    Deactivate
                  </Button>
                )}
                {selStatus === 'Archived' ? (
                  <Button variant="secondary" size="sm" onClick={() => setConfirm('restore')}>
                    Restore from archive
                  </Button>
                ) : (
                  <Button variant="ghost" size="sm" onClick={() => setConfirm('archive')}>
                    Archive
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => setConfirm('delete')}>
                  Delete
                </Button>
              </div>
            )}
            <ActivityHistory module="Packages" recordId={sel.id} />
          </DetailCard>
        )}
      </div>
      {!sel && <ActivityHistory module="Packages" title="Recent package activity" />}
      <PackageForm key={edit === 'new' ? 'new' : edit?.id ?? 'none'} target={edit} onClose={() => setEdit(null)} onPreview={setPreview} onSaved={(id) => setParams({ id })} />
      {preview && <CustomerPreview service={preview.s} departures={preview.deps} onClose={() => setPreview(null)} />}
      {sel && use && (
        <ConfirmDialog
          open={confirm !== null}
          onClose={() => setConfirm(null)}
          title={
            confirm === 'delete' ? `Delete ${sel.name}?` : confirm === 'archive' ? `Archive ${sel.name}?` : confirm === 'restore' ? `Restore ${sel.name}?` : confirm === 'deactivate' ? `Deactivate ${sel.name}?` : `Activate ${sel.name}?`
          }
          body={
            confirm === 'delete'
              ? use.bookings || use.reviews || use.assignments
                ? `This package has ${[use.bookings && `${use.bookings} bookings`, use.reviews && `${use.reviews} reviews`, use.assignments && 'van assignments'].filter(Boolean).join(', ')} on record, so it cannot be deleted. Archive it instead.`
                : 'The package and its departures are removed for good. Nothing else refers to it.'
              : confirm === 'archive'
                ? 'It leaves the customer site and the default list, and its bookings, reviews and reports stay on record. You can restore it later.'
                : confirm === 'restore'
                  ? 'It comes back as Inactive. Activate it when you want to take bookings again.'
                  : confirm === 'deactivate'
                    ? `Customers can no longer find or book it, including from saved links.${use.upcoming ? ` ${use.upcoming} upcoming ${use.upcoming === 1 ? 'booking stays' : 'bookings stay'} as agreed and staff still run ${use.upcoming === 1 ? 'that trip' : 'those trips'}.` : ''}`
                    : activationError(data, sel) ?? 'It appears on the customer site and its open departures can be booked.'
          }
          confirmLabel={confirm === 'delete' ? 'Delete package' : confirm === 'archive' ? 'Archive' : confirm === 'restore' ? 'Restore' : confirm === 'deactivate' ? 'Deactivate' : 'Activate'}
          tone={confirm === 'delete' || confirm === 'deactivate' ? 'danger' : 'primary'}
          onConfirm={() => {
            if (confirm === 'delete') {
              const r = deletePackage(sel.id)
              if (!r.ok) return r.error
              setParams({})
              toast('Package deleted.')
              return
            }
            const to: PackageStatus = confirm === 'archive' ? 'Archived' : confirm === 'restore' || confirm === 'deactivate' ? 'Inactive' : 'Active'
            const r = setPackageStatus(sel.id, to)
            if (!r.ok) return r.error
            toast(`${sel.name}: ${to}.`)
          }}
        />
      )}
    </div>
  )
}

function DepartureSummary({ serviceId }: { serviceId: string }) {
  const data = useAdmin((s) => s.data)
  const deps = data.departures.filter((d) => d.serviceId === serviceId && d.endDate >= DEMO_TODAY).sort((a, b) => a.startDate.localeCompare(b.startDate))
  if (!deps.length) return <p className="text-sm text-ink-2">No upcoming departures.</p>
  return (
    <ul className="divide-y divide-line text-sm">
      {deps.map((d) => {
        const a = departureAvailability(d, data.bookings)
        return (
          <li key={d.id} className="flex justify-between gap-3 py-1.5">
            <span>{shortRange(d.startDate, d.endDate)}</span>
            <span className="text-ink-2 tnum">
              {a.held + a.completed}/{d.capacity} booked · {a.state === 'open' ? 'open' : a.state}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

interface FormState {
  name: string
  destinationId: string
  season: string
  summary: string
  description: string
  duration: string
  days: number
  price: number
  priceBasis: 'person' | 'group'
  capacity: number
  pickup: string
  pickupTime: string
  itinerary: string
  inclusions: string
  exclusions: string
  image?: ImageRef
  departures: (DepartureInput & { key: string })[]
  publish: boolean
  datesReviewed: boolean
}

let rowKey = 0

function PackageForm({ target, onClose, onPreview, onSaved }: { target: Service | 'new' | null; onClose: () => void; onPreview: (p: { s: Service; deps: Departure[] }) => void; onSaved: (id: string) => void }) {
  const { data, savePackage } = useAdmin()
  const toast = useUi((s) => s.toast)
  const s = target && target !== 'new' ? target : undefined
  const [f, setF] = useState<FormState>(() => ({
    name: s?.name ?? '', destinationId: s?.destinationId ?? data.destinations[0].id, season: s?.season ?? '', summary: s?.summary ?? '', description: s?.description ?? '',
    duration: s?.duration ?? '', days: s?.days ?? 1, price: s?.price ?? 0, priceBasis: s ? priceBasisOf(s) : 'person', capacity: s?.capacity ?? 12,
    pickup: s?.pickup ?? 'SM North EDSA, Quezon City', pickupTime: s?.pickupTime ?? '05:00',
    itinerary: s?.itinerary.join('\n') ?? '', inclusions: s?.inclusions.join('\n') ?? 'Round-trip van\nDriver and fuel', exclusions: s?.exclusions.join('\n') ?? '',
    image: s?.image,
    departures: s ? data.departures.filter((d) => d.serviceId === s.id && d.endDate >= DEMO_TODAY).sort((a, b) => a.startDate.localeCompare(b.startDate)).map((d) => ({ id: d.id, startDate: d.startDate, capacity: d.capacity, key: d.id })) : [],
    publish: false, datesReviewed: false,
  }))
  const [error, setError] = useState('')
  const firstRun = useRef(true)
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false
      return
    }
    setError('')
  }, [f])
  const dest = data.destinations.find((d) => d.id === f.destinationId)
  // Past departures are not edited here; they stay as they are.
  const past = s ? data.departures.filter((d) => d.serviceId === s.id && d.endDate < DEMO_TODAY) : []
  const input = (): PackageInput => ({
    name: f.name, destinationId: f.destinationId, season: f.season, summary: f.summary, description: f.description, duration: f.duration, days: f.days, price: f.price,
    priceBasis: f.priceBasis, capacity: f.capacity, pickup: f.pickup, pickupTime: f.pickupTime, itinerary: linesOf(f.itinerary), inclusions: linesOf(f.inclusions), exclusions: linesOf(f.exclusions),
    image: f.image, departures: [...past.map((d) => ({ id: d.id, startDate: d.startDate, capacity: d.capacity })), ...f.departures.map(({ id, startDate, capacity }) => ({ id, startDate, capacity }))],
    publish: f.publish, datesReviewed: f.datesReviewed,
  })
  const gallery = useMemo(() => data.destinations.map((d) => d.image), [data.destinations])
  const setDep = (key: string, patch: Partial<DepartureInput>) => setF({ ...f, departures: f.departures.map((d) => (d.key === key ? { ...d, ...patch } : d)) })
  const booked = (id?: string) => (id ? data.bookings.filter((b) => b.departureId === id && b.status !== 'Cancelled').reduce((n, b) => n + b.pax, 0) : 0)
  const hasBookings = (id?: string) => !!id && data.bookings.some((b) => b.departureId === id)

  const preview = () => {
    const x = input()
    const err = packageError(x)
    if (err) return setError(`Fix this to preview: ${err}`)
    const sid = s?.id ?? 'SVC-PREVIEW'
    const svc: Service = {
      ...(s ?? { type: 'tour', unit: 'person', tint: ['#1D3A7A', '#C8282F'], interests: dest?.interests }),
      id: sid, ...x, destination: dest?.name ?? '', itinerary: x.itinerary, inclusions: x.inclusions, exclusions: x.exclusions, season: x.season || undefined, description: x.description || undefined,
    } as Service
    const deps: Departure[] = f.departures.map((d) => ({ id: d.id ?? `PREVIEW-${d.key}`, serviceId: sid, startDate: d.startDate, endDate: addDays(d.startDate, f.days - 1), capacity: d.capacity }))
    onPreview({ s: svc, deps })
  }

  return (
    <FormDialog
      open={!!target}
      wide
      onClose={onClose}
      title={s ? `Edit ${s.name}` : 'Add a tour package'}
      saveLabel={s ? 'Save changes' : f.publish ? 'Add and publish' : 'Save as draft'}
      extra={
        <Button variant="ghost" icon={<Eye className="size-4" aria-hidden />} onClick={preview}>
          Preview customer view
        </Button>
      }
      onSave={() => {
        const r = savePackage(s?.id ?? null, input())
        if (!r.ok) return r.error
        toast(s ? 'Package saved.' : f.publish ? `${f.name.trim()} added and published.` : `${f.name.trim()} saved as a draft.`)
        if (r.id) onSaved(r.id)
      }}
    >
      {error && (
        <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
          {error}
        </p>
      )}
      <h3 className="text-xs font-semibold tracking-wide text-ink-3 uppercase">About the package</h3>
      <TextField label="Title" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Batangas Beach Day" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Destination" value={f.destinationId} onChange={(e) => setF({ ...f, destinationId: e.target.value })}>
          {data.destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <TextField label="Season or occasion (optional)" value={f.season} onChange={(e) => setF({ ...f, season: e.target.value })} placeholder="e.g. Summer, Christmas season" hint="A label only. Set the real dates under Departures." list="season-options" />
        <datalist id="season-options">
          {['Christmas season', 'New Year', 'Summer', 'Holy Week', 'Long weekend', 'Rainy season'].map((x) => (
            <option key={x} value={x} />
          ))}
        </datalist>
      </div>
      <TextArea label="Summary (shown on cards)" rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      <TextArea label="Description (optional, shown on the tour page)" rows={3} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} />
      <PhotoPicker label="Photo" value={f.image} fallback={dest?.image} gallery={gallery} alt={f.name || 'Tour photo'} onChange={(image) => setF({ ...f, image })} />

      <h3 className="pt-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Trip and price</h3>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label="Duration" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="2 days / 1 night" />
        <TextField label="Days" type="number" inputMode="numeric" min={1} max={10} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} />
        <TextField label="Price (₱)" type="number" inputMode="numeric" min={0} value={f.price || ''} onChange={(e) => setF({ ...f, price: Number(e.target.value) || 0 })} />
        <Select label="Price basis" value={f.priceBasis} onChange={(e) => setF({ ...f, priceBasis: e.target.value as 'person' | 'group' })}>
          <option value="person">Per person</option>
          <option value="group">Per group (one price for the booking)</option>
        </Select>
        <TextField label="Seats per departure" type="number" inputMode="numeric" min={1} max={MAX_CAPACITY} value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} hint="Used for new departures." />
        <TextField label="Pickup time" type="time" value={f.pickupTime} onChange={(e) => setF({ ...f, pickupTime: e.target.value })} />
      </div>
      <TextField label="Pickup point" value={f.pickup} onChange={(e) => setF({ ...f, pickup: e.target.value })} />
      <TextArea label="Itinerary, one line per stop or day" rows={4} value={f.itinerary} onChange={(e) => setF({ ...f, itinerary: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea label="Inclusions, one per line" rows={3} value={f.inclusions} onChange={(e) => setF({ ...f, inclusions: e.target.value })} />
        <TextArea label="Exclusions, one per line" rows={3} value={f.exclusions} onChange={(e) => setF({ ...f, exclusions: e.target.value })} />
      </div>

      <fieldset>
        <legend className="pt-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Departures</legend>
        <p className="mt-1 text-xs text-ink-2">Upcoming dates customers can book. A departure with bookings keeps its date; add another date instead.</p>
        {f.departures.length === 0 && <p className="mt-2 text-sm text-ink-2">No upcoming departures. The package can be saved, but customers cannot book it until a date is added.</p>}
        <ul className="mt-2 space-y-2">
          {f.departures.map((d, i) => {
            const locked = hasBookings(d.id)
            return (
              <li key={d.key} className="grid grid-cols-[1fr_96px_auto] items-end gap-2 rounded-xl bg-surface-muted p-2">
                <TextField label={`Departure ${i + 1} start`} type="date" min={addDays(DEMO_TODAY, 1)} value={d.startDate} disabled={locked} onChange={(e) => setDep(d.key, { startDate: e.target.value })} hint={locked ? `${booked(d.id)} seats booked · date locked` : d.startDate ? `Ends ${fmtDate(addDays(d.startDate, f.days - 1), { year: false })}` : undefined} />
                <TextField label="Seats" type="number" inputMode="numeric" min={Math.max(1, booked(d.id))} max={MAX_CAPACITY} value={d.capacity} onChange={(e) => setDep(d.key, { capacity: Number(e.target.value) })} />
                <button type="button" disabled={locked} onClick={() => setF({ ...f, departures: f.departures.filter((x) => x.key !== d.key) })} className="mb-1.5 grid size-10 place-items-center rounded-lg text-ink-2 hover:bg-surface disabled:opacity-30" aria-label={`Remove departure ${i + 1}`}>
                  <Trash2 className="size-4" aria-hidden />
                </button>
              </li>
            )
          })}
        </ul>
        <Button
          variant="secondary"
          size="sm"
          className="mt-2"
          icon={<Plus className="size-4" aria-hidden />}
          onClick={() => {
            const last = f.departures.at(-1)?.startDate
            setF({ ...f, departures: [...f.departures, { startDate: last ? addDays(last, 7) : addDays(DEMO_TODAY, 14), capacity: f.capacity, key: `new-${++rowKey}` }] })
          }}
        >
          Add departure
        </Button>
        {s?.datesUnreviewed && (
          <label className="mt-3 flex items-start gap-2 rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">
            <input type="checkbox" className="mt-0.5 size-4" checked={f.datesReviewed} onChange={(e) => setF({ ...f, datesReviewed: e.target.checked })} />
            <span>I have checked these departure dates for this copy. Activation stays locked until this is confirmed.</span>
          </label>
        )}
      </fieldset>

      {!s && (
        <Select label="Publication" value={f.publish ? 'active' : 'draft'} onChange={(e) => setF({ ...f, publish: e.target.value === 'active' })} hint="A draft is saved for admins only. Publish when the dates and prices are final.">
          <option value="draft">Save as draft</option>
          <option value="active">Publish now (Active)</option>
        </Select>
      )}
    </FormDialog>
  )
}

/** The real customer tour page for unsaved values. Nothing is saved or published from here. */
function CustomerPreview({ service, departures, onClose }: { service: Service; departures: Departure[]; onClose: () => void }) {
  const bookings = useAdmin((s) => s.data.bookings)
  const deps = departures
    .map((dep) => ({ dep, avail: departureAvailability(dep, bookings) }))
    .filter((x) => x.avail.state !== 'past')
    .sort((a, b) => a.dep.startDate.localeCompare(b.dep.startDate))
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (d && !d.open) d.showModal()
    return () => d?.close()
  }, [])
  return (
    <dialog ref={ref} aria-label={`Customer preview of ${service.name}`} onCancel={(e) => (e.preventDefault(), onClose())} className="theme-tara m-0 h-full max-h-none w-full max-w-none p-0 backdrop:bg-brand-900/40">
      <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-line bg-warn-bg px-4 py-2 text-sm text-warn">
        <p>
          <span className="font-semibold">Customer preview.</span> Not published and not bookable. Unsaved changes are shown.
        </p>
        <Button size="sm" variant="secondary" icon={<X className="size-4" aria-hidden />} onClick={onClose}>
          Close preview
        </Button>
      </div>
      <div className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6">
        <TourPage s={service} deps={deps} preview />
      </div>
    </dialog>
  )
}
