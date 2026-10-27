import { nextId } from '../state/ids'
import type { ActivityChange, ActivityEntry, Dataset } from '../seed/types'

// Activity history for the admin modules: who changed which record, when, and what changed.

/** Adds an entry to the front of the history. */
export function logActivity(d: Dataset, at: string, e: Omit<ActivityEntry, 'id' | 'at'>) {
  d.activity = [{ id: nextId(d, 'activity'), at, ...e }, ...(d.activity ?? [])]
}

const show = (v: unknown): string => {
  if (v === undefined || v === null || v === '') return '—'
  if (Array.isArray(v)) return v.length ? `${v.length} ${v.length === 1 ? 'line' : 'lines'}` : '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  return String(v)
}

/** Fields that differ between two versions of a record, with readable labels. Lists compare by content. */
export function changesOf<T extends object>(before: T, after: T, labels: Partial<Record<keyof T, string>>, format: Partial<Record<keyof T, (v: unknown) => string>> = {}): ActivityChange[] {
  const out: ActivityChange[] = []
  for (const key of Object.keys(labels) as (keyof T)[]) {
    const a = before[key]
    const b = after[key]
    if (JSON.stringify(a ?? null) === JSON.stringify(b ?? null)) continue
    const f = format[key] ?? show
    out.push({ field: labels[key]!, from: f(a), to: f(b) })
  }
  return out
}
