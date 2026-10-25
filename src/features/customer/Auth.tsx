import { ArrowLeft, CalendarDays, Eye, EyeOff, Lock, Mail, MailCheck, Phone, UserRound, Users } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { departureAvailability } from '../../domain/rules'
import { GOOGLE_CLIENT_ID, loadGoogleIdentity, profileFromCredential } from '../../lib/google'
import { fmtRange } from '../../lib/format'
import { photoRef } from '../../seed/photos'
import { DEMO_CUSTOMER, NEW_CUSTOMER, useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import { BrandMark } from '../../ui/BrandMark'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { TextField } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { emailError, mobileError, nameError, newPasswordError, passwordError, sleep } from '../../ui/validate'

const safeNext = (n: string | null) => (n && n.startsWith('/app') && !n.startsWith('/app/login') && !n.startsWith('/app/signup') ? n : '/app')

export function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button type="button" onClick={onToggle} className="rounded-lg p-2 text-ink-3 hover:text-ink" aria-label={shown ? 'Hide password' : 'Show password'} aria-pressed={shown}>
      {shown ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
    </button>
  )
}

/* ------------------------------------------------------------------ Layout */

const AUTH_PHOTO = { slug: 'hundred-islands', alt: 'Limestone islets of the Hundred Islands rising from turquoise water', caption: 'Hundred Islands, Pangasinan' }

/**
 * Desktop: a split screen with a large travel photo, the brand and a short welcome beside a focused form.
 * Phones: a slim photo band with the logo, then the form, so the fields come first.
 */
function AuthLayout({ title, subtitle, children, footer }: { title: string; subtitle: ReactNode; children: ReactNode; footer: ReactNode }) {
  const image = photoRef(AUTH_PHOTO.slug, AUTH_PHOTO.alt)
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(480px,1fr)]">
      <aside className="relative isolate overflow-hidden bg-navy text-white max-lg:h-40 lg:sticky lg:top-0 lg:h-dvh">
        {image && <Picture image={image} eager label={false} className="absolute inset-0 -z-10" sizes="(min-width: 1024px) 55vw, 100vw" />}
        <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#0e1d3d]/90 via-[#0e1d3d]/35 to-[#0e1d3d]/30" aria-hidden />
        <div className="flex h-full flex-col justify-between p-5 lg:p-12">
          <Link to="/app" aria-label="TAMS AP home" className="self-start">
            <BrandMark inverse className="h-9 lg:h-12" />
          </Link>
          <div className="hidden max-w-lg lg:block">
            <p className="type-eyebrow text-white/80">Biyahe with TAMS AP</p>
            <p className="mt-3 type-hero text-[56px] xl:text-[64px]">Tara, alis muna tayo.</p>
            <p className="mt-4 text-lg text-white/85">Joiner tours, private vans and custom trips across Luzon, booked in a few taps and tracked until you’re home.</p>
          </div>
          <p className="text-[11px] text-white/75 max-lg:hidden">
            {AUTH_PHOTO.caption}
            {image?.credit && ` · Photo: ${image.credit.author}, ${image.credit.license}`}
          </p>
        </div>
      </aside>
      <main className="flex items-start justify-center px-5 py-8 sm:py-12 lg:items-center lg:px-12">
        <div className="page-in w-full max-w-[420px]">
          <h1 className="type-head text-[30px] text-charcoal sm:text-[34px]">{title}</h1>
          <p className="mt-2 text-[15px] text-ink-2">{subtitle}</p>
          <div className="mt-7">{children}</div>
          <div className="mt-8 border-t border-line pt-5 text-center text-sm text-ink-2">{footer}</div>
        </div>
      </main>
    </div>
  )
}

/** "Log in to continue booking …" when the person came from a booking step. */
function ContinueContext({ next }: { next: string }) {
  const data = useCustomer((s) => s.data)
  const m = /^\/app\/book\/([^?]+)(?:\?pax=(\d+))?/.exec(next)
  if (!m) return null
  const dep = data.departures.find((d) => d.id === m[1])
  const s = dep && data.services.find((x) => x.id === dep.serviceId)
  if (!dep || !s || departureAvailability(dep, data.bookings).state !== 'open') return null
  const pax = Number(m[2] ?? 1)
  return (
    <div className="mb-5 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-100">
      <p className="font-semibold">Continue booking {s.name}</p>
      <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-brand-800">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-4" aria-hidden /> {fmtRange(dep.startDate, dep.endDate)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-4" aria-hidden /> {pax} {pax === 1 ? 'traveler' : 'travelers'}
        </span>
      </p>
      <p className="mt-1 text-xs text-brand-800">Your date and travelers are kept. You’ll return to the booking form after logging in.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ Google */

function GoogleG() {
  return (
    <svg viewBox="0 0 48 48" className="size-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/**
 * "Continue with Google". With a configured client ID this renders Google's own button and signs in through
 * Google's popup. Without one, the button explains that Google sign-in is not connected yet; it never pretends
 * to have signed anyone in.
 */
function GoogleSignIn({ next, label }: { next: string; label: string }) {
  const googleSignIn = useCustomer((s) => s.googleSignIn)
  const navigate = useNavigate()
  const holder = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
  const [info, setInfo] = useState(false)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let live = true
    loadGoogleIdentity()
      .then((id) => {
        if (!live || !holder.current) return
        id.initialize({
          client_id: GOOGLE_CLIENT_ID!,
          ux_mode: 'popup',
          context: 'signin',
          callback: ({ credential }) => {
            try {
              const r = googleSignIn(profileFromCredential(credential))
              if (r.ok) navigate(next, { replace: true })
              else setError(r.error)
            } catch (e) {
              setError((e as Error).message)
            }
          },
        })
        id.renderButton(holder.current, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', width: holder.current.clientWidth || 360 })
        setReady(true)
      })
      .catch((e: Error) => live && setError(e.message))
    return () => {
      live = false
    }
  }, [googleSignIn, navigate, next])

  if (GOOGLE_CLIENT_ID) {
    return (
      <div>
        <div ref={holder} className="flex min-h-11 justify-center" aria-label={label} />
        {!ready && !error && <p className="text-center text-xs text-ink-3">Loading Google sign-in…</p>}
        {error && (
          <p role="alert" className="mt-2 rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
            {error}
          </p>
        )}
      </div>
    )
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setInfo(true)}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-full border border-line-strong bg-white text-[15px] font-semibold text-[#1f1f1f] transition-colors hover:bg-[#f8f8f8]"
      >
        <GoogleG /> {label}
      </button>
      <Dialog open={info} onClose={() => setInfo(false)} title="Google sign-in isn’t connected yet">
        <p>This prototype is ready for Google sign-in, but it hasn’t been given a Google client ID, so it can’t talk to Google. Nothing was sent and no account was signed in.</p>
        <p className="mt-3">To try the app now, use the demo account or create a demo account with an email and password.</p>
        <p className="mt-3 text-xs text-ink-3">For the team: setup steps are in docs/google-sign-in.md in the project repository.</p>
      </Dialog>
    </>
  )
}

function OrDivider({ children = 'or' }: { children?: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs font-medium text-ink-3" role="separator">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  )
}

/** The demo shortcut, set apart from the real sign-in options so it is never mistaken for one. */
function DemoAccounts({ busy, onUse }: { busy: boolean; onUse: (who: 'maria' | 'paolo') => void }) {
  return (
    <section className="mt-6 rounded-2xl border border-dashed border-line-strong bg-surface-muted/60 p-4" aria-labelledby="demo-title">
      <p id="demo-title" className="flex items-center gap-2 text-sm font-semibold text-ink">
        <span className="rounded-full bg-sili-50 px-2 py-0.5 text-[11px] font-bold tracking-wide text-sili-600 uppercase">Demo</span>
        Presenting the prototype?
      </p>
      <p className="mt-1 text-xs text-ink-2">Sign in as a fictional customer. No real account is used.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <Button variant="secondary" disabled={busy} onClick={() => onUse('maria')}>
          Use demo account
        </Button>
        <Button variant="ghost" disabled={busy} onClick={() => onUse('paolo')}>
          New customer (Paolo)
        </Button>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ Log in */

export function Login() {
  const login = useCustomer((s) => s.login)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
  const [email, setEmail] = useState(params.get('email') ?? '')
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
    await sleep(450)
    const r = login(creds.email, creds.password)
    setBusy(false)
    if (!r.ok) return setFormError(r.error)
    navigate(next, { replace: true })
  }

  const useDemo = (who: 'maria' | 'paolo') => {
    const creds = who === 'maria' ? DEMO_CUSTOMER : NEW_CUSTOMER
    setEmail(creds.email)
    setPassword(creds.password)
    submit(undefined, creds)
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Log in to book trips, pay and track your bookings."
      footer={
        <>
          New to TAMS AP?{' '}
          <Link to={`/app/signup?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 hover:underline">
            Create an account
          </Link>
          <span className="mx-2 text-ink-3" aria-hidden>
            ·
          </span>
          <Link to="/app" className="font-semibold text-brand-700 hover:underline">
            Keep browsing as a guest
          </Link>
        </>
      }
    >
      <ContinueContext next={next} />
      <GoogleSignIn next={next} label="Continue with Google" />
      <OrDivider>or log in with email</OrDivider>
      <form onSubmit={submit} noValidate className="space-y-4" aria-busy={busy}>
        <TextField
          label="Email"
          type="email"
          autoComplete="email"
          icon={<Mail className="size-5" />}
          placeholder="name@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => email && setErrors((x) => ({ ...x, email: emailError(email) }))}
          error={errors.email}
        />
        <div>
          <TextField
            label="Password"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            icon={<Lock className="size-5" />}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            error={errors.password}
            trailing={<PasswordToggle shown={show} onToggle={() => setShow((s) => !s)} />}
          />
          <div className="mt-2 text-right">
            <Link to={`/app/forgot${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="text-sm font-medium text-brand-700 hover:underline">
              Forgot password?
            </Link>
          </div>
        </div>
        {formError && (
          <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          {busy ? 'Logging in…' : 'Log in'}
        </Button>
      </form>
      <DemoAccounts busy={busy} onUse={useDemo} />
    </AuthLayout>
  )
}

/* ------------------------------------------------------------------ Sign up */

export function Signup() {
  const signup = useCustomer((s) => s.signup)
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const next = safeNext(params.get('next'))
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
    await sleep(450)
    const r = signup(f)
    setBusy(false)
    if (!r.ok) return setFormError(r.error)
    toast('Account created for this demo session.')
    navigate(next, { replace: true })
  }

  const field = (k: 'name' | 'email' | 'mobile' | 'password') => ({
    value: f[k],
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value }),
    onBlur: () => f[k] && setErrors((x) => ({ ...x, [k]: validate()[k] })),
    error: errors[k],
  })

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Book joiner tours, request vans and plan custom trips in one place."
      footer={
        <>
          Already have an account?{' '}
          <Link to={`/app/login?next=${encodeURIComponent(next)}`} className="font-semibold text-brand-700 hover:underline">
            Log in
          </Link>
        </>
      }
    >
      <ContinueContext next={next} />
      <GoogleSignIn next={next} label="Sign up with Google" />
      <OrDivider>or sign up with email</OrDivider>
      <form onSubmit={submit} noValidate className="space-y-4" aria-busy={busy}>
        <TextField label="Full name" autoComplete="name" icon={<UserRound className="size-5" />} {...field('name')} />
        <TextField label="Email" type="email" autoComplete="email" icon={<Mail className="size-5" />} placeholder="name@example.com" {...field('email')} />
        <TextField label="Mobile number" type="tel" inputMode="tel" autoComplete="tel" icon={<Phone className="size-5" />} placeholder="0900 555 0199" hint="We use this for trip-day updates." {...field('mobile')} />
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
        <p className="rounded-xl bg-info-bg px-3.5 py-2.5 text-xs text-info">Use made-up details. Demo accounts last until you reset or reload the prototype.</p>
        {formError && (
          <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <Dialog open={terms} onClose={() => setTerms(false)} title="Sample terms">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>This is a student prototype with fictional data. No real bookings, payments or messages are made.</li>
          <li>A 50% down payment holds a booking; the balance is due 3 days before travel (sample policy).</li>
          <li>Accounts and bookings exist only in this browser tab and are removed by Reset Demo or a reload.</li>
        </ul>
      </Dialog>
    </AuthLayout>
  )
}

/* ------------------------------------------------------------------ Forgot password */

export function ForgotPassword() {
  const [params] = useSearchParams()
  const loc = useLocation()
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const err = emailError(email)
    setError(err)
    if (err) return
    setBusy(true)
    await sleep(450)
    setBusy(false)
    setSent(true)
  }

  return (
    <AuthLayout
      title={sent ? 'Check your email' : 'Reset your password'}
      subtitle={sent ? 'In the real system, a reset link would arrive in a few minutes.' : 'Enter the email you signed up with and we’ll send a reset link.'}
      footer={
        <Link to={`/app/login${email ? `?email=${encodeURIComponent(email)}` : ''}`} state={loc.state} className="inline-flex items-center gap-1.5 font-semibold text-brand-700 hover:underline">
          <ArrowLeft className="size-4" aria-hidden /> Back to log in
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-2xl bg-ok-bg px-4 py-4 text-sm text-ink" role="status">
          <p className="flex items-center gap-2 font-semibold text-ok">
            <MailCheck className="size-5" aria-hidden /> Request received for {email}
          </p>
          <p className="mt-2">If an account exists for this address, it would get a link to set a new password. This prototype doesn’t send emails, so use the demo account on the log-in page.</p>
        </div>
      ) : (
        <form onSubmit={submit} noValidate className="space-y-4" aria-busy={busy}>
          <TextField label="Email" type="email" autoComplete="email" icon={<Mail className="size-5" />} placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
          <Button type="submit" size="lg" full loading={busy}>
            {busy ? 'Sending…' : 'Send reset link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
