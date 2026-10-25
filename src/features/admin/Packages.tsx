import { Plus } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtTime, peso } from '../../lib/format'
import { packageUsage, useAdmin, type PackageInput } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import type { Service } from '../../seed/types'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, Row } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { Select, TextArea, TextField } from '../../ui/Field'
import { PageHeader } from './AdminRoutes'
import { DetailCard, FormDialog, linesOf, MiniKpi, Table, td } from './common'

export function Packages() {
  const { data, setPackageActive, deletePackage } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [params, setParams] = useSearchParams()
  const [edit, setEdit] = useState<Service | 'new' | null>(null)
  const [confirm, setConfirm] = useState<'toggle' | 'delete' | null>(null)
  const tours = data.services.filter((s) => s.type === 'tour')
  const sel = tours.find((s) => s.id === params.get('id'))
  const use = sel && packageUsage(data, sel.id)
  return (
    <div>
      <PageHeader
        title="Tour packages"
        subtitle="The joiner tours customers can book. Prices are per person."
        actions={
          <Button icon={<Plus className="size-4" aria-hidden />} onClick={() => setEdit('new')}>
            Add package
          </Button>
        }
      />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MiniKpi label="Active" value={tours.filter((s) => !s.inactive).length} />
        <MiniKpi label="Deactivated" value={tours.filter((s) => s.inactive).length} />
        <MiniKpi label="Open departures" value={data.departures.filter((d) => tours.some((t) => t.id === d.serviceId && !t.inactive) && d.startDate >= DEMO_TODAY).length} />
      </div>
      <div className={`grid gap-6 ${sel ? 'xl:grid-cols-[1fr_400px]' : ''}`}>
        <Card className="min-w-0">
          <Table head={['Package', 'Destination', 'Duration', 'Price', 'Upcoming bookings', 'Status']}>
            {tours.map((s) => {
              const u = packageUsage(data, s.id)
              return (
                <tr key={s.id} className={sel?.id === s.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}>
                  <td className={td}>
                    <button className="font-semibold text-brand-700 hover:underline" onClick={() => setParams({ id: s.id })} aria-label={`${s.name} details`}>
                      {s.name}
                    </button>
                    <span className="block text-xs text-ink-2">{s.id}</span>
                  </td>
                  <td className={td}>{s.destination}</td>
                  <td className={td}>{s.duration}</td>
                  <td className={`${td} tnum`}>{peso(s.price)}</td>
                  <td className={`${td} tnum`}>{u.upcoming}</td>
                  <td className={td}>
                    <Badge tone={s.inactive ? 'neutral' : 'ok'}>{s.inactive ? 'Deactivated' : 'Active'}</Badge>
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>
        {sel && use && (
          <DetailCard label={`${sel.name} details`} title={sel.name} subtitle={`${sel.destination} · ${sel.duration}`} onClose={() => setParams({})}>
            <p className="text-sm text-ink-2">{sel.summary}</p>
            <div className="mt-3">
              <Row label="Price">{peso(sel.price)} per person</Row>
              <Row label="Pickup">
                {fmtTime(sel.pickupTime)} at {sel.pickup}
              </Row>
              <Row label="Departures on record">{use.departures}</Row>
              <Row label="Upcoming bookings">{use.upcoming}</Row>
            </div>
            <h3 className="mt-4 mb-1 text-xs font-semibold tracking-wide text-ink-3 uppercase">Itinerary</h3>
            <ul className="list-disc space-y-0.5 pl-5 text-sm text-ink-2">
              {sel.itinerary.map((l) => (
                <li key={l}>{l}</li>
              ))}
            </ul>
            <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
              <Button variant="secondary" onClick={() => setEdit(sel)}>
                Edit
              </Button>
              <Button variant="secondary" onClick={() => setConfirm('toggle')}>
                {sel.inactive ? 'Reactivate' : 'Deactivate'}
              </Button>
              <Button variant="ghost" onClick={() => setConfirm('delete')}>
                Delete
              </Button>
            </div>
          </DetailCard>
        )}
      </div>
      <PackageForm key={edit === 'new' ? 'new' : edit?.id ?? 'none'} target={edit} onClose={() => setEdit(null)} />
      {sel && use && (
        <>
          <ConfirmDialog
            open={confirm === 'toggle'}
            onClose={() => setConfirm(null)}
            title={sel.inactive ? `Reactivate ${sel.name}?` : `Deactivate ${sel.name}?`}
            body={
              sel.inactive
                ? 'The package can take bookings again on its open departures.'
                : use.upcoming > 0
                  ? `${use.upcoming} upcoming ${use.upcoming === 1 ? 'booking stays' : 'bookings stay'} as ${use.upcoming === 1 ? 'it is' : 'they are'}, and staff still run ${use.upcoming === 1 ? 'that trip' : 'those trips'}. The package takes no new bookings.`
                  : 'The package takes no new bookings. Past bookings keep their records.'
            }
            confirmLabel={sel.inactive ? 'Reactivate' : 'Deactivate'}
            tone={sel.inactive ? 'primary' : 'danger'}
            onConfirm={() => {
              const r = setPackageActive(sel.id, !!sel.inactive)
              if (!r.ok) return r.error
              toast(sel.inactive ? `${sel.name} reactivated.` : `${sel.name} deactivated.`)
            }}
          />
          <ConfirmDialog
            open={confirm === 'delete'}
            onClose={() => setConfirm(null)}
            title={`Delete ${sel.name}?`}
            body={use.bookings > 0 ? `This package has ${use.bookings} ${use.bookings === 1 ? 'booking' : 'bookings'} on record, so it cannot be deleted. Deactivate it instead.` : 'The package and its departures are removed. This cannot be undone.'}
            confirmLabel="Delete package"
            tone="danger"
            onConfirm={() => {
              const r = deletePackage(sel.id)
              if (!r.ok) return r.error
              setParams({})
              toast('Package deleted.')
            }}
          />
        </>
      )}
    </div>
  )
}

function PackageForm({ target, onClose }: { target: Service | 'new' | null; onClose: () => void }) {
  const { data, savePackage } = useAdmin()
  const toast = useUi((s) => s.toast)
  const s = target && target !== 'new' ? target : undefined
  const [f, setF] = useState(() => ({
    name: s?.name ?? '', destinationId: s?.destinationId ?? data.destinations[0].id, duration: s?.duration ?? '', days: s?.days ?? 1, price: s?.price ?? 0,
    pickup: s?.pickup ?? 'Malolos, Bulacan', pickupTime: s?.pickupTime ?? '05:00', summary: s?.summary ?? '',
    itinerary: s?.itinerary.join('\n') ?? '', inclusions: s?.inclusions.join('\n') ?? '', exclusions: s?.exclusions.join('\n') ?? '',
  }))
  return (
    <FormDialog
      open={!!target}
      wide
      onClose={onClose}
      title={s ? `Edit ${s.name}` : 'Add a tour package'}
      saveLabel={s ? 'Save changes' : 'Add package'}
      onSave={() => {
        const input: PackageInput = { ...f, itinerary: linesOf(f.itinerary), inclusions: linesOf(f.inclusions), exclusions: linesOf(f.exclusions) }
        const r = savePackage(s?.id ?? null, input)
        if (!r.ok) return r.error
        toast(s ? 'Package saved.' : `${f.name.trim()} added.`)
      }}
    >
      <TextField label="Package name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Batangas Beach Day" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Destination" value={f.destinationId} onChange={(e) => setF({ ...f, destinationId: e.target.value })}>
          {data.destinations.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <TextField label="Price per person (₱)" type="number" inputMode="numeric" min={0} value={f.price || ''} onChange={(e) => setF({ ...f, price: Number(e.target.value) || 0 })} />
        <TextField label="Duration" value={f.duration} onChange={(e) => setF({ ...f, duration: e.target.value })} placeholder="2 days / 1 night" />
        <TextField label="Days" type="number" inputMode="numeric" min={1} max={10} value={f.days} onChange={(e) => setF({ ...f, days: Number(e.target.value) })} />
        <TextField label="Pickup point" value={f.pickup} onChange={(e) => setF({ ...f, pickup: e.target.value })} />
        <TextField label="Pickup time" type="time" value={f.pickupTime} onChange={(e) => setF({ ...f, pickupTime: e.target.value })} />
      </div>
      <TextArea label="Summary" rows={2} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} />
      <TextArea label="Itinerary, one line per stop or day" rows={4} value={f.itinerary} onChange={(e) => setF({ ...f, itinerary: e.target.value })} />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextArea label="Inclusions, one per line" rows={3} value={f.inclusions} onChange={(e) => setF({ ...f, inclusions: e.target.value })} />
        <TextArea label="Exclusions, one per line" rows={3} value={f.exclusions} onChange={(e) => setF({ ...f, exclusions: e.target.value })} />
      </div>
    </FormDialog>
  )
}
