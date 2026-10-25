import { RotateCcw, UserRoundX } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CLOCK_SOURCE, DEMO_TODAY } from '../lib/demoClock'
import { fmtDate } from '../lib/format'
import { resetAll, resetMaria } from '../state/demo'
import { usePresenter } from '../state/presenter'
import { useUi } from '../state/ui'
import { BrandMark } from '../ui/BrandMark'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/Dialog'

/**
 * Presenter utility at /presenter. It is not linked from the customer site or the staff portal: it is for whoever
 * runs a demo, to start Maria's journey again or to put every record back to the sample data.
 */
export function Presenter() {
  const [ask, setAsk] = useState<'maria' | 'all' | null>(null)
  const toast = useUi((s) => s.toast)
  const presenter = usePresenter()
  return (
    <div className="theme-tara min-h-dvh bg-ivory">
      <div className="mx-auto max-w-2xl px-5 py-10">
        <Link to="/app" aria-label="TAMS AP home">
          <BrandMark className="h-10" />
        </Link>
        <h1 className="mt-8 type-head text-[30px] text-charcoal">Presenter tools</h1>
        <p className="mt-2 text-sm text-ink-2">
          Records are saved in this browser and shared by every tab of the site, so the customer site and the staff portal see the same bookings. Use these tools to start a
          demo again.
        </p>

        <section className="mt-6 space-y-3">
          <Tool
            icon={<UserRoundX className="size-5" aria-hidden />}
            title="Reset Maria’s journey"
            body="Removes Maria Santos’s bookings, payments, van assignments, requests, reviews, messages, notifications, saved trips and preferences. Her profile and login stay, and nobody else’s records change."
            action={<Button onClick={() => setAsk('maria')}>Reset Maria</Button>}
          />
          <Tool
            icon={<RotateCcw className="size-5" aria-hidden />}
            title="Reset all sample data"
            body="Puts every record back to the sample data, including staff accounts, fleet, packages and chatbot answers, and logs everyone out in this tab. Other open tabs follow."
            action={
              <Button variant="danger" onClick={() => setAsk('all')}>
                Reset everything
              </Button>
            }
          />
          <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
            <input type="checkbox" checked={presenter.on} onChange={(e) => presenter.set(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
            <span>
              <span className="block font-semibold text-ink">Presenter shortcuts on customer screens</span>
              <span className="text-ink-2">
                Adds buttons on Maria’s bookings and requests that play a staff step without switching to the staff portal. Off by default; it lasts for this tab.
              </span>
            </span>
          </label>
        </section>

        <p className="mt-6 text-xs text-ink-3">
          Today in the demo: {fmtDate(DEMO_TODAY, { weekday: true, year: true })} ({CLOCK_SOURCE === 'pinned' ? 'pinned with ?demo-date' : 'today’s date in Manila'}).
        </p>
        <p className="mt-4 flex flex-wrap gap-4 text-sm font-semibold">
          <Link to="/app" className="text-brand-700 hover:underline">
            Customer site
          </Link>
          <Link to="/app/login" className="text-brand-700 hover:underline">
            Log in
          </Link>
        </p>
      </div>
      <ConfirmDialog
        open={ask === 'maria'}
        onClose={() => setAsk(null)}
        title="Reset Maria’s journey?"
        body="Maria’s activity is removed so she starts with a clean account. This cannot be undone."
        confirmLabel="Reset Maria"
        tone="danger"
        onConfirm={() => {
          resetMaria()
          toast('Maria’s journey was reset.')
        }}
      />
      <ConfirmDialog
        open={ask === 'all'}
        onClose={() => setAsk(null)}
        title="Reset all sample data?"
        body="Every record goes back to the sample data and this tab is logged out. This cannot be undone."
        confirmLabel="Reset everything"
        tone="danger"
        onConfirm={() => {
          resetAll()
          toast('All records were reset to the sample data.')
        }}
      />
    </div>
  )
}

function Tool({ icon, title, body, action }: { icon: React.ReactNode; title: string; body: string; action: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4 sm:flex-row sm:items-start">
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 text-brand-700">{icon}</span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="mt-0.5 text-sm text-ink-2">{body}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </div>
  )
}
