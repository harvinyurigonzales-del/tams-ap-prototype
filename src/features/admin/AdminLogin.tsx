import { Lock, Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthCard } from '../../app/AuthCard'
import { DEMO_ADMIN, DEMO_STAFF, useAdmin } from '../../state/adminStore'
import { Button } from '../../ui/Button'
import { TextField } from '../../ui/Field'
import { emailError, passwordError, sleep } from '../../ui/validate'
import { PasswordToggle } from '../customer/Auth'

export function AdminLogin() {
  const login = useAdmin((s) => s.login)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const loc = useLocation()
  const guarded = (loc.state as { guarded?: boolean } | null)?.guarded || params.has('next')
  // Login starts on the dashboard; only a link to a specific record (with ?id=…) is followed after login.
  const next = params.get('next')?.startsWith('/admin') && params.get('next')!.includes('?') ? params.get('next')! : '/admin'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e?: FormEvent, creds = { email, password }) => {
    e?.preventDefault()
    const errs = { email: emailError(creds.email), password: passwordError(creds.password) }
    setErrors(errs)
    setFormError('')
    if (errs.email || errs.password) return
    setBusy(true)
    await sleep(500)
    const r = login(creds.email, creds.password)
    setBusy(false)
    if (!r.ok) return setFormError(r.error)
    navigate(next === '/admin/dashboard' ? '/admin' : next, { replace: true })
  }

  return (
    <AuthCard title="Staff login" subtitle="TAMS AP admin portal">
      {guarded && <p className="mb-4 rounded-xl bg-info-bg px-3.5 py-2.5 text-sm text-info">Please log in as staff to continue.</p>}
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField label="Work email" type="email" autoComplete="off" icon={<Mail className="size-5" />} value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
        <TextField
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="off"
          icon={<Lock className="size-5" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          trailing={<PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />}
        />
        {formError && (
          <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          Log in
        </Button>
        <div className="rounded-xl border border-line p-3">
          <p className="text-sm font-semibold text-ink">Try it with a sample account</p>
          <p className="mt-0.5 text-xs text-ink-2">Admin sees every module. Staff handle bookings, payments, requests and the fleet, without the admin-only pages.</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {[
              { label: 'Use admin account', acct: DEMO_ADMIN },
              { label: 'Use staff account', acct: DEMO_STAFF },
            ].map(({ label, acct }) => (
              <Button
                key={label}
                variant="secondary"
                full
                disabled={busy}
                onClick={() => {
                  setEmail(acct.email)
                  setPassword(acct.password)
                  submit(undefined, acct)
                }}
              >
                {label}
              </Button>
            ))}
          </div>
        </div>
        <p className="text-center text-xs text-ink-3">Five wrong attempts lock the form for 30 seconds.</p>
      </form>
    </AuthCard>
  )
}
