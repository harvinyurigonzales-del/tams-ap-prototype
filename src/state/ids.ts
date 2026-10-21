import type { Dataset } from '../seed/types'

type Kind = keyof Dataset['next']
const PREFIX: Record<Kind, (n: number) => string> = {
  booking: (n) => `BK-2026-${String(n).padStart(4, '0')}`,
  payment: (n) => `PAY-2026-${String(n).padStart(4, '0')}`,
  assignment: (n) => `ASG-${String(n).padStart(2, '0')}`,
  notification: (n) => `NTF-${String(n).padStart(4, '0')}`,
  customer: (n) => `CUS-${String(n).padStart(4, '0')}`,
}

/** Returns the next ID of a kind and advances the counter on the (draft) dataset. */
export function nextId(d: Dataset, kind: Kind) {
  const id = PREFIX[kind](d.next[kind])
  d.next = { ...d.next, [kind]: d.next[kind] + 1 }
  return id
}
