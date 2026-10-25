import { useEffect, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { Dialog } from '../../ui/Dialog'
import { Link } from 'react-router-dom'
import { fmtStamp } from '../../lib/format'
import type { AppNotification, Dataset } from '../../seed/types'
import { useAdmin } from '../../state/adminStore'

export const customerOf = (d: Dataset, id: string) => d.customers.find((c) => c.id === id)
export const serviceOf = (d: Dataset, id: string) => d.services.find((s) => s.id === id)!

export function Kpi({ label, value, note, to, emphasis }: { label: string; value: ReactNode; note?: ReactNode; to?: string; emphasis?: boolean }) {
  const body = (
    <>
      <p className={`text-sm font-medium ${emphasis ? 'text-white/80' : 'text-ink-2'}`}>{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tnum ${emphasis ? 'text-white' : 'text-charcoal'}`}>{value}</p>
      {note && <p className={`mt-1 text-xs ${emphasis ? 'text-white/80' : 'text-ink-2'}`}>{note}</p>}
    </>
  )
  const cls = `block rounded-2xl p-5 shadow-card ${emphasis ? 'relative overflow-hidden bg-navy' : 'border border-line bg-surface'} ${to ? 'transition hover:border-brand-300 hover:shadow-pop' : ''}`
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Light KPI tile used on list pages. */
export function MiniKpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card">
      <p className="text-xs font-medium text-ink-2">{label}</p>
      <p className="font-display text-xl font-bold text-charcoal tnum">{value}</p>
    </div>
  )
}

export function ActivityList({ items, limit }: { items: AppNotification[]; limit?: number }) {
  const markRead = useAdmin((s) => s.markRead)
  const list = limit ? items.slice(0, limit) : items
  return (
    <ul className="divide-y divide-line">
      {list.map((n) => (
        <li key={n.id}>
          <Link to={n.link ?? '/admin/notifications'} onClick={() => markRead(n.id)} className="flex gap-3 px-1 py-3 hover:bg-surface-muted">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-sili'}`} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className={`block text-sm ${n.read ? 'font-medium text-ink-2' : 'font-semibold text-ink'}`}>
                {n.title}
                {!n.read && <span className="sr-only"> (unread)</span>}
              </span>
              <span className="block text-sm text-ink-2">{n.body}</span>
              <span className="block text-xs text-ink-3">
                {fmtStamp(n.at)} · {n.category}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; count?: number }[] }) {
  return (
    <div role="tablist" className="inline-flex max-w-full overflow-x-auto rounded-xl bg-surface-muted p-1">
      {items.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={value === t.key}
          onClick={() => onChange(t.key)}
          className={`h-8 shrink-0 rounded-lg px-3 text-sm font-semibold whitespace-nowrap ${value === t.key ? 'bg-surface text-brand-700 shadow-card' : 'text-ink-2 hover:text-ink'}`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 text-ink-3 tnum">{t.count}</span>}
        </button>
      ))}
    </div>
  )
}

export function Table({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-surface-muted text-xs font-semibold tracking-wide text-ink-2 uppercase">
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col" className="px-4 py-2.5 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">{children}</tbody>
      </table>
      {empty}
    </div>
  )
}

export const td = 'px-4 py-3 align-middle'

export function SearchInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      aria-label={placeholder}
      className="h-9 w-full rounded-lg border border-line bg-surface px-3 text-sm placeholder:text-ink-3 focus:border-brand-500 focus:outline-none sm:w-64"
    />
  )
}

export function Pager({ page, pages, onPage, total, from, to }: { page: number; pages: number; onPage: (p: number) => void; total: number; from: number; to: number }) {
  if (total === 0) return null
  return (
    <div className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-ink-2">
      <span className="tnum">
        Showing {from}–{to} of {total}
      </span>
      <div className="flex gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg border border-line px-3 py-1 disabled:opacity-40">
          Previous
        </button>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg border border-line px-3 py-1 disabled:opacity-40">
          Next
        </button>
      </div>
    </div>
  )
}

export function paginate<T>(rows: T[], page: number, size = 8) {
  const pages = Math.max(1, Math.ceil(rows.length / size))
  const p = Math.min(page, pages)
  return { rows: rows.slice((p - 1) * size, p * size), page: p, pages, from: rows.length ? (p - 1) * size + 1 : 0, to: Math.min(p * size, rows.length), total: rows.length }
}

/** Add or edit form in a dialog. onSave returns an error to keep the dialog open, or nothing to close it. */
export function FormDialog({ open, onClose, title, saveLabel = 'Save', onSave, children, wide }: { open: boolean; onClose: () => void; title: string; saveLabel?: string; onSave: () => string | void; children: ReactNode; wide?: boolean }) {
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) setError('')
  }, [open])
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={title}
      wide={wide}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              const err = onSave()
              if (err) setError(err)
              else onClose()
            }}
          >
            {saveLabel}
          </Button>
        </>
      }
    >
      <form
        className="space-y-4"
        noValidate
        onSubmit={(e) => {
          e.preventDefault()
        }}
      >
        {children}
        {error && (
          <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
            {error}
          </p>
        )}
      </form>
    </Dialog>
  )
}

/** Side card that shows one record's details next to a list. */
export function DetailCard({ title, subtitle, onClose, children, label }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; label: string }) {
  return (
    <Card className="h-fit p-5" role="complementary" aria-label={label}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-ink-2">{subtitle}</p>}
        </div>
        <button onClick={onClose} className="-mr-1 rounded-lg p-1 text-ink-2 hover:bg-surface-muted" aria-label="Close details">
          <X className="size-5" />
        </button>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  )
}

/** Splits a textarea into lines. */
export const linesOf = (s: string) => s.split('\n').map((l) => l.trim()).filter(Boolean)
