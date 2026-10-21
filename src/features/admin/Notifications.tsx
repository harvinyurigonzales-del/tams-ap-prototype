import { Bell } from 'lucide-react'
import { useState } from 'react'
import { useAdmin } from '../../state/adminStore'
import type { NotificationCategory } from '../../seed/types'
import { Button } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { PageHeader } from './AdminRoutes'
import { ActivityList, Tabs } from './common'

type Filter = 'All' | 'Unread' | NotificationCategory

export function AdminNotifications() {
  const { data, markAllRead } = useAdmin()
  const [f, setF] = useState<Filter>('All')
  const list = data.notifications.filter((n) => f === 'All' || (f === 'Unread' ? !n.read : n.category === f))
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        subtitle="In-app activity only. No SMS, email or push messages are sent."
        actions={
          <Button variant="secondary" onClick={markAllRead} disabled={data.notifications.every((n) => n.read)}>
            Mark all as read
          </Button>
        }
      />
      <div className="mb-4">
        <Tabs value={f} onChange={setF} items={(['All', 'Unread', 'Bookings', 'Payments', 'Travel', 'Fleet', 'Requests'] as Filter[]).map((k) => ({ key: k, label: k }))} />
      </div>
      <Card className="px-4">
        {list.length === 0 ? <EmptyState icon={<Bell className="size-6" aria-hidden />} title="Nothing here" body="You are all caught up." /> : <ActivityList items={list} />}
      </Card>
    </div>
  )
}
