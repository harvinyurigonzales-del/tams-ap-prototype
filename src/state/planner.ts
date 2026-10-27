import { create } from 'zustand'
import { demoNowStamp } from '../lib/demoClock'
import {
  buildPlan, emptyAnswers, rankDestinations, refitDays, sampleAnswers, tripDays, type PlannerAnswers, type TripPlan,
} from '../domain/planner/engine'
import type { Destination } from '../seed/types'

// The AI planner's working state. In memory only, like the rest of the demo: it survives moving around the app
// and logging in, and is cleared by Reset Demo.

export type PlannerStep = 'intro' | 'questions' | 'planning' | 'result' | 'review'

interface PlannerState {
  step: PlannerStep
  /** Index into QUESTIONS while answering. */
  q: number
  answers: PlannerAnswers
  plan: TripPlan | null
  /** Destinations already suggested, so "Suggest another plan" moves on. */
  shown: string[]
  /** Earlier versions of the plan, newest last, for Undo. */
  history: TripPlan[]
  /** What the last change did, shown above the plan. */
  note: string | null
  /** Set when the questions were reopened from the plan, so finishing returns there. */
  editing: boolean
  /** Started from "Try a sample trip". */
  sample: boolean
  savedAt: string | null
  /** The saved draft this plan updates (My Trips → Drafts). */
  draftId: string | null
  /** Stable key for this plan's draft, so saving before and after logging in keeps one draft. */
  draftKey: string
  /** Destination the planner was opened for (from a destination page). */
  openedFor: string | null
  /** Issues the customer chose to leave for staff instead of fixing. */
  kept: string[]
  keepIssue: (id: string) => void

  setAnswers: (fn: (a: PlannerAnswers) => PlannerAnswers) => void
  go: (step: PlannerStep, q?: number) => void
  start: (destinationId?: string | null) => void
  startSample: () => void
  /** Makes the first plan from the answers. */
  generate: (catalog: Destination[]) => void
  /** Replaces the plan, keeping the old one for Undo. */
  update: (plan: TripPlan, note?: string | null) => void
  undo: () => void
  /** Applies changed answers to an existing plan: keep the customer's stops, or start fresh (locked stops stay). */
  reapply: (catalog: Destination[], mode: 'keep' | 'replace') => void
  setNote: (note: string | null) => void
  saveDraft: (draftId?: string | null) => void
  /** Opens a saved draft: its answers and plan come back, with a note on anything that needs changing. */
  resume: (draftId: string, key: string | undefined, saved: { answers: PlannerAnswers; plan: TripPlan | null; shown: string[]; kept: string[] }, note: string | null) => void
  clear: () => void
}

const HISTORY = 20

const newKey = () => `plan-${Math.random().toString(36).slice(2, 10)}`

export function destinationFor(a: PlannerAnswers, catalog: Destination[]): Pick<Destination, 'id' | 'name'> {
  if (a.destination.mode === 'chosen') {
    const d = catalog.find((x) => x.id === a.destination.id)
    if (d) return d
  }
  if (a.destination.mode === 'other') return { id: '', name: a.destination.text.trim() }
  return rankDestinations(a, catalog)[0]?.destination ?? catalog[0]
}

const fresh = () => ({
  step: 'intro' as PlannerStep, q: 0, answers: emptyAnswers(), plan: null as TripPlan | null, shown: [] as string[], history: [] as TripPlan[],
  note: null as string | null, editing: false, sample: false, savedAt: null as string | null, draftId: null as string | null, draftKey: newKey(), openedFor: null as string | null, kept: [] as string[],
})

export const usePlanner = create<PlannerState>((set, get) => ({
  ...fresh(),

  setAnswers: (fn) => set({ answers: fn(get().answers) }),
  go: (step, q) => set({ step, ...(q === undefined ? {} : { q }) }),

  start: (destinationId) => {
    const s = get()
    // Opening the planner again resumes the plan in progress.
    if (s.plan || s.step !== 'intro') return
    const answers = emptyAnswers()
    if (destinationId) answers.destination = { mode: 'chosen', id: destinationId, text: '' }
    set({ answers, openedFor: destinationId ?? null })
  },

  startSample: () => set({ ...fresh(), answers: sampleAnswers(), sample: true, step: 'questions', q: 0 }),

  generate: (catalog) => {
    const a = get().answers
    const dest = destinationFor(a, catalog)
    const plan = buildPlan(a, dest)
    set({ plan, shown: dest.id ? [dest.id] : [], history: [], note: null, editing: false })
  },

  update: (plan, note = null) => {
    const s = get()
    if (!s.plan) return set({ plan, note })
    set({ plan, note, history: [...s.history, s.plan].slice(-HISTORY) })
  },

  undo: () => {
    const s = get()
    const prev = s.history.at(-1)
    if (!prev) return
    set({ plan: prev, history: s.history.slice(0, -1), note: 'Undid the last change.' })
  },

  reapply: (catalog, mode) => {
    const s = get()
    if (!s.plan) return get().generate(catalog)
    const dest = destinationFor(s.answers, catalog)
    const sameDest = dest.id === s.plan.destinationId && dest.name === s.plan.destinationName
    let plan: TripPlan
    if (!sameDest) plan = buildPlan(s.answers, dest)
    else if (mode === 'keep') plan = refitDays(s.plan, s.answers)
    else plan = buildPlan(s.answers, dest, { keep: s.plan.days, lodging: s.answers.prefs.lodging })
    if (plan.days.length !== tripDays(s.answers)) plan = refitDays(plan, s.answers)
    set({
      plan, history: [...s.history, s.plan].slice(-HISTORY), editing: false,
      shown: dest.id && !s.shown.includes(dest.id) ? [...s.shown, dest.id] : s.shown,
      note: !sameDest ? `New plan for ${dest.name}.` : mode === 'keep' ? 'Updated for your new answers. Your stops are kept.' : 'Made a fresh plan for your new answers. Locked stops are kept.',
    })
  },

  keepIssue: (id) => set({ kept: [...new Set([...get().kept, id])] }),
  setNote: (note) => set({ note }),
  saveDraft: (draftId) => set({ savedAt: demoNowStamp(), ...(draftId !== undefined ? { draftId } : {}) }),
  resume: (draftId, key, saved, note) =>
    set({
      ...fresh(), draftKey: key ?? newKey(), answers: structuredClone(saved.answers), plan: structuredClone(saved.plan), shown: [...saved.shown], kept: [...saved.kept], draftId, note,
      step: saved.plan ? 'result' : 'questions',
    }),
  clear: () => set(fresh()),
}))
