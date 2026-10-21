import { Download } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { bookingReport, performanceReport, PERIODS, revenueReport } from '../../domain/metrics'
import { shortRange } from '../../domain/rules'
import { fmtDate, fmtStamp, peso } from '../../lib/format'
import { useAdmin } from '../../state/adminStore'
import { Button } from '../../ui/Button'
import { Card, SectionTitle } from '../../ui/Card'
import { BarList, Meter } from '../../ui/Charts'
import { EmptyState } from '../../ui/EmptyState'
import { FilterSelect } from '../../ui/Field'
import { PageHeader } from './AdminRoutes'
import { customerOf, Kpi, serviceOf, Table, Tabs, td } from './common'

type Tab = 'bookings' | 'revenue' | 'performance'

function downloadCsv(name: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\r\n')
  const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Reports() {
  const data = useAdmin((s) => s.data)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'bookings'
  const periodIdx = Math.max(0, PERIODS.findIndex((p) => p.from === params.get('period')))
  const period = PERIODS[periodIdx]
  const svc = params.get('service') || ''
  const set = (k: string, v: string) => {
    const n = new URLSearchParams(params)
    if (v) n.set(k, v)
    else n.delete(k)
    setParams(n, { replace: true })
  }
  const br = bookingReport(data, period, svc || undefined)
  const rr = revenueReport(data, period, svc || undefined)
  const pr = performanceReport(data, period, svc || undefined)
  const slug = `${period.from.slice(0, 7)}${svc ? `-${svc}` : ''}`

  const exportCsv = () => {
    if (tab === 'bookings')
      downloadCsv(`booking-report-${slug}.csv`, [
        ['Booking', 'Customer', 'Service', 'Travel start', 'Pax', 'Total (PHP)', 'Status'],
        ...br.rows.map((b) => [b.id, customerOf(data, b.customerId)?.name ?? '', serviceOf(data, b.serviceId).name, b.startDate, b.pax, b.total, b.status]),
      ])
    else if (tab === 'revenue')
      downloadCsv(`revenue-report-${slug}.csv`, [
        ['Payment', 'Booking', 'Method', 'Type', 'Amount (PHP)', 'Verified at'],
        ...rr.rows.map((p) => [p.id, p.bookingId, p.method, p.type, p.amount, p.reviewedAt ?? '']),
      ])
    else
      downloadCsv(`tour-performance-${slug}.csv`, [
        ['Departure', 'Service', 'Start', 'Capacity', 'Seats filled', 'Seats held (pending)', 'Utilisation %'],
        ...pr.rows.map((r) => [r.departure.id, r.service.name, r.departure.startDate, r.capacity, r.filled, r.held, Math.round(r.rate * 100)]),
      ])
  }

  const empty = tab === 'bookings' ? br.total === 0 : tab === 'revenue' ? rr.count === 0 : pr.rows.length === 0

  return (
    <div>
      <PageHeader
        title="Reports"
        subtitle="Every figure is calculated from the records in this demo."
        actions={
          <Button variant="secondary" icon={<Download className="size-4" aria-hidden />} onClick={exportCsv} disabled={empty}>
            Export CSV
          </Button>
        }
      />
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Tabs
          value={tab}
          onChange={(v) => set('tab', v)}
          items={[
            { key: 'bookings', label: 'Bookings' },
            { key: 'revenue', label: 'Revenue' },
            { key: 'performance', label: 'Tour performance' },
          ]}
        />
        <FilterSelect label="Period" value={period.from} onChange={(e) => set('period', e.target.value === PERIODS[0].from ? '' : e.target.value)}>
          {PERIODS.map((p) => (
            <option key={p.from} value={p.from}>
              {p.label}
            </option>
          ))}
        </FilterSelect>
        <FilterSelect label="Service" value={svc} onChange={(e) => set('service', e.target.value)}>
          <option value="">All services</option>
          {data.services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </FilterSelect>
      </div>

      {empty ? (
        <Card>
          <EmptyState title="No records in this period" body="Choose another period or service." />
        </Card>
      ) : tab === 'bookings' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Kpi label="Bookings (by travel date)" value={br.total} note={`${br.counts.Pending} pending · ${br.counts.Confirmed} confirmed · ${br.counts.Completed} completed · ${br.counts.Cancelled} cancelled`} />
            <Kpi label="Booking value" value={peso(br.value)} note="Excludes cancelled bookings" />
            <Kpi label="Travellers" value={br.pax} note="Excludes cancelled bookings" />
            <Kpi label="Average booking" value={peso(br.total - br.counts.Cancelled ? Math.round(br.value / (br.total - br.counts.Cancelled)) : 0)} />
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
            <Card className="min-w-0">
              <div className="p-5 pb-3">
                <SectionTitle>By service</SectionTitle>
              </div>
              <Table head={['Service', 'Bookings', 'Pending', 'Confirmed', 'Completed', 'Cancelled', 'Pax', 'Value']}>
                {br.byService.map((r) => (
                  <tr key={r.service.id}>
                    <td className={td}>{r.service.name}</td>
                    {[r.bookings, r.Pending, r.Confirmed, r.Completed, r.Cancelled, r.pax].map((n, i) => (
                      <td key={i} className={`${td} tnum`}>
                        {n}
                      </td>
                    ))}
                    <td className={`${td} tnum`}>{peso(r.value)}</td>
                  </tr>
                ))}
              </Table>
            </Card>
            <Card className="p-5">
              <SectionTitle>Booking value by service</SectionTitle>
              <BarList title="Booking value by service" format={peso} data={br.byService.map((r) => ({ label: r.service.name, value: r.value }))} />
            </Card>
          </div>
        </>
      ) : tab === 'revenue' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi emphasis label={`Verified collections · ${period.label}`} value={peso(rr.collections)} note={`${rr.count} payments, dated by verification`} />
            <Kpi label="Largest method" value={rr.byMethod.slice().sort((a, b) => b.amount - a.amount)[0]?.method ?? '—'} />
            <Kpi label="Average payment" value={peso(rr.count ? Math.round(rr.collections / rr.count) : 0)} />
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <Card className="p-5">
              <SectionTitle>By payment method</SectionTitle>
              <BarList title="Collections by payment method" format={peso} data={rr.byMethod.map((r) => ({ label: r.method, value: r.amount, hint: `${r.count} payments` }))} />
            </Card>
            <Card className="p-5">
              <SectionTitle>By service</SectionTitle>
              <BarList title="Collections by service" format={peso} data={rr.byService.map((r) => ({ label: r.service.name, value: r.amount }))} />
            </Card>
          </div>
          <Card className="mt-6 min-w-0">
            <div className="p-5 pb-3">
              <SectionTitle>Verified payments</SectionTitle>
            </div>
            <Table head={['Payment', 'Booking', 'Method', 'Type', 'Amount', 'Verified']}>
              {rr.rows.map((p) => (
                <tr key={p.id}>
                  <td className={td}>{p.id}</td>
                  <td className={td}>{p.bookingId}</td>
                  <td className={td}>{p.method}</td>
                  <td className={td}>{p.type}</td>
                  <td className={`${td} tnum`}>{peso(p.amount)}</td>
                  <td className={td}>{p.reviewedAt ? fmtStamp(p.reviewedAt) : ''}</td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <Kpi label="Seat utilisation" value={`${Math.round(pr.rate * 100)}%`} note={`${pr.filled} of ${pr.capacity} seats confirmed or completed`} />
            <Kpi label="Seats held by pending bookings" value={pr.held} />
            <Kpi label="Departures" value={pr.rows.length} />
          </div>
          <Card className="mt-6 min-w-0">
            <Table head={['Departure', 'Dates', 'Filled', 'Held', 'Capacity', 'Utilisation']}>
              {pr.rows.map((r) => (
                <tr key={r.departure.id}>
                  <td className={td}>
                    {r.service.name}
                    <span className="block text-xs text-ink-2">{r.departure.id}</span>
                  </td>
                  <td className={td}>{shortRange(r.departure.startDate, r.departure.endDate)}</td>
                  <td className={`${td} tnum`}>{r.filled}</td>
                  <td className={`${td} tnum`}>{r.held}</td>
                  <td className={`${td} tnum`}>{r.capacity}</td>
                  <td className={`${td} w-48`}>
                    <div className="flex items-center gap-2">
                      <div className="flex-1">
                        <Meter value={r.filled} max={r.capacity} label={`${r.service.name} ${fmtDate(r.departure.startDate, { year: false })} utilisation`} />
                      </div>
                      <span className="w-10 text-right text-sm font-semibold tnum">{Math.round(r.rate * 100)}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          </Card>
        </>
      )}
      <p className="mt-4 text-xs text-ink-3">Definitions: bookings and booking value use the travel start date; collections use the date a payment was verified; utilisation counts confirmed and completed seats.</p>
    </div>
  )
}
