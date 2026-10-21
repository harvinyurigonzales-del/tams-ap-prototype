import { Eye, EyeOff, Lock, Mail, Phone, UserRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AuthCard } from '../../app/AuthCard'
import { DEMO_CUSTOMER, useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { TextField } from '../../ui/Field'
import { emailError, mobileError, nameError, newPasswordError, passwordError, sleep } from '../../ui/validate'

const safeNext = (n: string | null) => (n && n.startsWith('/app') ? n : '/app')

export function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="rounded-lg p-2 text-ink-3 hover:text-ink" aria-label={shown ? 'Hide password' : 'Show password'}>
      {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  )
}

export function Login() {
  const login = useCustomer((s) => s.login)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)

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
    navigate(next, { replace: true })
  }

  const useDemo = () => {
    setEmail(DEMO_CUSTOMER.email)
    setPassword(DEMO_CUSTOMER.password)
    submit(undefined, DEMO_CUSTOMER)
  }

  return (
    <AuthCard
      title="Welcome back!"
      subtitle="Log in to book trips and track your payments."
      footer={
        <>
          New here?{' '}
          <Link to={`/app/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
          <span className="mx-2 text-ink-3">·</span>
          <Link to="/app" className="font-semibold text-brand-700 hover:underline">
            Explore trips as a guest
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField
          label="Email"
          type="email"
          autoComplete="off"
          icon={<Mail className="size-5" />}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email && setErrors((x) => ({ ...x, email: emailError(email) }))}
          error={errors.email}
        />
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
        <div className="text-right">
          <button type="button" onClick={() => setForgot(true)} className="text-sm font-medium text-brand-700 hover:underline">
            Forgot password?
          </button>
        </div>
        {formError && (
          <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          Log in
        </Button>
        <Button variant="secondary" size="lg" full onClick={useDemo} disabled={busy}>
          Use demo account
        </Button>
        <p className="text-center text-xs text-ink-3">Demo account: Maria Santos (fictional). Do not enter real details.</p>
      </form>
      <Dialog open={forgot} onClose={() => setForgot(false)} title="Password reset">
        Password reset is not available in the prototype. Use the demo account instead.
      </Dialog>
    </AuthCard>
  )
}

export function Signup() {
  const signup = useCustomer((s) => s.signup)
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [f, setF] = useState({ name: '', email: '', mobile: '', password: '', terms: false })
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [terms, setTerms] = useState(false)

  const validate = () => ({
    name: nameError(f.name),
    email: emailError(f.email),
    mobile: mobileError(f.mobile),
    password: newPasswordError(f.password),
    terms: f.terms ? '' : 'Please accept the sample terms to continue.',
  })

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const errs = validate()
    setErrors(errs)
    setFormError('')
    if (Object.values(errs).some(Boolean)) return
    setBusy(true)
    await sleep(500)
    const r = signup(f)
    setBusy(false)
    if (!r.ok) return setFormError(r.error)
    toast('Account created for this demo session.')
    navigate(safeNext(params.get('next')), { replace: true })
  }

  const field = (k: 'name' | 'email' | 'mobile' | 'password') => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
    onBlur: () => f[k] && setErrors((x) => ({ ...x, [k]: validate()[k] })),
    error: errors[k],
  })

  return (
    <AuthCard
      title="Your adventure starts here"
      subtitle="Create a demo account. It disappears when you close or reset the demo."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/app/login" className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <TextField label="Full name" autoComplete="off" icon={<UserRound className="size-5" />} {...field('name')} />
        <TextField label="Email" type="email" autoComplete="off" icon={<Mail className="size-5" />} placeholder="name@example.com" {...field('email')} />
        <TextField label="Mobile number" inputMode="tel" autoComplete="off" icon={<Phone className="size-5" />} placeholder="0900 555 0199" {...field('mobile')} />
        <TextField
          label="Password"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          icon={<Lock className="size-5" />}
          hint="At least 8 characters."
          trailing={<PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />}
          {...field('password')}
        />
        <div>
          <label className="flex items-start gap-2.5 text-sm text-ink-2">
            <input type="checkbox" className="mt-0.5 size-4 accent-brand-600" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} />
            <span>
              I agree to the{' '}
              <button type="button" className="font-semibold text-brand-700 hover:underline" onClick={() => setTerms(true)}>
                sample terms
              </button>
              .
            </span>
          </label>
          {errors.terms && <p className="mt-1.5 text-xs font-medium text-bad">{errors.terms}</p>}
        </div>
        <p className="rounded-xl bg-info-bg px-3.5 py-2.5 text-xs text-info">Use made-up details. This prototype does not collect real personal information.</p>
        {formError && (
          <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          Create account
        </Button>
      </form>
      <Dialog open={terms} onClose={() => setTerms(false)} title="Sample terms">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>This is a student prototype with fictional data. No real bookings, payments or messages are made.</li>
          <li>A 50% down payment holds a booking; the balance is due 3 days before travel (sample policy).</li>
          <li>Accounts and bookings exist only in this browser tab and are removed by Reset Demo or a reload.</li>
        </ul>
      </Dialog>
    </AuthCard>
  )
}
