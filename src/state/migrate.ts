import { agreedOf, packageStatus } from '../domain/packages'
import { addSeasonal } from '../seed/seasonal'
import type { MaintenanceRecord } from '../seed/derive'
import type { Dataset } from '../seed/types'

// Saved data from earlier versions of the prototype is upgraded in place, step by step, so accounts, bookings and
// customer progress survive an update. Each step only adds or fills in what that version introduced.

export const DATA_VERSION = 4

interface Stored {
  v: number
  data: Dataset
  maintenance: MaintenanceRecord[]
}

/**
 * Fills in fields every current record needs. Safe to run more than once, and run on the fresh seed too, so new
 * and upgraded data have the same shape.
 */
export function normalize(d: Dataset) {
  d.activity ??= []
  d.refunds ??= []
  d.drafts ??= []
  d.previews ??= []
  d.next = { ...d.next, activity: d.next.activity ?? 1, refund: d.next.refund ?? 1, draft: d.next.draft ?? 1 }
  for (const s of d.services) {
    if (s.type !== 'tour') continue
    s.status = packageStatus(s)
    s.inactive = s.status !== 'Active'
  }
  // Van and driver blocks get ids so staff can edit or remove a single period.
  for (const owner of [...d.vehicles, ...d.drivers]) {
    let n = Math.max(0, ...owner.blocks.map((b) => Number(b.id?.split('-').pop()) || 0))
    for (const b of owner.blocks) b.id ??= `${owner.id}-${++n}`
  }
  // Bookings made before the agreed terms were stored keep the package as it was when this version first loaded.
  for (const b of d.bookings) b.agreed ??= agreedOf(d, b)
}

const steps: Record<number, (s: Stored) => void> = {
  // v1 → v2: package statuses, booking snapshots, activity history, refunds, drafts and timeline previews.
  1: (s) => normalize(s.data),
  // v2 → v3: seasonal package examples.
  2: (s) => addSeasonal(s.data),
  // v3 → v4: maintenance lifecycle (Scheduled, In Maintenance, Completed, Cancelled); "Done" becomes Completed.
  3: (s) => {
    for (const m of s.maintenance ?? []) {
      if ((m.status as string) === 'Done') {
        m.status = 'Completed'
        m.completedOn ??= m.doneAt?.slice(0, 10)
      }
    }
  },
}

/** Upgrades a saved copy to the current version, or returns null when it cannot be read. */
export function upgrade<T extends Stored>(s: T | null | undefined): T | null {
  if (!s || typeof s.v !== 'number' || !s.data?.bookings || s.v > DATA_VERSION) return null
  while (s.v < DATA_VERSION) {
    const step = steps[s.v]
    if (!step) return null
    step(s)
    s.v += 1
  }
  normalize(s.data)
  return s
}
