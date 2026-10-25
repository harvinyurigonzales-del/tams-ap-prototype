import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { money, shortRange } from '../../domain/rules'
import { peso } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import { staffSteps, type StaffStep } from '../../state/customerStore'
import type { BookingStatus } from '../../seed/types'
import { Badge, LocalTag, StatusBadge } from '../../ui/Badge'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { FilterSelect } from '../../ui/Field'
import { PageHeader } from './AdminRoutes'
import { BookingPanel } from './BookingPanel'
import { customerOf, MiniKpi, paginate, Pager, SearchInput, serviceOf, Table, Tabs, td } from './common'

type Tab = 'All' | BookingStatus
type PayFilter = 'All' | 'Submitted' | 'Unpaid' | 'Partially paid' | 'Fully paid'

/** What staff do next on a booking, shown in the list so the stage controls in the details panel are easy to find. */
const NEXT: Partial<Record<StaffStep, string>> = {
  verify: 'Verify payment',
  approveCancel: 'Review cancellation',
  confirm: 'Confirm booking',
  assign: 'Assign van',
  complete: 'Mark completed',
}

export function Bookings() {
  const data = useAdmin((s) => s.data)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'All'
  const pay = (params.get('payment') as PayFilter) || 'All'
  const svc = params.get('service') || 'All'
  const selected = params.get('id')
  const [q, setQ] = useState('')
  const [page, setPage] = useState(1)

  const update = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v && v !== 'All') next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: k === 'id' ? false : true })
    if (k !== 'id') setPage(1)
  }

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return data.bookings
      .filter((b) => {
        const m = money(b, data.payments)
        const c = customerOf(data, b.customerId)
        return (
          (tab === 'All' || b.status === tab) &&
          (svc === 'All' || b.serviceId === svc) &&
          (pay === 'All' || (pay === 'Submitted' ? m.submitted.length > 0 : m.summary === pay && b.status !== 'Cancelled')) &&
          (!needle || `${b.id} ${c?.name} ${b.contactName}`.toLowerCase().includes(needle))
        )
      })
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [data, tab, svc, pay, q])
  const p = paginate(rows, page)
  const count = (s: Tab) => (s === 'All' ? data.bookings.length : data.bookings.filter((b) => b.status === s).length)
  const awaiting = data.payments.filter((x) => x.status === 'Submitted').length
  const requests = data.bookings.filter((b) => b.cancellationRequested && b.status !== 'Cancelled').length

  return (
    <div>
      <PageHeader title="Bookings" subtitle="Open a booking to verify its payment, confirm it, assign a van and driver, and mark the trip completed. The Next step column shows what each one needs." />
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <MiniKpi label="All bookings" value={data.bookings.length} />
        <MiniKpi label="Pending" value={count('Pending')} />
        <MiniKpi label="Payments awaiting verification" value={awaiting} />
        <MiniKpi label="Cancellation requests" value={requests} />
      </div>
      <div className={`grid gap-6 ${selected ? 'xl:grid-cols-[1fr_400px]' : ''}`}>
        <Card className="min-w-0">
          <div className="flex flex-col gap-3 border-b border-line p-4">
            <Tabs value={tab} onChange={(v) => update('tab', v)} items={(['All', 'Pending', 'Confirmed', 'Completed', 'Cancelled'] as Tab[]).map((t) => ({ key: t, label: t, count: count(t) }))} />
            <div className="flex flex-wrap items-center gap-3">
              <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1) }} placeholder="Search booking ID or customer" />
              <FilterSelect label="Service" value={svc} onChange={(e) => update('service', e.target.value)}>
                <option value="All">All services</option>
                {data.services.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </FilterSelect>
              <FilterSelect label="Payment" value={pay} onChange={(e) => update('payment', e.target.value)}>
                <option value="All">All payments</option>
                <option value="Submitted">Awaiting verification</option>
                <option>Unpaid</option>
                <option>Partially paid</option>
                <option>Fully paid</option>
              </FilterSelect>
            </div>
          </div>
          <Table
            head={['Booking', 'Next step', 'Customer', 'Trip', 'Pax', 'Total', 'Status', 'Payment']}
            empty={rows.length === 0 && <EmptyState title="No bookings match" body="Clear the search or change the filters." />}
          >
            {p.rows.map((b) => {
              const m = money(b, data.payments)
              const next = staffSteps(data, b).map((st) => NEXT[st]).find(Boolean)
              return (
                <tr
                  key={b.id}
                  onClick={() => update('id', b.id)}
                  className={`cursor-pointer ${selected === b.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}`}
                  aria-selected={selected === b.id}
                >
                  <td className={td}>
                    <button className="font-semibold text-brand-700 hover:underline" onClick={(e) => { e.stopPropagation(); update('id', b.id) }}>
                      {b.id}
                    </button>
                    {b.origin === 'local' && <LocalTag />}
                  </td>
                  <td className={td}>
                    {next ? (
                      <button
                        className="rounded-lg bg-brand-600 px-2.5 py-1 text-xs font-semibold whitespace-nowrap text-white hover:bg-brand-700"
                        onClick={(e) => { e.stopPropagation(); update('id', b.id) }}
                      >
                        {next}
                      </button>
                    ) : (
                      <span className="text-xs text-ink-3">{b.status === 'Pending' ? 'Awaiting payment' : b.status === 'Confirmed' ? 'Awaiting balance' : 'Done'}</span>
                    )}
                  </td>
                  <td className={td}>{customerOf(data, b.customerId)?.name}</td>
                  <td className={td}>
                    {serviceOf(data, b.serviceId).name}
                    <span className="block text-xs text-ink-2">{shortRange(b.startDate, b.endDate)}</span>
                  </td>
                  <td className={`${td} tnum`}>{b.pax}</td>
                  <td className={`${td} tnum`}>{peso(b.total)}</td>
                  <td className={td}>
                    <div className="flex flex-wrap gap-1">
                      <StatusBadge status={b.status} />
                      {b.cancellationRequested && b.status !== 'Cancelled' && <Badge tone="warn">Cancel requested</Badge>}
                    </div>
                  </td>
                  <td className={td}>{m.submitted.length ? <Badge tone="warn">Awaiting verification</Badge> : <StatusBadge status={m.summary} />}</td>
                </tr>
              )
            })}
          </Table>
          <Pager {...p} onPage={setPage} />
        </Card>
        {selected && <BookingPanel bookingId={selected} onClose={() => update('id', null)} />}
      </div>
    </div>
  )
}
