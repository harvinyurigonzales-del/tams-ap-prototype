import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { LogOut } from 'lucide-react'
import { ResetDemoButton } from '../../app/ResetDemo'
import { useAdmin, useIsAdmin, useMe, type BusinessSettings } from '../../state/adminStore'
import { usePresenter } from '../../state/presenter'
import { useUi } from '../../state/ui'
import { Badge } from '../../ui/Badge'
import { Button } from '../../ui/Button'
import { Card, Row, SectionTitle } from '../../ui/Card'
import { TextField } from '../../ui/Field'
import { PasswordToggle } from '../customer/Auth'
import { initials, PageHeader } from './AdminRoutes'
import { Tabs } from './common'

type Tab = 'general' | 'account'

export function Settings() {
  const [params, setParams] = useSearchParams()
  const tab: Tab = params.get('tab') === 'account' ? 'account' : 'general'
  return (
    <div className="max-w-2xl space-y-6">
      <PageHeader title="Settings" subtitle={tab === 'general' ? 'Business details customers see, and this app.' : 'Your profile and password.'} />
      <Tabs<Tab>
        value={tab}
        onChange={(t) => setParams(t === 'general' ? {} : { tab: t }, { replace: true })}
        items={[
          { key: 'general', label: 'General' },
          { key: 'account', label: 'Account' },
        ]}
      />
      {tab === 'general' ? <General /> : <Account />}
    </div>
  )
}

function General() {
  const { settings, saveSettings } = useAdmin()
  const admin = useIsAdmin()
  const presenter = usePresenter()
  const toast = useUi((s) => s.toast)
  const [f, setF] = useState<BusinessSettings>(settings)
  const [error, setError] = useState('')
  const dirty = JSON.stringify(f) !== JSON.stringify(settings)
  const field = (k: keyof BusinessSettings, label: string, extra: Partial<React.InputHTMLAttributes<HTMLInputElement>> = {}) => (
    <TextField label={label} value={f[k]} readOnly={!admin} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} />
  )
  return (
    <>
      <Card className="p-5">
        <SectionTitle>Business details</SectionTitle>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const r = saveSettings(f)
            setError(r.ok ? '' : r.error)
            if (r.ok) toast('Business details saved.')
          }}
        >
          {field('businessName', 'Business name')}
          <div className="grid gap-4 sm:grid-cols-2">
            {field('email', 'Contact email', { type: 'email' })}
            {field('mobile', 'Contact mobile', { inputMode: 'tel' })}
          </div>
          {field('address', 'Office address')}
          {field('hours', 'Office hours')}
          {error && (
            <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
              {error}
            </p>
          )}
          {admin ? (
            <div className="flex gap-2">
              <Button type="submit" disabled={!dirty}>
                Save changes
              </Button>
              {dirty && (
                <Button variant="secondary" onClick={() => setF(settings)}>
                  Discard
                </Button>
              )}
            </div>
          ) : (
            <p className="text-xs text-ink-3">Only an admin can change the business details.</p>
          )}
        </form>
      </Card>
      <Card className="p-5">
        <SectionTitle>App</SectionTitle>
        <Row label="Version">{__APP_VERSION__}</Row>
        <Row label="Build">
          {__COMMIT__} · {__BUILD_TIME__.slice(0, 10)}
        </Row>
        <div className="mt-4 flex flex-wrap gap-2">
          {presenter && admin && <ResetDemoButton variant="danger" />}
        </div>
      </Card>
    </>
  )
}

function Account() {
  const me = useMe()
  const { updateProfile, changePassword, logout } = useAdmin()
  const navigate = useNavigate()
  const toast = useUi((s) => s.toast)
  const [p, setP] = useState({ name: me?.name ?? '', mobile: me?.mobile ?? '' })
  const [pw, setPw] = useState({ current: '', next: '' })
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({ profile: '', password: '' })
  if (!me) return null
  return (
    <>
      <Card className="p-5">
        <div className="mb-4 flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-full bg-navy font-display text-base font-bold text-white" aria-hidden>
            {initials(me.name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-ink">{me.name}</p>
            <p className="text-sm text-ink-2">
              {me.email} · <Badge tone={me.role === 'Admin' ? 'brand' : 'neutral'}>{me.role}</Badge>
            </p>
          </div>
          <Button
            variant="secondary"
            icon={<LogOut className="size-4" aria-hidden />}
            onClick={() => {
              logout()
              navigate('/admin/login', { replace: true })
            }}
          >
            Log out
          </Button>
        </div>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const r = updateProfile(p)
            setErrors((x) => ({ ...x, profile: r.ok ? '' : r.error }))
            if (r.ok) toast('Profile saved.')
          }}
        >
          <TextField label="Name" value={p.name} onChange={(e) => setP({ ...p, name: e.target.value })} />
          <TextField label="Mobile" inputMode="tel" value={p.mobile} onChange={(e) => setP({ ...p, mobile: e.target.value })} />
          <TextField label="Work email" value={me.email} readOnly hint="Ask an admin to change your work email." />
          {errors.profile && (
            <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
              {errors.profile}
            </p>
          )}
          <Button type="submit">Save profile</Button>
        </form>
      </Card>
      <Card className="p-5">
        <SectionTitle>Change password</SectionTitle>
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            const r = changePassword(pw.current, pw.next)
            setErrors((x) => ({ ...x, password: r.ok ? '' : r.error }))
            if (r.ok) {
              setPw({ current: '', next: '' })
              toast('Password changed.')
            }
          }}
        >
          <TextField label="Current password" type={show ? 'text' : 'password'} autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
          <TextField
            label="New password"
            type={show ? 'text' : 'password'}
            autoComplete="new-password"
            value={pw.next}
            onChange={(e) => setPw({ ...pw, next: e.target.value })}
            hint="At least 8 characters with letters and a number."
            trailing={<PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />}
          />
          {errors.password && (
            <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
              {errors.password}
            </p>
          )}
          <Button type="submit" disabled={!pw.current || !pw.next}>
            Change password
          </Button>
        </form>
      </Card>
    </>
  )
}
