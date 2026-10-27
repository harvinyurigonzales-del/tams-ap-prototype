import { useEffect, useState } from 'react'
import { driverConflict, shortRange, vehicleConflict, type AssignTarget } from '../../domain/rules'
import { useAdmin } from '../../state/adminStore'
import { useUi } from '../../state/ui'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'

/** Assign a van and driver. Options that would conflict are disabled and say why (R10). */
export function AssignDialog({ target, onClose }: { target: (AssignTarget & { assignment?: { vehicleId: string; driverId: string } }) | null; onClose: () => void }) {
  const { data, assign } = useAdmin()
  const toast = useUi((s) => s.toast)
  const [van, setVan] = useState('')
  const [driver, setDriver] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setVan(target?.assignment?.vehicleId ?? '')
    setDriver(target?.assignment?.driverId ?? '')
    setError('')
  }, [target])
  if (!target) return null

  const save = async () => {
    if (!van || !driver) return setError('Choose a van and a driver.')
    setBusy(true)
    await new Promise((r) => setTimeout(r, 400))
    const r = assign({ kind: target.kind, id: target.id }, van, driver)
    setBusy(false)
    if (!r.ok) return setError(r.error)
    toast(`Assigned to ${target.label}, ${shortRange(target.from, target.to)}.`)
    onClose()
  }

  return (
    <Dialog
      open
      wide
      onClose={onClose}
      title={target.assignment ? 'Change van and driver' : 'Assign van and driver'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={save} loading={busy}>
            Save assignment
          </Button>
        </>
      }
    >
      <p className="mb-4 text-ink">
        <span className="font-semibold">{target.label}</span> · {shortRange(target.from, target.to)} · {target.pax} passengers
      </p>
      <div className="grid gap-5 md:grid-cols-2">
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Van</legend>
          <div className="space-y-2">
            {data.vehicles.filter((v) => v.active !== false || v.id === van).map((v) => {
              const why = vehicleConflict(data, v, target)
              return (
                <label
                  key={v.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${why ? 'cursor-not-allowed border-line bg-surface-muted opacity-75' : van === v.id ? 'cursor-pointer border-brand-600 bg-brand-50' : 'cursor-pointer border-line hover:border-brand-300'}`}
                >
                  <input type="radio" name="van" className="mt-1 size-4 accent-brand-600" disabled={!!why} checked={van === v.id} onChange={() => setVan(v.id)} aria-describedby={`van-${v.id}`} />
                  <span>
                    <span className="block text-sm font-semibold text-ink">
                      {v.name} · {v.plate}
                    </span>
                    <span id={`van-${v.id}`} className={`block text-xs ${why ? 'text-bad' : 'text-ink-2'}`}>
                      {why ?? `${v.model}, ${v.seats} seats`}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
        <fieldset>
          <legend className="mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Driver</legend>
          <div className="space-y-2">
            {data.drivers.filter((d) => d.active !== false || d.id === driver).map((d) => {
              const why = driverConflict(data, d, target)
              return (
                <label
                  key={d.id}
                  className={`flex items-start gap-3 rounded-xl border px-3 py-2.5 ${why ? 'cursor-not-allowed border-line bg-surface-muted opacity-75' : driver === d.id ? 'cursor-pointer border-brand-600 bg-brand-50' : 'cursor-pointer border-line hover:border-brand-300'}`}
                >
                  <input type="radio" name="driver" className="mt-1 size-4 accent-brand-600" disabled={!!why} checked={driver === d.id} onChange={() => setDriver(d.id)} aria-describedby={`drv-${d.id}`} />
                  <span>
                    <span className="block text-sm font-semibold text-ink">{d.name}</span>
                    <span id={`drv-${d.id}`} className={`block text-xs ${why ? 'text-bad' : 'text-ink-2'}`}>
                      {why ?? `${d.id} · available`}
                    </span>
                  </span>
                </label>
              )
            })}
          </div>
        </fieldset>
      </div>
      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
          {error}
        </p>
      )}
    </Dialog>
  )
}
