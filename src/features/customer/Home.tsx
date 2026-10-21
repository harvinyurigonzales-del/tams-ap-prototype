import { BusFront, ChevronLeft, ChevronRight, Compass, Map, Search, SlidersHorizontal, Sparkles, Tag, X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { recommendationRows, type RecItem, type RecRow } from '../../domain/recommend'
import { proposalExpired } from '../../domain/requests'
import { money, payableOptions, shortRange } from '../../domain/rules'
import { fmtDate, peso } from '../../lib/format'
import { myRecords, useCustomer, useMe } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import { DestinationCard, TourCard } from './Cards'

export function Home() {
  const me = useMe()
  const { data, customerId, viewed, dismissed, dismiss, undoDismiss } = useCustomer()
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const mine = myRecords(data, customerId)
  const rows = recommendationRows(data, { customerId, prefs: mine.prefs, saved: mine.saved, viewed, dismissed })
  const promoDep = data.departures.find((d) => d.promo)
  const promoSvc = promoDep && data.services.find((s) => s.id === promoDep.serviceId)
  const hasPrefs = !!mine.prefs && (mine.prefs.interests.length > 0 || mine.prefs.budgetMax > 0)

  const notInterested = (i: RecItem, name: string) => {
    dismiss(i.kind, i.id)
    toast(`Hidden ${name} for this session.`, 'info', { label: 'Undo', run: () => undoDismiss(i.kind, i.id) })
  }

  return (
    <div>
      <p className="text-sm text-ink-2">{me ? `Hello, ${me.name.split(' ')[0]}` : 'Hello, traveller'}</p>
      <h1 className="font-display text-[28px] leading-tight font-bold text-brand-900 md:text-[32px]">Where to next?</h1>
      <form
        role="search"
        className="relative mt-4"
        onSubmit={(e) => {
          e.preventDefault()
          navigate(`/app/tours${q.trim() ? `?q=${encodeURIComponent(q.trim())}` : ''}`)
        }}
      >
        <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-ink-3" aria-hidden />
        <input
          type="search"
          aria-label="Search tours and destinations"
          placeholder="Search tours or destinations"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="h-12 w-full rounded-2xl border border-line bg-surface pr-24 pl-12 text-[15px] shadow-card placeholder:text-ink-3 focus:border-brand-500 focus:ring-2 focus:ring-brand-100 focus:outline-none"
        />
        <button type="submit" className="absolute top-1/2 right-2 h-9 -translate-y-1/2 rounded-xl bg-brand-600 px-3 text-sm font-semibold text-white">
          Search
        </button>
      </form>

      <div className="mt-4 grid grid-cols-3 gap-2 sm:gap-3">
        <QuickLink to="/app/tours" icon={<Compass className="size-5" aria-hidden />} label="Tours" />
        <QuickLink to="/app/destinations" icon={<Map className="size-5" aria-hidden />} label="Destinations" />
        <QuickLink to="/app/rental" icon={<BusFront className="size-5" aria-hidden />} label="Van rental" />
      </div>

      {customerId && <NeedsAttention />}

      {promoDep && promoSvc && (
        <Link
          to={`/app/tours/${promoSvc.id}/dates?d=${promoDep.id}`}
          className="mt-6 block overflow-hidden rounded-3xl bg-gradient-to-br from-brand-600 to-brand-800 p-6 text-white shadow-card md:p-8"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">
            <Tag className="size-3.5" aria-hidden /> {promoDep.promo!.label}
          </span>
          <p className="mt-3 font-display text-2xl font-bold md:text-3xl">Save {peso(promoDep.promo!.amountOff)} per person</p>
          <p className="mt-1 text-sm text-brand-100">
            {promoSvc.name} · {shortRange(promoDep.startDate, promoDep.endDate)} departure. Book by {fmtDate(promoDep.promo!.bookBy, { year: false })}.
          </p>
          <span className="mt-4 inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-brand-700">View dates</span>
        </Link>
      )}

      {customerId && !hasPrefs && (
        <div className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50 px-4 py-3">
          <Sparkles className="size-5 text-brand-600" aria-hidden />
          <p className="flex-1 text-sm text-brand-900">Tell us what you like and we’ll suggest trips that match.</p>
          <Link to="/app/preferences" className="text-sm font-semibold text-brand-700 hover:underline">
            Set travel preferences
          </Link>
        </div>
      )}

      {rows.map((row) => (
        <RecCarousel key={row.id} row={row} onDismiss={notInterested} />
      ))}

      <p className="mt-8 flex items-start gap-2 text-xs text-ink-3">
        <SlidersHorizontal className="mt-px size-3.5 shrink-0" aria-hidden />
        Suggestions are simulated: simple rules match your preferences, saved items and past trips in this demo’s sample data. Nothing is sent anywhere.
        {customerId && (
          <Link to="/app/preferences" className="font-semibold text-brand-700 underline">
            Change preferences
          </Link>
        )}
      </p>
    </div>
  )
}

function QuickLink({ to, icon, label }: { to: string; icon: ReactNode; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1.5 rounded-2xl border border-line bg-surface px-2 py-3 text-sm font-semibold text-ink shadow-card hover:border-brand-300 sm:flex-row sm:justify-center">
      <span className="text-brand-600">{icon}</span>
      {label}
    </Link>
  )
}

/** Next actions across bookings and requests, so a waiting proposal or payment is not missed. */
function NeedsAttention() {
  const { data, customerId } = useCustomer()
  const mine = myRecords(data, customerId)
  const items: { to: string; title: string; body: string }[] = []
  for (const r of mine.customRequests) {
    if (r.status === 'Proposal ready' && r.proposal && !proposalExpired(r.proposal.validUntil))
      items.push({ to: `/app/custom/${r.id}`, title: 'Proposal ready to review', body: `${r.proposal.title} · ${peso(r.proposal.total)} · valid until ${fmtDate(r.proposal.validUntil, { year: false })}` })
  }
  for (const r of mine.rentalRequests) {
    if (r.status === 'Proposal ready' && r.quote && !proposalExpired(r.quote.validUntil))
      items.push({ to: `/app/rentals/${r.id}`, title: 'Van rental quote ready', body: `${r.dropoff} · ${peso(r.quote.total)} · valid until ${fmtDate(r.quote.validUntil, { year: false })}` })
  }
  for (const b of mine.bookings) {
    const opts = payableOptions(b, data.payments)
    if (b.status === 'Pending' && opts.length && money(b, data.payments).paid === 0)
      items.push({ to: `/app/trips/${b.id}`, title: 'Payment needed', body: `${b.label ?? data.services.find((s) => s.id === b.serviceId)?.name} · down payment ${peso(opts[0].amount)}` })
  }
  for (const q of mine.inquiries) {
    if (q.status === 'Staff replied') items.push({ to: `/app/messages/${q.id}`, title: 'Staff replied', body: q.subject })
  }
  if (!items.length) return null
  return (
    <section className="mt-6" aria-labelledby="attention">
      <h2 id="attention" className="mb-2 font-display text-lg font-semibold text-brand-900">
        Needs your attention
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.to}>
            <Link to={i.to} className="flex items-center gap-3 rounded-2xl border border-warn/30 bg-warn-bg px-4 py-3 hover:border-warn">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-ink">{i.title}</span>
                <span className="block truncate text-sm text-ink-2">{i.body}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-ink-3" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Accessible horizontal row: touch scroll on phones, previous/next buttons on larger screens, no autoplay. */
export function Carousel({ title, id, children, count }: { title: string; id: string; children: ReactNode; count: number }) {
  const ref = useRef<HTMLUListElement>(null)
  const [edges, setEdges] = useState({ start: true, end: false })
  const update = () => {
    const el = ref.current
    if (!el) return
    setEdges({ start: el.scrollLeft <= 4, end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 })
  }
  useEffect(() => {
    update()
    window.addEventListener('resize', update)
    return () => {
      window.removeEventListener('resize', update)
    }
  }, [count])
  const scroll = (dir: 1 | -1) => {
    const el = ref.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.9, behavior: 'smooth' })
  }
  return (
    <section className="mt-8" aria-labelledby={`row-${id}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 id={`row-${id}`} className="font-display text-lg font-semibold text-brand-900">
          {title}
        </h2>
        <div className="hidden gap-1 md:flex">
          <button onClick={() => scroll(-1)} disabled={edges.start} aria-label={`Previous items in ${title}`} className="rounded-full border border-line bg-surface p-1.5 text-ink-2 hover:bg-brand-50 disabled:opacity-30">
            <ChevronLeft className="size-5" />
          </button>
          <button onClick={() => scroll(1)} disabled={edges.end} aria-label={`More items in ${title}`} className="rounded-full border border-line bg-surface p-1.5 text-ink-2 hover:bg-brand-50 disabled:opacity-30">
            <ChevronRight className="size-5" />
          </button>
        </div>
      </div>
      <ul ref={ref} onScroll={update} className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-4 pb-2 sm:-mx-5 sm:px-5 md:mx-0 md:px-0">
        {children}
      </ul>
    </section>
  )
}

function RecCarousel({ row, onDismiss }: { row: RecRow; onDismiss: (i: RecItem, name: string) => void }) {
  const data = useCustomer((s) => s.data)
  return (
    <Carousel title={row.title} id={row.id} count={row.items.length}>
      {row.items.map((i) => {
        const name = i.kind === 'tour' ? data.services.find((s) => s.id === i.id)!.name : data.destinations.find((x) => x.id === i.id)!.name
        const footer = (
          <button onClick={() => onDismiss(i, name)} className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink">
            <X className="size-3.5" aria-hidden /> Not interested
          </button>
        )
        return (
          <li key={`${i.kind}:${i.id}`} className="w-[78%] shrink-0 snap-start sm:w-[46%] lg:w-[31.5%]">
            {i.kind === 'tour' ? (
              <TourCard service={data.services.find((s) => s.id === i.id)!} reason={i.reason} footer={footer} />
            ) : (
              <DestinationCard dest={data.destinations.find((x) => x.id === i.id)!} reason={i.reason} footer={footer} />
            )}
          </li>
        )
      })}
    </Carousel>
  )
}
