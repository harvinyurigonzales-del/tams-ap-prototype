import { Link, useNavigate } from 'react-router-dom'
import { bookingsPerWeek, dashboard, PERIODS, statusCounts } from '../../domain/metrics'
import { money, shortRange } from '../../domain/rules'
import { fmtDate, peso } from '../../lib/format'
import { staffNotifications, useAdmin, useMe } from '../../state/adminStore'
import { LocalTag, StatusBadge } from '../../ui/Badge'
import { Card, SectionTitle } from '../../ui/Card'
import { BarList, ColumnChart } from '../../ui/Charts'
import { PageHeader } from './AdminRoutes'
import { SalesOutlook } from './Outlook'
import { ActivityList, customerOf, Kpi, serviceOf, Table, td } from './common'

export function Dashboard() {
  const data = useAdmin((s) => s.data)
  const me = useMe()
  const navigate = useNavigate()
  const admin = me?.role === 'Admin'
  const k = dashboard(data)
  const weeks = bookingsPerWeek(data)
  const counts = statusCounts(data)
  const recent = [...data.bookings].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5)

  return (
    <div>
      <PageHeader title={`Magandang umaga, ${(me?.name ?? '').split(' ')[0]}`} subtitle="Here is what needs attention today." />
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4 [&>*:first-child]:col-span-2 sm:[&>*:first-child]:col-span-1">
        <Kpi emphasis label={`Verified collections · ${PERIODS[0].label.split(' ')[0]}`} value={peso(k.collections)} note="Payments verified this month" to={admin ? '/admin/reports?tab=revenue' : undefined} />
        <Kpi label="Payments to verify" value={k.toVerify} note={k.toVerify ? `${peso(k.toVerifyAmount)} submitted` : 'All caught up'} to="/admin/bookings?payment=Submitted" />
        <Kpi label="Outstanding balance" value={peso(k.outstanding)} note="Pending and confirmed bookings" to="/admin/bookings?tab=Confirmed" />
        <Kpi label="Needs van assignment" value={k.needsAssignment} note="Confirmed trips without a van" to="/admin/calendar" />
      </div>

      <div className="mt-6">
        <SalesOutlook />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <Card className="p-5">
          <SectionTitle>Bookings created per week</SectionTitle>
          <ColumnChart
            title="Bookings created per week"
            data={weeks.map((w) => ({ label: fmtDate(w.start, { year: false }), value: w.count, hint: `Week of ${fmtDate(w.start, { year: false })}` }))}
          />
        </Card>
        <Card className="p-5">
          <SectionTitle>Bookings by status</SectionTitle>
          <BarList title="Bookings by status" data={(['Pending', 'Confirmed', 'Completed', 'Cancelled'] as const).map((s) => ({ label: s, value: counts[s] }))} />
          <p className="mt-4 text-xs text-ink-3">
            {PERIODS[0].label.split(' ')[0]} travel: {k.bookings.total} bookings, {peso(k.bookings.value)} booking value
          </p>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px] [&>*]:min-w-0">
        <Card>
          <div className="p-5 pb-3">
            <SectionTitle
              action={
                <Link to="/admin/bookings" className="text-sm font-semibold text-brand-700 hover:underline">
                  View all
                </Link>
              }
            >
              Latest bookings
            </SectionTitle>
          </div>
          <Table head={['Booking', 'Customer', 'Trip', 'Status', 'Payment', '']}>
            {recent.map((b) => {
              const m = money(b, data.payments)
              return (
                <tr key={b.id} onClick={() => navigate(`/admin/bookings?id=${b.id}`)} className="cursor-pointer hover:bg-surface-muted">
                  <td className={td}>
                    <span className="font-medium text-ink">{b.id}</span>
                    {b.origin === 'local' && <LocalTag />}
                  </td>
                  <td className={td}>{customerOf(data, b.customerId)?.name}</td>
                  <td className={td}>
                    {serviceOf(data, b.serviceId).name}
                    <span className="block text-xs text-ink-2">{shortRange(b.startDate, b.endDate)}</span>
                  </td>
                  <td className={td}>
                    <StatusBadge status={b.status} />
                  </td>
                  <td className={td}>{m.submitted.length ? <StatusBadge status="Submitted" /> : <StatusBadge status={m.summary} />}</td>
                  <td className={td}>
                    <Link to={`/admin/bookings?id=${b.id}`} className="font-semibold text-brand-700 hover:underline">
                      View
                    </Link>
                  </td>
                </tr>
              )
            })}
          </Table>
        </Card>
        <Card className="p-5">
          <SectionTitle
            action={
              <Link to="/admin/notifications" className="text-sm font-semibold text-brand-700 hover:underline">
                All
              </Link>
            }
          >
            Recent activity
          </SectionTitle>
          <ActivityList items={staffNotifications(data)} limit={5} />
        </Card>
      </div>
    </div>
  )
}
