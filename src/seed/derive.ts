import { canonical, MARIA_SCENARIO } from './canonical'
import type { Dataset } from './types'

/** Admin demo: every canonical record, including the pre-seeded copy of Maria's booking. */
export function adminSeed(): Dataset {
  const d = structuredClone(canonical)
  d.notifications = d.notifications.filter((n) => !n.customerId)
  return d
}

/**
 * Customer demo: the canonical records minus Maria's scenario booking, so the presenter can create it live.
 * Sequence numbers start where the scenario records sit, so the live booking gets the same reference
 * (BK-2026-0148, PAY-2026-0192) as the admin's pre-seeded copy. The two demos never share state.
 */
export function customerSeed(): Dataset {
  const d = structuredClone(canonical)
  d.bookings = d.bookings.filter((b) => b.scenario !== MARIA_SCENARIO)
  d.payments = d.payments.filter((p) => p.scenario !== MARIA_SCENARIO)
  d.notifications = d.notifications.filter((n) => n.customerId)
  d.next = { ...d.next, booking: 148, payment: 192 }
  return d
}
