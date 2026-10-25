import { X } from 'lucide-react'
import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { money, shortRange } from '../../domain/rules'
import { fmtDate, peso } from '../../lib/format'
import { DEMO_TODAY } from '../../lib/demoClock'
import { useAdmin } from '../../state/adminStore'
import { LocalTag, StatusBadge } from '../../ui/Badge'
import { Card, Row } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { PageHeader } from './AdminRoutes'
import { MiniKpi, paginate, Pager, SearchInput, serviceOf, Table, td } from './common'

export function Customers() {
  const data = useAdmin((s) => s.data)
  const [params, setParams] = useSearchParams()
  const selected = params.get('id')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const needle = q.trim().toLowerCase()
  const stats = (id: string) => {
    const bs = data.bookings.filter((b) => b.customerId === id)
    return { bookings: bs.length, last: bs.map((b) => b.startDate).sort().at(-1) }
  }
  const rows = data.customers.filter((c) => !needle || `${c.id} ${c.name} ${c.email} ${c.mobile} ${c.city}`.toLowerCase().includes(needle))
  const pg = paginate(rows, page)
  const c = selected ? data.customers.find((x) => x.id === selected) : undefined
  const repeat = data.customers.filter((x) => stats(x.id).bookings > 1).length

  return (
    <div>
      <PageHeader title="Customers" subtitle="Customer records with booking history. Contact details are fictional samples." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <MiniKpi label="Customers" value={data.customers.length} />
        <MiniKpi label="Repeat customers" value={repeat} />
        <MiniKpi label={`Registered in ${DEMO_TODAY.slice(0, 4)}`} value={data.customers.filter((x) => x.registered.startsWith(DEMO_TODAY.slice(0, 4))).length} />
      </div>
      <div className={`grid gap-6 ${c ? 'xl:grid-cols-[1fr_380px]' : ''}`}>
        <Card className="min-w-0">
          <div className="border-b border-line p-4">
            <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search name, email, mobile or city" />
          </div>
          <Table head={['Customer', 'Contact', 'City', 'Bookings', 'Last trip']} empty={rows.length === 0 && <EmptyState title="No customers match" />}>
            {pg.rows.map((x) => {
              const st = stats(x.id)
              return (
                <tr key={x.id} onClick={() => setParams({ id: x.id })} className={`cursor-pointer ${selected === x.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}`}>
                  <td className={td}>
                    <button className="font-semibold text-brand-700 hover:underline">{x.name}</button>
                    {x.origin === 'local' && <LocalTag />}
                    <span className="block text-xs text-ink-2">{x.id}</span>
                  </td>
                  <td className={td}>
                    {x.email}
                    <span className="block text-xs text-ink-2">{x.mobile} (sample)</span>
                  </td>
                  <td className={td}>{x.city || '—'}</td>
                  <td className={`${td} tnum`}>{st.bookings}</td>
                  <td className={td}>{st.last ? fmtDate(st.last) : '—'}</td>
                </tr>
              )
            })}
          </Table>
          <Pager {...pg} onPage={setPage} />
        </Card>
        {c && (
          <Card className="h-fit p-5 xl:sticky xl:top-20">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold text-ink">{c.name}</h2>
                <p className="text-sm text-ink-2">{c.id} · since {fmtDate(c.registered)}</p>
              </div>
              <button onClick={() => setParams({})} aria-label="Close" className="rounded-lg p-1 text-ink-2 hover:bg-surface-muted">
                <X className="size-5" />
              </button>
            </div>
            <div className="mt-3">
              <Row label="Email">{c.email}</Row>
              <Row label="Mobile">{c.mobile}</Row>
              <Row label="City">{c.city || '—'}</Row>
            </div>
            <h3 className="mt-5 mb-2 text-xs font-semibold tracking-wide text-ink-3 uppercase">Booking history</h3>
            <ul className="space-y-2">
              {data.bookings
                .filter((b) => b.customerId === c.id)
                .sort((a, b) => b.startDate.localeCompare(a.startDate))
                .map((b) => (
                  <li key={b.id}>
                    <Link to={`/admin/bookings?id=${b.id}`} className="block rounded-xl border border-line p-3 hover:border-brand-300">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-ink">{b.id}</span>
                        <StatusBadge status={b.status} />
                      </div>
                      <p className="text-xs text-ink-2">
                        {serviceOf(data, b.serviceId).name} · {shortRange(b.startDate, b.endDate)} · {peso(b.total)} · {money(b, data.payments).summary}
                      </p>
                    </Link>
                  </li>
                ))}
              {data.bookings.every((b) => b.customerId !== c.id) && <p className="text-sm text-ink-2">No bookings yet.</p>}
            </ul>
          </Card>
        )}
      </div>
    </div>
  )
}
