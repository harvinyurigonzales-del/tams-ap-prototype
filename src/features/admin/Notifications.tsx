import { Bell, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { dashboard } from '../../domain/metrics'
import { needsReply } from '../../domain/reviews'
import { staffNotifications, useAdmin } from '../../state/adminStore'
import type { NotificationCategory } from '../../seed/types'
import { Button } from '../../ui/Button'
import { Card, SectionTitle } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { PageHeader } from './AdminRoutes'
import { ActivityList, Tabs } from './common'
import { overdueCount } from './Maintenance'

type Filter = 'All' | 'Unread' | NotificationCategory
const CATEGORIES: NotificationCategory[] = ['Bookings', 'Payments', 'Travel', 'Fleet', 'Requests', 'Messages']

export function AdminNotifications() {
  const { data, maintenance, markAllRead } = useAdmin()
  const [f, setF] = useState<Filter>('All')
  const all = staffNotifications(data).sort((a, b) => b.at.localeCompare(a.at))
  const list = all.filter((n) => f === 'All' || (f === 'Unread' ? !n.read : n.category === f))
  const unread = (c: NotificationCategory) => all.filter((n) => !n.read && n.category === c).length
  const k = dashboard(data)
  const todo = [
    { label: 'Payments to verify', n: data.payments.filter((p) => p.status === 'Submitted').length, to: '/admin/bookings?payment=Submitted' },
    { label: 'New requests', n: [...data.customRequests, ...data.rentalRequests].filter((r) => r.status === 'Submitted').length, to: '/admin/requests' },
    { label: 'Inquiries awaiting a reply', n: data.inquiries.filter((i) => i.status === 'Awaiting staff').length, to: '/admin/inquiries' },
    { label: 'Reviews to reply to', n: data.reviews.filter(needsReply).length, to: '/admin/reviews' },
    { label: 'Trips without a van', n: k.needsAssignment, to: '/admin/calendar' },
    { label: 'Overdue maintenance', n: overdueCount(maintenance), to: '/admin/maintenance' },
  ]
  return (
    <div>
      <PageHeader
        title="Notifications"
        subtitle="Customer activity and staff updates. Customers get their own notifications on the customer site."
        actions={
          <Button variant="secondary" onClick={markAllRead} disabled={all.every((n) => n.read)}>
            Mark all as read
          </Button>
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <div className="mb-4">
            <Tabs value={f} onChange={setF} items={(['All', 'Unread', ...CATEGORIES] as Filter[]).map((key) => ({ key, label: key }))} />
          </div>
          <Card className="px-4">
            {list.length === 0 ? <EmptyState icon={<Bell className="size-6" aria-hidden />} title="Nothing here" body="You are all caught up." /> : <ActivityList items={list} />}
          </Card>
        </div>
        <aside aria-label="Summary" className="space-y-4 xl:sticky xl:top-24 xl:self-start">
          <Card className="p-5">
            <SectionTitle>Needs action</SectionTitle>
            <ul className="-mx-2">
              {todo.map((t) => (
                <li key={t.label}>
                  <Link to={t.to} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-sm hover:bg-surface-muted">
                    <span className={t.n ? 'font-medium text-ink' : 'text-ink-2'}>{t.label}</span>
                    <span className="flex items-center gap-1">
                      <span className={`min-w-6 rounded-full px-1.5 text-center text-xs font-bold tnum ${t.n ? 'bg-sili text-white' : 'bg-surface-muted text-ink-3'}`}>{t.n}</span>
                      <ChevronRight className="size-4 text-ink-3" aria-hidden />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </Card>
          <Card className="p-5">
            <SectionTitle>Unread by type</SectionTitle>
            <ul className="space-y-1.5 text-sm">
              {CATEGORIES.map((c) => (
                <li key={c}>
                  <button onClick={() => setF(c)} className="flex w-full justify-between text-left text-ink-2 hover:text-ink">
                    <span>{c}</span>
                    <span className="font-semibold text-ink tnum">{unread(c)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </aside>
      </div>
    </div>
  )
}
