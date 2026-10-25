import { SEED_SHIFT_DAYS, SEED_SHIFT_MONTHS } from '../lib/demoClock'
import { canonical, MARIA_SCENARIO } from '../seed/canonical'
import { shiftDataset } from '../seed/shift'
import type { Dataset } from '../seed/types'
import { useAdmin } from '../state/adminStore'
import { useCustomer } from '../state/customerStore'

// The canonical records (with Maria's history) moved to the demo date. The app itself starts from sharedSeed(),
// where Maria is clean; these fixtures keep the original records for tests of domain rules and figures.

const current = () => shiftDataset(canonical, SEED_SHIFT_DAYS, SEED_SHIFT_MONTHS)

/** Every canonical record, including Maria's bookings, requests and reviews. */
export function canonicalFixture(): Dataset {
  return structuredClone(current())
}

/** Canonical records with staff notifications only. */
export function adminFixture(): Dataset {
  const d = canonicalFixture()
  d.notifications = d.notifications.filter((n) => !n.customerId)
  return d
}

/** Canonical records minus Maria's scenario booking, with customer notifications only. */
export function customerFixture(): Dataset {
  const d = canonicalFixture()
  d.bookings = d.bookings.filter((b) => b.scenario !== MARIA_SCENARIO)
  d.payments = d.payments.filter((p) => p.scenario !== MARIA_SCENARIO)
  d.notifications = d.notifications.filter((n) => n.customerId)
  d.next = { ...d.next, booking: 148, payment: 192 }
  return d
}

/** Puts a fixture into both stores, as the shared data the app would hold. */
export function loadFixture(d: Dataset) {
  useCustomer.setState({ data: structuredClone(d) })
  useAdmin.setState({ data: structuredClone(d) })
}
