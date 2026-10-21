import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { fmtStamp, peso } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import type { PaymentStatus } from '../../seed/types'
import { LocalTag, StatusBadge } from '../../ui/Badge'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { PageHeader } from './AdminRoutes'
import { customerOf, MiniKpi, paginate, Pager, SearchInput, Table, Tabs, td } from './common'

export function Payments() {
  const data = useAdmin((s) => s.data)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as PaymentStatus) || 'Submitted'
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)
  const needle = q.trim().toLowerCase()
  const rows = data.payments
    .filter((p) => p.status === tab)
    .filter((p) => {
      const b = data.bookings.find((x) => x.id === p.bookingId)
      return !needle || `${p.id} ${p.bookingId} ${p.reference} ${b && customerOf(data, b.customerId)?.name}`.toLowerCase().includes(needle)
    })
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  const pg = paginate(rows, page)
  const sum = (s: PaymentStatus) => data.payments.filter((p) => p.status === s).reduce((n, p) => n + p.amount, 0)

  return (
    <div>
      <PageHeader title="Payments" subtitle="Each payment is reviewed on its own. Only verified amounts count as paid." />
      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniKpi label="Awaiting verification" value={peso(sum('Submitted'))} />
        <MiniKpi label="Verified (all time)" value={peso(sum('Verified'))} />
        <MiniKpi label="Rejected" value={data.payments.filter((p) => p.status === 'Rejected').length} />
      </div>
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
          <Tabs
            value={tab}
            onChange={(v) => { setParams({ tab: v }, { replace: true }); setPage(1) }}
            items={(['Submitted', 'Verified', 'Rejected'] as PaymentStatus[]).map((s) => ({ key: s, label: s, count: data.payments.filter((p) => p.status === s).length }))}
          />
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search payment, booking or reference" />
        </div>
        <Table
          head={['Payment', 'Booking', 'Customer', 'Amount', 'Method', 'Reference', 'Sent', 'Status', '']}
          empty={rows.length === 0 && <EmptyState title={tab === 'Submitted' ? 'Nothing to verify' : 'No payments here'} body={tab === 'Submitted' ? 'New payment proofs from customers appear here.' : undefined} />}
        >
          {pg.rows.map((p) => {
            const b = data.bookings.find((x) => x.id === p.bookingId)!
            return (
              <tr key={p.id}>
                <td className={td}>
                  <span className="font-medium text-ink">{p.id}</span>
                  {p.origin === 'local' && <LocalTag />}
                </td>
                <td className={td}>{p.bookingId}</td>
                <td className={td}>{customerOf(data, b.customerId)?.name}</td>
                <td className={`${td} tnum`}>
                  {peso(p.amount)}
                  <span className="block text-xs text-ink-2">{p.type}</span>
                </td>
                <td className={td}>{p.method}</td>
                <td className={td}>{p.reference}</td>
                <td className={`${td} whitespace-nowrap`}>{fmtStamp(p.submittedAt)}</td>
                <td className={td}>
                  <StatusBadge status={p.status} />
                </td>
                <td className={td}>
                  <Link to={`/admin/bookings?id=${p.bookingId}`} className="font-semibold whitespace-nowrap text-brand-700 hover:underline">
                    {p.status === 'Submitted' ? 'Review' : 'View'}
                  </Link>
                </td>
              </tr>
            )
          })}
        </Table>
        <Pager {...pg} onPage={setPage} />
      </Card>
    </div>
  )
}
