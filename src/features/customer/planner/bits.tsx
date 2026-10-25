import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { peso } from '../../../lib/format'
import { budgetOf, pickupLabel, tripDays, type PlannerAnswers } from '../../../domain/planner/engine'

/** The planner's small label on each screen. */
export function PlannerLabel({ className = '' }: { className?: string }) {
  return (
    <p className={`inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-brand-700 uppercase ${className}`}>
      <Sparkles className="size-3.5" aria-hidden /> TAMS Trip Planner
    </p>
  )
}

/** A large selectable card: radio or checkbox semantics come from the input inside. */
export function ChoiceCard({
  type = 'radio', name, checked, onChange, title, body, icon, compact,
}: {
  type?: 'radio' | 'checkbox'
  name: string
  checked: boolean
  onChange: () => void
  title: string
  body?: ReactNode
  icon?: ReactNode
  compact?: boolean
}) {
  return (
    <label
      className={`group relative flex cursor-pointer items-start gap-3 rounded-2xl border bg-surface transition-[border-color,background-color,box-shadow] has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-300 ${compact ? 'px-3.5 py-3' : 'px-4 py-3.5'} ${
        checked ? 'border-brand-600 bg-brand-50 shadow-[inset_0_0_0_1px_var(--color-brand-600)]' : 'border-line hover:border-brand-300'
      }`}
    >
      <input type={type} name={name} checked={checked} onChange={onChange} className="sr-only" />
      {icon && <span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-xl ${checked ? 'bg-brand-600 text-white' : 'bg-surface-muted text-brand-700'}`}>{icon}</span>}
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-ink">{title}</span>
        {body && <span className="mt-0.5 block text-[13px] leading-snug text-ink-2">{body}</span>}
      </span>
      <span
        aria-hidden
        className={`mt-1 grid size-5 shrink-0 place-items-center border-2 ${type === 'radio' ? 'rounded-full' : 'rounded-md'} ${checked ? 'border-brand-600 bg-brand-600' : 'border-line-strong bg-surface'}`}
      >
        {checked && (type === 'radio' ? <span className="size-2 rounded-full bg-white" /> : <svg viewBox="0 0 12 12" className="size-3 text-white"><path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>)}
      </span>
    </label>
  )
}

/** Number stepper with buttons and a typed value. */
export function Stepper({ label, value, onChange, min = 0, max = 24, hint, error }: { label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; hint?: string; error?: string }) {
  const set = (n: number) => onChange(Math.min(max, Math.max(min, n)))
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium text-ink" id={`${label}-label`}>{label}</p>
      <div className="inline-flex items-center rounded-xl border border-line-strong bg-surface" role="group" aria-labelledby={`${label}-label`}>
        <button type="button" onClick={() => set(value - 1)} disabled={value <= min} className="grid size-10 place-items-center text-lg font-semibold text-brand-700 disabled:text-ink-3" aria-label={`Fewer: ${label}`}>
          −
        </button>
        <input
          type="number"
          inputMode="numeric"
          aria-label={label}
          value={Number.isFinite(value) ? value : ''}
          min={min}
          max={max}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Math.round(Number(e.target.value)))}
          className="tnum h-10 w-14 border-x border-line bg-transparent text-center text-[15px] font-semibold text-ink focus:outline-none"
        />
        <button type="button" onClick={() => set((Number.isFinite(value) ? value : min) + 1)} disabled={value >= max} className="grid size-10 place-items-center text-lg font-semibold text-brand-700 disabled:text-ink-3" aria-label={`More: ${label}`}>
          +
        </button>
      </div>
      {error ? <p className="mt-1.5 text-xs font-medium text-bad" role="alert">{error}</p> : hint ? <p className="mt-1.5 text-xs text-ink-2">{hint}</p> : null}
    </div>
  )
}

export const daysText = (n: number) => (n === 1 ? 'Day trip' : `${n} days, ${n - 1} ${n - 1 === 1 ? 'night' : 'nights'}`)

export function datesText(a: PlannerAnswers, fmt: (s: string, e: string) => string) {
  if (a.dates.mode === 'exact' && a.dates.start && a.dates.end) return fmt(a.dates.start, a.dates.end)
  if (a.dates.mode === 'flexible') return `Flexible dates · ${a.dates.window}`
  if (a.dates.mode === 'undecided') return 'Dates not decided yet'
  return 'Dates not set'
}

export function budgetText(a: PlannerAnswers) {
  const b = budgetOf(a)
  if (a.budget.basis === 'help') return 'Help me estimate'
  if (!b) return 'Not set'
  return a.budget.basis === 'person' ? `${peso(b.perPerson)} per person` : `${peso(b.group)} for the group (about ${peso(b.perPerson)} each)`
}

export function groupText(a: PlannerAnswers) {
  const extra = [a.group.children ? `${a.group.children} ${a.group.children === 1 ? 'child' : 'children'}` : '', a.group.seniors ? `${a.group.seniors} ${a.group.seniors === 1 ? 'senior' : 'seniors'}` : ''].filter(Boolean).join(', ')
  return `${a.group.type || 'Group'} of ${a.group.size || '?'}${extra ? ` (${extra})` : ''}`
}

export const summaryOf = (a: PlannerAnswers) => ({ days: daysText(tripDays(a)), pickup: pickupLabel(a) || 'Not set' })
