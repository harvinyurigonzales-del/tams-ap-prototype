import { Bell, LogOut, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ResetDemoButton } from '../../app/ResetDemo'
import { fmtDate, fmtStamp } from '../../lib/format'
import { InstallButton } from '../../pwa/InstallHelp'
import { useCustomer, useMe } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import { Button } from '../../ui/Button'
import { Card, SectionTitle } from '../../ui/Card'
import { ConfirmDialog } from '../../ui/Dialog'
import { EmptyState } from '../../ui/EmptyState'
import { TextField } from '../../ui/Field'
import { mobileError, nameError } from '../../ui/validate'

export function Account() {
  const me = useMe()!
  const { updateProfile, logout } = useCustomer()
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const [f, setF] = useState({ name: me.name, mobile: me.mobile })
  const [errors, setErrors] = useState({ name: '', mobile: '' })
  const [out, setOut] = useState(false)
  const dirty = f.name !== me.name || f.mobile !== me.mobile

  const save = () => {
    const e = { name: nameError(f.name), mobile: mobileError(f.mobile) }
    setErrors(e)
    if (e.name || e.mobile) return
    const r = updateProfile(f)
    if (r.ok) toast('Profile saved for this demo session.')
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-2xl font-bold text-brand-900">Account</h1>
      <Card className="p-5">
        <SectionTitle>Profile</SectionTitle>
        <div className="space-y-4">
          <TextField label="Full name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} error={errors.name} />
          <TextField label="Mobile number" inputMode="tel" value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} error={errors.mobile} hint="Sample number" />
          <TextField label="Email" value={me.email} disabled hint="Email cannot be changed in the demo." />
          <p className="text-xs text-ink-3">
            Customer {me.id} · registered {fmtDate(me.registered)}
          </p>
          <Button onClick={save} disabled={!dirty}>
            Save changes
          </Button>
        </div>
      </Card>
      <Card className="p-5">
        <SectionTitle>This demo</SectionTitle>
        <p className="mb-4 text-sm text-ink-2">Changes live only in this tab. Reset Demo returns both demos to the sample data.</p>
        <div className="flex flex-wrap gap-2">
          <InstallButton />
          <ResetDemoButton />
          <Button variant="ghost" icon={<LogOut className="size-4" aria-hidden />} onClick={() => setOut(true)}>
            Log out
          </Button>
        </div>
      </Card>
      <ConfirmDialog
        open={out}
        onClose={() => setOut(false)}
        title="Log out?"
        body="Your trips stay in this demo session until you reset or reload."
        confirmLabel="Log out"
        onConfirm={() => {
          logout()
          navigate('/app/login', { replace: true })
        }}
      />
    </div>
  )
}

export function Notifications() {
  const { data, customerId, markAllRead } = useCustomer()
  const list = data.notifications.filter((n) => n.customerId === customerId)
  const unread = list.some((n) => !n.read)
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold text-brand-900">Notifications</h1>
        {unread && (
          <Button variant="ghost" size="sm" onClick={markAllRead}>
            Mark all as read
          </Button>
        )}
      </div>
      <Card>
        {list.length === 0 ? (
          <EmptyState icon={<Bell className="size-6" aria-hidden />} title="No notifications" body="Updates about your bookings and payments appear here." />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((n) => (
              <li key={n.id}>
                <Link to={n.link ?? '#'} className="flex gap-3 px-5 py-4 hover:bg-brand-50">
                  <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read ? 'bg-transparent' : 'bg-brand-600'}`} aria-label={n.read ? undefined : 'Unread'} />
                  <span className="flex-1">
                    <span className="block text-sm font-semibold text-ink">{n.title}</span>
                    <span className="block text-sm text-ink-2">{n.body}</span>
                    <span className="mt-0.5 block text-xs text-ink-3">{fmtStamp(n.at)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <p className="mt-3 text-center text-xs text-ink-3">In-app only. The prototype sends no SMS, email or push messages.</p>
    </div>
  )
}

export function Inquiries() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-4 font-display text-2xl font-bold text-brand-900">Inquiries</h1>
      <Card>
        <EmptyState
          icon={<MessageCircle className="size-6" aria-hidden />}
          title="Messaging is not part of this prototype"
          body="For questions, the agency’s official channels would be used. The admin demo shows how staff answer inquiries with approved replies."
        />
      </Card>
    </div>
  )
}
