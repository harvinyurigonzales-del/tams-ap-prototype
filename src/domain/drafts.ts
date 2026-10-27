import { DEMO_TODAY } from '../lib/demoClock'
import type { Dataset, TripDraft } from '../seed/types'
import type { PlannerAnswers, TripPlan } from './planner/engine'

// Saved trip drafts: a planner plan, a custom-trip form or a van-rental form the customer wants to finish later.
// A draft is checked again when it is resumed, because dates pass and places can stop being offered.

export interface PlannerDraft {
  answers: PlannerAnswers
  plan: TripPlan | null
  shown: string[]
  kept: string[]
}

export interface FormDraft {
  startDate?: string
  endDate?: string
  destinationId?: string
  [k: string]: unknown
}

export type DraftInput = Pick<TripDraft, 'kind' | 'title' | 'destination' | 'payload' | 'key'> & { id?: string }

export const DRAFT_KIND_LABEL: Record<TripDraft['kind'], string> = { planner: 'Trip Planner plan', custom: 'Custom trip request', rental: 'Van rental request' }

/** The draft's dates, if it has any. */
function datesOf(dr: Pick<TripDraft, 'kind' | 'payload'>): { start?: string; end?: string } {
  if (dr.kind === 'planner') {
    const a = (dr.payload as PlannerDraft).answers
    return a?.dates.mode === 'exact' ? { start: a.dates.start, end: a.dates.end } : {}
  }
  const f = dr.payload as FormDraft
  return { start: f.startDate || undefined, end: f.endDate || undefined }
}

/** What must change before the draft can be sent. Empty when it is still good to go. */
export function draftProblems(d: Dataset, dr: Pick<TripDraft, 'kind' | 'payload'>, today = DEMO_TODAY): string[] {
  const out: string[] = []
  const { start } = datesOf(dr)
  if (start && start <= today) out.push('The travel dates have passed. Choose new dates.')
  const destId = dr.kind === 'planner' ? (dr.payload as PlannerDraft).plan?.destinationId : (dr.payload as FormDraft).destinationId
  if (destId && !d.destinations.some((x) => x.id === destId)) out.push('This destination is no longer offered. Choose another one.')
  if (dr.kind === 'rental') {
    const cat = (dr.payload as FormDraft).categoryId as string | undefined
    if (cat && !d.vehicleCategories.some((c) => c.id === cat)) out.push('This vehicle type is no longer offered. Choose another one.')
  }
  return out
}

/** Same content, so a draft saved as a guest is not added twice after logging in. */
export const sameDraft = (a: Pick<TripDraft, 'kind' | 'payload' | 'key'>, b: Pick<TripDraft, 'kind' | 'payload' | 'key'>) =>
  a.kind === b.kind && ((!!a.key && a.key === b.key) || JSON.stringify(a.payload) === JSON.stringify(b.payload))
