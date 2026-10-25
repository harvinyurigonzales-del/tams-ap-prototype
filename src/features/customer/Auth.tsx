import { ArrowLeft, CalendarDays, ChevronDown, Eye, EyeOff, Lock, Mail, MailCheck, Phone, UserRound, Users } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { departureAvailability } from '../../domain/rules'
import { GOOGLE_CLIENT_ID, loadGoogleIdentity, profileFromCredential } from '../../lib/google'
import { fmtRange } from '../../lib/format'
import { photoRef } from '../../seed/photos'
import { destinationFor, SAMPLE_ACCOUNTS, signIn, useWorkspace, workspaceHome } from '../../state/auth'
import { useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import { BrandMark } from '../../ui/BrandMark'
import { Button } from '../../ui/Button'
import { Dialog } from '../../ui/Dialog'
import { TextField } from '../../ui/Field'
import { Picture } from '../../ui/Picture'
import { emailError, mobileError, nameError, newPasswordError, passwordError, sleep } from '../../ui/validate'

/** Where a new customer goes after signing up: back into the task they started, otherwise Home. */
const safeNext = (n: string | null) => destinationFor('customer', n)

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
          <p className="text-[11px] text-white/75 max-lg:hidden">{AUTH_PHOTO.caption}</p>
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

/**
 * "Continue with Google", only when a Google client ID is configured: Google's own button signs in through
 * Google's popup. Without one, nothing is shown, so there is never a sign-in button that does not work.
 */
function GoogleSignIn({ next, label }: { next: string; label: string }) {
  const googleSignIn = useCustomer((s) => s.googleSignIn)
  const navigate = useNavigate()
  const holder = useRef<HTMLDivElement>(null)
  const [error, setError] = useState('')
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

  if (!GOOGLE_CLIENT_ID) return null
  return (
    <>
      <div>
        <div ref={holder} className="flex min-h-11 justify-center" aria-label={label} />
        {!ready && !error && <p className="text-center text-xs text-ink-3">Loading Google sign-in…</p>}
        {error && (
          <p role="alert" className="mt-2 rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
            {error}
          </p>
        )}
      </div>
      <OrDivider>or use your email</OrDivider>
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

/** Sample accounts for the prototype: a small, collapsed section under the form, apart from the real sign-in. */
function SampleAccounts({ busy, onUse }: { busy: boolean; onUse: (a: (typeof SAMPLE_ACCOUNTS)[number]) => void }) {
  const [open, setOpen] = useState(false)
  return (
    <section className="mt-6 rounded-2xl border border-line" aria-label="Sample accounts">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="sample-accounts"
        className="flex min-h-11 w-full items-center justify-between gap-3 rounded-2xl px-4 py-2.5 text-left text-sm font-semibold text-ink-2 hover:text-ink"
      >
        Sample accounts
        <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden />
      </button>
      {open && (
        <ul id="sample-accounts" className="grid gap-1 px-2 pb-2">
          {SAMPLE_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <button
                type="button"
                disabled={busy}
                onClick={() => onUse(a)}
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left text-sm hover:bg-surface-muted disabled:opacity-60"
              >
                <span className="font-medium text-ink">{a.label}</span>
                <span className="text-xs text-ink-3">{a.role}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/* ------------------------------------------------------------------ Log in */

/**
 * The one login for customers, staff and admins. The account decides where it lands: customers on the customer
 * site, staff and admins in the staff portal. Someone already signed in goes straight to their own workspace.
 */
export function Login() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { pathname } = useLocation()
  const workspace = useWorkspace()
  const rawNext = params.get('next')
  const staffEntry = pathname.startsWith('/admin') || !!rawNext?.startsWith('/admin')
  const [email, setEmail] = useState(params.get('email') ?? '')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [errors, setErrors] = useState({ email: '', password: '' })
  const [formError, setFormError] = useState('')
  const [busy, setBusy] = useState(false)
  const done = useRef(false)

  const submit = async (e?: FormEvent, creds = { email, password }) => {
    e?.preventDefault()
    const errs = { email: emailError(creds.email), password: passwordError(creds.password) }
    setErrors(errs)
    setFormError('')
    if (errs.email || errs.password) return
    setBusy(true)
    await sleep(450)
    const r = signIn(creds.email, creds.password)
    setBusy(false)
    if (!r.ok) return setFormError(r.error)
    done.current = true
    navigate(destinationFor(r.workspace, rawNext), { replace: true })
  }

  if (workspace && !done.current && !busy) return <Navigate to={workspaceHome(workspace)} replace />

  return (
    <AuthLayout
      title={staffEntry ? 'Staff login' : 'Welcome back'}
      subtitle={staffEntry ? 'Log in with your work email to open the staff portal.' : 'Log in to book trips, pay and track your bookings.'}
      footer={
        <>
          New to TAMS AP?{' '}
          <Link to={`/app/signup?next=${encodeURIComponent(safeNext(rawNext))}`} className="font-semibold text-brand-700 hover:underline">
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
      {params.has('next') && staffEntry && <p className="mb-5 rounded-xl bg-info-bg px-3.5 py-2.5 text-sm text-info">Please log in with a staff account to continue.</p>}
      <ContinueContext next={safeNext(rawNext)} />
      {!staffEntry && <GoogleSignIn next={safeNext(rawNext)} label="Continue with Google" />}
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
      <SampleAccounts
        busy={busy}
        onUse={(a) => {
          setEmail(a.email)
          setPassword(a.password)
          submit(undefined, a)
        }}
      />
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
    terms: f.terms ? '' : 'Please accept the terms to continue.',
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
    toast('Account created. Welcome to TAMS AP!')
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
                terms
              </button>
              .
            </span>
          </label>
          {errors.terms && <p className="mt-1.5 text-xs font-medium text-bad">{errors.terms}</p>}
        </div>
        {formError && (
          <p role="alert" className="rounded-xl bg-bad-bg px-3.5 py-2.5 text-sm font-medium text-bad">
            {formError}
          </p>
        )}
        <Button type="submit" size="lg" full loading={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </Button>
      </form>
      <Dialog open={terms} onClose={() => setTerms(false)} title="Terms">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>A 50% down payment holds a booking; the balance is due 3 days before travel.</li>
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
          <p className="mt-2">If an account exists for this address, it would get a link to set a new password. Password reset emails aren’t available yet. If you can’t log in, message our staff from the trip desk number on our site.</p>
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
