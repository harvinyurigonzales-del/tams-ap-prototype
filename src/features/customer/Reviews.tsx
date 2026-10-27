import { BadgeCheck, Lightbulb, MessageSquareReply, PenLine, Star } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { ratingFor, ratingOf, reviewedTrips, reviewEligibility, validateReview, type ReviewSort } from '../../domain/reviews'
import { fmtDate, fmtRange } from '../../lib/format'
import { useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import type { Booking, Review } from '../../seed/types'
import { Button, LinkButton } from '../../ui/Button'
import { Select, TextArea, TextField } from '../../ui/Field'
import { RatingBadge, Stars } from '../../ui/Stars'

const PAGE = 8
const PARTIES: NonNullable<Review['party']>[] = ['Solo', 'Couple', 'Family', 'Friends', 'Officemates']

/**
 * Public ratings and comments. Every review comes from a completed TAMS AP trip, and only travellers with a
 * completed trip can write one, so the page stays honest without a moderation queue.
 */
export function ReviewsPage() {
  const data = useCustomer((s) => s.data)
  const [params, setParams] = useSearchParams()
  const tour = params.get('tour') ?? ''
  const stars = Number(params.get('stars') ?? 0)
  const sort: ReviewSort = params.get('sort') === 'highest' ? 'highest' : 'recent'
  const withTips = params.get('tips') === '1'
  const [shown, setShown] = useState(PAGE)

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params)
    if (!value) next.delete(key)
    else next.set(key, value)
    setParams(next, { replace: true })
    setShown(PAGE)
  }

  const all = data.reviews
  const overall = ratingOf(all)
  // Past reviews stay readable after a package is deactivated.
  const tours = data.services.filter((s) => s.type === 'tour')
  const ranked = tours
    .map((s) => ({ s, r: ratingFor(data, s.id) }))
    .filter((x) => x.r.count > 0)
    .sort((a, b) => b.r.avg - a.r.avg || b.r.count - a.r.count)

  const list = all
    .filter((r) => (!tour || r.serviceId === tour) && (!stars || r.rating === stars) && (!withTips || !!r.suggestion))
    .sort((a, b) => (sort === 'highest' ? b.rating - a.rating || b.createdAt.localeCompare(a.createdAt) : b.createdAt.localeCompare(a.createdAt)))
  const tourName = tours.find((s) => s.id === tour)?.name

  return (
    <div>
      <header className="grid gap-8 lg:grid-cols-[1fr_380px] lg:items-end">
        <div>
          <p className="type-eyebrow text-sili">Kuwento ng biyahe</p>
          <h1 className="mt-2 type-hero text-[38px] text-charcoal md:text-[52px]">Reviews from our travellers</h1>
          <p className="mt-3 max-w-xl text-[15px] text-ink-2">
            Ratings, comments and suggestions from people who completed a trip with TAMS AP. Only travellers with a finished trip can rate it, so every review
            here comes from a real seat on the van.
          </p>
        </div>
        <Summary rating={overall} />
      </header>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0">
          <RateCard />

          <div className="mt-8 flex flex-wrap items-end justify-between gap-3">
            <h2 className="type-head text-[24px] text-charcoal">{tourName ? `Reviews for ${tourName}` : 'All reviews'}</h2>
            <p className="text-sm text-ink-2" aria-live="polite">
              {list.length} {list.length === 1 ? 'review' : 'reviews'}
            </p>
          </div>

          <div className="mt-3 grid gap-3 rounded-[20px] bg-surface p-3 ring-1 ring-line sm:grid-cols-[1fr_auto_auto] sm:items-center" role="group" aria-label="Filter reviews">
            <label className="flex min-w-0 flex-col px-2 text-xs font-semibold text-ink-2">
              Tour
              <select value={tour} onChange={(e) => set('tour', e.target.value)} className="w-full min-w-0 bg-transparent py-1 text-[15px] font-medium text-ink focus:outline-none">
                <option value="">All tours</option>
                {tours.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="Stars">
              {[0, 5, 4].map((n) => (
                <button
                  key={n}
                  onClick={() => set('stars', n ? String(n) : '')}
                  aria-pressed={stars === n}
                  className={`inline-flex h-9 items-center gap-1 rounded-full px-3.5 text-sm font-semibold ${stars === n ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-2 hover:text-ink'}`}
                >
                  {n ? (
                    <>
                      {n} <Star className="size-3.5" fill="currentColor" strokeWidth={0} aria-hidden />
                      <span className="sr-only">stars</span>
                    </>
                  ) : (
                    'All'
                  )}
                </button>
              ))}
              <button
                onClick={() => set('tips', withTips ? '' : '1')}
                aria-pressed={withTips}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ${withTips ? 'bg-brand-600 text-white' : 'bg-surface-muted text-ink-2 hover:text-ink'}`}
              >
                <Lightbulb className="size-3.5" aria-hidden /> With suggestions
              </button>
            </div>
            <label className="flex items-center gap-2 px-2 text-xs font-semibold text-ink-2">
              Sort
              <select value={sort} onChange={(e) => set('sort', e.target.value === 'recent' ? '' : e.target.value)} className="bg-transparent py-1 text-sm font-semibold text-ink focus:outline-none">
                <option value="recent">Most recent</option>
                <option value="highest">Highest rated</option>
              </select>
            </label>
          </div>

          {list.length === 0 ? (
            <p className="mt-6 rounded-[20px] bg-surface px-5 py-8 text-center text-sm text-ink-2 ring-1 ring-line">No reviews match these filters yet.</p>
          ) : (
            <ul className="mt-4 space-y-4">
              {list.slice(0, shown).map((r) => (
                <li key={r.id}>
                  <ReviewCard review={r} showTour={!tour} />
                </li>
              ))}
            </ul>
          )}
          {shown < list.length && (
            <div className="mt-5 text-center">
              <Button variant="secondary" onClick={() => setShown((n) => n + PAGE)}>
                Show more reviews
              </Button>
            </div>
          )}
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <section className="rounded-[20px] bg-surface p-5 ring-1 ring-line" aria-labelledby="best-rated">
            <h2 id="best-rated" className="type-head text-[20px] text-charcoal">
              Best rated tours
            </h2>
            <p className="mt-1 text-xs text-ink-2">Ranked by average rating, then by number of reviews.</p>
            <ol className="mt-4 space-y-1">
              {ranked.map(({ s, r }, i) => (
                <li key={s.id}>
                  <button
                    onClick={() => set('tour', tour === s.id ? '' : s.id)}
                    aria-pressed={tour === s.id}
                    className={`flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors ${tour === s.id ? 'bg-brand-50' : 'hover:bg-surface-muted'}`}
                  >
                    <span className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold tnum ${i < 3 ? 'bg-sili text-white' : 'bg-surface-muted text-ink-2'}`}>{i + 1}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-ink">{s.name}</span>
                      <RatingBadge avg={r.avg} count={r.count} className="text-xs" />
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        </aside>
      </div>
    </div>
  )
}

function Summary({ rating }: { rating: ReturnType<typeof ratingOf> }) {
  const max = Math.max(1, ...rating.dist)
  return (
    <section className="rounded-[20px] bg-surface p-5 ring-1 ring-line" aria-label="Overall rating">
      <div className="flex items-center gap-4">
        <p className="type-hero text-[52px] text-charcoal tnum">{rating.avg.toFixed(1)}</p>
        <div>
          <Stars value={rating.avg} size="lg" />
          <p className="mt-1 text-sm text-ink-2">
            {rating.count} reviews <span className="sr-only">, average {rating.avg.toFixed(1)} out of 5</span>
          </p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5">
        {rating.dist.map((n, i) => (
          <li key={i} className="flex items-center gap-2 text-xs text-ink-2">
            <span className="w-10 shrink-0 tnum">{5 - i} star</span>
            <span className="h-2 flex-1 rounded-full bg-surface-muted">
              <span className="block h-2 rounded-full bg-star" style={{ width: `${(n / max) * 100}%` }} />
            </span>
            <span className="w-6 shrink-0 text-right tnum">{n}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-2">
        <BadgeCheck className="size-4 text-palay" aria-hidden /> Every review is from a completed trip.
      </p>
    </section>
  )
}

export function ReviewCard({ review: r, showTour = true }: { review: Review; showTour?: boolean }) {
  const data = useCustomer((s) => s.data)
  const customerId = useCustomer((s) => s.customerId)
  const s = data.services.find((x) => x.id === r.serviceId)
  const mine = !!customerId && r.customerId === customerId
  return (
    <article className="rounded-[20px] bg-surface p-5 ring-1 ring-line">
      <header className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-50 font-display text-sm font-bold text-brand-700" aria-hidden>
          {r.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-ink">
            {r.name}
            {mine && <span className="ml-2 rounded-full bg-sili-50 px-2 py-0.5 text-[11px] font-semibold text-sili-600">Your review</span>}
          </p>
          <p className="text-xs text-ink-2">
            {r.city}
            {r.party && ` · ${r.party}`} · Travelled {fmtDate(r.travelDate, { year: true })}
          </p>
        </div>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs text-ink-2">
          <Stars value={r.rating} />
          <span className="sr-only">{r.rating} out of 5 stars</span>
        </span>
      </header>
      {r.title && <h3 className="mt-3 type-head text-[18px] text-charcoal">{r.title}</h3>}
      {r.text && <p className={`${r.title ? 'mt-1.5' : 'mt-3'} text-[15px] leading-relaxed text-ink`}>{r.text}</p>}
      {!r.title && !r.text && <p className="mt-3 text-sm text-ink-2">Rated {r.rating} out of 5 stars.</p>}
      {r.suggestion && (
        <div className="mt-3 flex gap-2.5 rounded-xl bg-surface-muted px-4 py-3 text-sm">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-sili" aria-hidden />
          <p>
            <span className="font-semibold text-ink">Suggestion: </span>
            <span className="text-ink-2">{r.suggestion}</span>
          </p>
        </div>
      )}
      {r.staffReply && (
        <div className="mt-3 border-l-2 border-brand-600 pl-4">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-brand-700">
            <MessageSquareReply className="size-3.5" aria-hidden /> Reply from TAMS AP · {fmtDate(r.staffReply.at.slice(0, 10), { year: false })}
          </p>
          <p className="mt-1 text-sm text-ink-2">{r.staffReply.text}</p>
        </div>
      )}
      {showTour && s && (
        <p className="mt-4 border-t border-line pt-3 text-xs text-ink-2">
          Trip:{' '}
          {s.type === 'tour' ? (
            <Link to={`/app/tours/${s.id}`} className="font-semibold text-brand-700 hover:underline">
              {s.name}
            </Link>
          ) : (
            <span className="font-semibold text-ink">{data.bookings.find((b) => b.id === r.bookingId)?.label ?? s.name}</span>
          )}
        </p>
      )}
    </article>
  )
}

const tripName = (d: ReturnType<typeof useCustomer.getState>['data'], b: Booking) => b.label ?? d.services.find((s) => s.id === b.serviceId)?.name ?? 'Your trip'

/**
 * "Trips you can review": the signed-in customer's completed trips without a review, each with its package,
 * dates and booking reference, so they can pick the one to rate. Trips already rated are listed below it.
 * A link with ?trip=BK-… (from a notification or the booking page) opens that trip's form straight away.
 */
function RateCard() {
  const data = useCustomer((s) => s.data)
  const customerId = useCustomer((s) => s.customerId)
  const loc = useLocation()
  const [params] = useSearchParams()
  const el = reviewEligibility(data, customerId)
  const asked = params.get('trip')
  const [writing, setWriting] = useState<string | null>(() => (el.ok && asked && el.trips.some((b) => b.id === asked) ? asked : el.ok && el.trips.length === 1 ? el.trips[0].id : null))
  const done = reviewedTrips(data, customerId)
  // Coming from "Rate your trip" or a notification: bring the form into view.
  useEffect(() => {
    if (asked) document.getElementById('rate')?.scrollIntoView({ block: 'start' })
  }, [asked])
  const box = 'rounded-[20px] bg-brand-600 p-5 text-white sm:p-6'

  const reviewed = done.length > 0 && (
    <div className="mt-4 rounded-2xl bg-white/10 p-4">
      <h3 className="text-sm font-semibold">Trips you reviewed</h3>
      <ul className="mt-2 space-y-1.5">
        {done.map(({ booking: b, review }) => (
          <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
            <span className="min-w-0">
              <span className="font-semibold">{tripName(data, b)}</span>
              <span className="text-white/80">
                {' '}
                · {fmtRange(b.startDate, b.endDate)} · {b.id}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-ink">
              <Stars value={review.rating} size="xs" /> Reviewed
              <span className="sr-only">, {review.rating} out of 5 stars</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  )

  if (!el.ok) {
    const copy = {
      guest: { title: 'Travelled with us?', body: 'Log in to rate a trip you completed with TAMS AP.', action: <LinkButton to={`/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}`} variant="secondary">Log in to rate</LinkButton> },
      'no-trips': {
        title: 'You can rate after your first trip',
        body: 'Once staff mark one of your trips completed, it shows up here so you can rate it.',
        action: <LinkButton to="/app/explore" variant="secondary">Find a trip</LinkButton>,
      },
      'all-reviewed': { title: 'Salamat sa review!', body: 'You have rated every trip you completed with us. Your next completed trip will show up here.', action: null },
    }[el.reason]
    return (
      <section id="rate" className={box} aria-labelledby="rate-title">
        <h2 id="rate-title" className="type-head text-[22px]">
          {copy.title}
        </h2>
        <p className="mt-1 max-w-lg text-sm text-white/85">{copy.body}</p>
        {copy.action && <div className="mt-4">{copy.action}</div>}
        {reviewed}
      </section>
    )
  }

  return (
    <section id="rate" className={box} aria-labelledby="rate-title">
      <h2 id="rate-title" className="type-head text-[22px]">
        Trips you can review
      </h2>
      <p className="mt-1 text-sm text-white/85">
        {el.trips.length > 1 ? `You have ${el.trips.length} completed trips to rate. Choose one to start.` : 'Only the star rating is needed. A comment is welcome but optional.'}
      </p>
      <ul className="mt-4 space-y-2">
        {el.trips.map((b) => (
          <li key={b.id}>
            {writing === b.id ? (
              <ReviewForm booking={b} onDone={() => setWriting(null)} />
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-white/10 px-4 py-3">
                <p className="min-w-0 text-sm">
                  <span className="block font-semibold">{tripName(data, b)}</span>
                  <span className="text-white/80">
                    {fmtRange(b.startDate, b.endDate)} · Ref {b.id}
                  </span>
                </p>
                <Button variant="secondary" icon={<PenLine className="size-4" aria-hidden />} onClick={() => setWriting(b.id)} aria-label={`Rate ${tripName(data, b)}, ${b.id}`}>
                  Rate this trip
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
      {reviewed}
    </section>
  )
}

const LABELS = ['', 'Poor', 'Fair', 'Good', 'Very good', 'Excellent']

function ReviewForm({ booking, onDone }: { booking: Booking; onDone: () => void }) {
  const submitReview = useCustomer((s) => s.submitReview)
  const data = useCustomer((s) => s.data)
  const toast = useUi((s) => s.toast)
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [text, setText] = useState('')
  const [suggestion, setSuggestion] = useState('')
  const [party, setParty] = useState<Review['party'] | ''>('')
  const [more, setMore] = useState(false)
  const [errors, setErrors] = useState<ReturnType<typeof validateReview>>({})
  const shown = hover || rating

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const errs = validateReview({ rating, title, text, suggestion })
    setErrors(errs)
    if (Object.keys(errs).length) return
    const r = submitReview({ bookingId: booking.id, rating, title, text, suggestion, party: party || undefined })
    if (!r.ok) {
      toast(r.error, 'error')
      return
    }
    toast('Thanks! Your review is posted.')
    onDone()
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-2xl bg-surface p-5 text-ink" noValidate aria-label={`Review ${tripName(data, booking)}`}>
      <p className="text-sm text-ink-2">
        Rating <span className="font-semibold text-ink">{tripName(data, booking)}</span>, {fmtRange(booking.startDate, booking.endDate)} · Ref {booking.id}
      </p>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-ink">
          Your rating <span className="text-bad">*</span>
        </legend>
        <div className="flex flex-wrap items-center gap-x-3" onMouseLeave={() => setHover(0)}>
          <div className="flex" role="radiogroup" aria-label="Star rating" aria-required="true">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="cursor-pointer rounded-lg p-1.5" onMouseEnter={() => setHover(n)}>
                <input type="radio" name={`rating-${booking.id}`} value={n} checked={rating === n} onChange={() => setRating(n)} className="peer sr-only" />
                <span className="sr-only">
                  {n} {n === 1 ? 'star' : 'stars'}, {LABELS[n]}
                </span>
                <Star className={`size-8 rounded peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-600 ${n <= shown ? 'text-star' : 'text-line-strong'}`} fill="currentColor" strokeWidth={0} aria-hidden />
              </label>
            ))}
          </div>
          <span className="text-sm font-semibold text-ink-2" aria-live="polite">
            {LABELS[shown]}
          </span>
        </div>
        {errors.rating && (
          <p role="alert" className="mt-1.5 text-xs font-medium text-bad">
            {errors.rating}
          </p>
        )}
      </fieldset>
      <TextArea
        label="Comment (optional)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="What did you enjoy? How were the pickup, van, guide and stops?"
        error={errors.text}
        maxLength={1000}
      />
      {more ? (
        <>
          <TextField label="Title (optional)" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Sum up your trip in a few words" maxLength={80} error={errors.title} />
          <TextArea
            label="Suggestion for TAMS AP (optional)"
            value={suggestion}
            onChange={(e) => setSuggestion(e.target.value)}
            placeholder="Anything we could do better next time?"
            hint="Shown with your review so other travellers can see we listen."
            className="min-h-20"
            maxLength={500}
            error={errors.suggestion}
          />
          <Select label="Who did you travel with? (optional)" value={party} onChange={(e) => setParty(e.target.value as Review['party'] | '')}>
            <option value="">Prefer not to say</option>
            {PARTIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </>
      ) : (
        <button type="button" onClick={() => setMore(true)} className="text-sm font-semibold text-brand-700 hover:underline">
          Add a title, suggestion or who you travelled with
        </button>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="submit">Post review</Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
