import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { fmtStamp } from '../../lib/format'
import type { AppNotification, Dataset } from '../../seed/types'

export const customerOf = (d: Dataset, id: string) => d.customers.find((c) => c.id === id)
export const serviceOf = (d: Dataset, id: string) => d.services.find((s) => s.id === id)!

export function Kpi({ label, value, note, to, emphasis }: { label: string; value: ReactNode; note?: ReactNode; to?: string; emphasis?: boolean }) {
  const body = (
    <>
      <p className={`text-sm font-medium ${emphasis ? 'text-brand-100' : 'text-ink-2'}`}>{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold tnum ${emphasis ? 'text-white' : 'text-brand-900'}`}>{value}</p>
      {note && <p className={`mt-1 text-xs ${emphasis ? 'text-brand-100' : 'text-ink-2'}`}>{note}</p>}
    </>
  )
  const cls = `block rounded-2xl p-5 shadow-card ${emphasis ? 'bg-gradient-to-br from-brand-600 to-brand-800' : 'border border-line bg-surface'} ${to ? 'transition hover:border-brand-300 hover:shadow-pop' : ''}`
  return to ? (
    <Link to={to} className={cls}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Light KPI tile used on list pages (brand-50 with brand-900 text, spec section 8). */
export function MiniKpi({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-2xl bg-brand-50 px-4 py-3">
      <p className="text-xs font-medium text-brand-700">{label}</p>
      <p className="font-display text-xl font-bold text-brand-900 tnum">{value}</p>
    </div>
  )
}

export function ActivityList({ items, limit }: { items: AppNotification[]; limit?: number }) {
  const list = limit ? items.slice(0, limit) : items
  return (
    <ul className="divide-y divide-line">
      {list.map((n) => (
        <li key={n.id}>
          <Link to={n.link ?? '/admin/notifications'} className="flex gap-3 px-1 py-3 hover:bg-surface-muted">
            <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-line' : 'bg-brand-600'}`} aria-label={n.read ? undefined : 'Unread'} />
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-ink">{n.title}</span>
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
