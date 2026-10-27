import type { ReactNode } from 'react'

type Tone = 'brand' | 'ok' | 'warn' | 'bad' | 'info' | 'neutral'

const TONE: Record<Tone, string> = {
  brand: 'bg-brand-100 text-brand-700',
  ok: 'bg-ok-bg text-ok',
  warn: 'bg-warn-bg text-warn',
  bad: 'bg-bad-bg text-bad',
  info: 'bg-info-bg text-info',
  neutral: 'bg-surface-muted text-ink-2',
}

/** One mapping table for every status in the app (spec section 8). */
const STATUS_TONE: Record<string, Tone> = {
  Pending: 'warn',
  Confirmed: 'brand',
  Completed: 'ok',
  Cancelled: 'bad',
  Submitted: 'warn',
  Verified: 'ok',
  Rejected: 'bad',
  Unpaid: 'neutral',
  'Cancellation requested': 'warn',
  'Partially paid': 'brand',
  'Fully paid': 'ok',
  Available: 'ok',
  'On a trip': 'brand',
  Assigned: 'brand',
  Maintenance: 'warn',
  Unavailable: 'bad',
  'On leave': 'bad',
  Inactive: 'neutral',
  Scheduled: 'info',
  'In Maintenance': 'warn',
  Overdue: 'bad',
  'Needs reassignment': 'bad',
  Open: 'ok',
  Full: 'bad',
  Closed: 'neutral',
  'Under review': 'info',
  'Proposal ready': 'brand',
  'Quote ready': 'brand',
  Accepted: 'ok',
  Expired: 'neutral',
  'Awaiting staff': 'warn',
  'Staff replied': 'brand',
  Resolved: 'ok',
}

/** Customer-facing wording for payment verification states. */
const LABEL: Record<string, string> = { Submitted: 'Awaiting verification' }

export function Badge({ tone = 'neutral', children, className = '' }: { tone?: Tone; children: ReactNode; className?: string }) {
  return <span className={`inline-flex h-6 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap ${TONE[tone]} ${className}`}>{children}</span>
}

export function StatusBadge({ status, customer = false }: { status: string; customer?: boolean }) {
  return <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{customer ? (LABEL[status] ?? status) : status}</Badge>
}

/** Marks records created on the site since the sample data was loaded. */
export function LocalTag() {
  return <Badge tone="info" className="h-5 px-2 text-[11px]">New</Badge>
}

export function SampleTag({ children = 'Sample policy' }: { children?: ReactNode }) {
  return <span className="ml-1.5 rounded border border-line px-1.5 py-px text-[10px] font-semibold tracking-wide text-ink-3 uppercase">{children}</span>
}
