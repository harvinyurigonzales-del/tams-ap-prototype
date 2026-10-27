import { ArrowRight, CalendarDays, Check, Clock, MapPin, MessageCircleQuestion, PencilRuler, Users, X } from 'lucide-react'
import { useEffect, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { isOffered, priceUnitOf } from '../../domain/packages'
import { ratingOf, reviewsFor } from '../../domain/reviews'
import { BALANCE_DUE_DAYS_BEFORE, BOOKING_CUTOFF_DAYS, DOWN_PAYMENT_RATE, promoFor, shortRange } from '../../domain/rules'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtTime, peso } from '../../lib/format'
import { useAssistant } from '../../state/assistant'
import { useCustomer } from '../../state/customerStore'
import type { Service } from '../../seed/types'
import { Button, LinkButton } from '../../ui/Button'
import { EmptyState } from '../../ui/EmptyState'
import { Picture } from '../../ui/Picture'
import { RatingBadge, Stars } from '../../ui/Stars'
import { destinationOf, PriceTag, SaveButton } from './Cards'
import { BackLink } from './Explore'
import { PhotoCreditLine } from './Destinations'
import { ReviewCard } from './Reviews'
import { departuresOf } from './select'

/** "Day 1: Depart Manila, …" → { when: 'Day 1', what: 'Depart Manila, …' }. */
const splitStep = (line: string) => {
  const i = line.indexOf(': ')
  return i > 0 && i < 16 ? { when: line.slice(0, i), what: line.slice(i + 2) } : { when: '', what: line }
}

export function TourDetails() {
  const { serviceId } = useParams()
  const data = useCustomer((s) => s.data)
  const markViewed = useCustomer((s) => s.markViewed)
  const found = data.services.find((x) => x.id === serviceId && x.type === 'tour')
  const s = found && isOffered(found) ? found : undefined
  useEffect(() => {
    if (s) markViewed('tour', s.id)
  }, [s, markViewed])
  if (found && !s) return <UnavailableTour />
  if (!s) return <EmptyState title="Tour not found" action={<LinkButton to="/app/explore">Explore tours</LinkButton>} />
  return <TourPage s={s} deps={departuresOf(data, s.id)} />
}

/**
 * The customer tour page. Admins see the same layout in "Preview customer view", with unsaved form values and
 * every booking action switched off, so previewing never publishes or opens the package.
 */
export function TourPage({ s, deps, preview = false }: { s: Service; deps: ReturnType<typeof departuresOf>; preview?: boolean }) {
  const data = useCustomer((st) => st.data)
  const openWith = useAssistant((st) => st.openWith)
  const dest = destinationOf(data, s)
  const image = s.image ?? dest?.image
  const open = deps.filter((d) => d.avail.state === 'open')
  const next = open[0]
  const price = next ? s.price - promoFor(next.dep, DEMO_TODAY) : s.price
  const reviews = preview ? [] : reviewsFor(data, s.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const rating = ratingOf(reviews)
  const inert = (label: string) => (
    <span className="inline-flex h-10 items-center rounded-full bg-surface-muted px-4 text-sm font-semibold text-ink-3" title="Preview only">
      {label}
    </span>
  )

  return (
    <div>
      {!preview && <BackLink to="/app/explore" label="Explore" />}
      <div className="relative">
        {image ? (
          <Picture image={image} eager sizes="(min-width: 1180px) 1132px, 100vw" className="aspect-[4/3] rounded-[28px] sm:aspect-[16/8] lg:aspect-[21/8]" labelAt="tr" />
        ) : (
          <div className="aspect-[16/8] rounded-[28px] bg-sand" />
        )}
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-t from-black/75 via-black/20 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
          <p className="flex flex-wrap items-center gap-2 text-sm text-white/90">
            <span className="rounded-full bg-white/92 px-2.5 py-1 text-xs font-semibold text-charcoal">Joiner tour</span>
            {s.season && <span className="rounded-full bg-sili px-2.5 py-1 text-xs font-semibold text-white">{s.season}</span>}
            <span className="inline-flex items-center gap-1">
              <MapPin className="size-4" aria-hidden /> {s.destination}
            </span>
          </p>
          <h1 className="mt-2 type-hero text-[34px] sm:text-[46px] lg:text-[60px]">{s.name}</h1>
          <a href="#reviews" className="pointer-events-auto mt-3 inline-flex rounded-full hover:underline">
            <RatingBadge avg={rating.avg} count={rating.count} tone="inverse" />
          </a>
        </div>
      </div>
      {image?.credit && <PhotoCreditLine credit={image.credit} />}

      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <p className="max-w-2xl text-lg text-ink">{s.summary}</p>
            {!preview && <SaveButton item={{ kind: 'tour', id: s.id }} name={s.name} withLabel className="shrink-0" />}
          </div>
          {s.description && <p className="mt-3 max-w-2xl text-[15px] text-ink-2">{s.description}</p>}

          <dl className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-[22px] bg-line ring-1 ring-line sm:grid-cols-3">
            <Fact icon={<Clock className="size-4" aria-hidden />} label="Length">
              {s.duration}
            </Fact>
            <Fact icon={<MapPin className="size-4" aria-hidden />} label="Pickup point">
              {s.pickup}
            </Fact>
            <Fact icon={<CalendarDays className="size-4" aria-hidden />} label="Pickup time">
              {fmtTime(s.pickupTime)}
            </Fact>
            <Fact icon={<Users className="size-4" aria-hidden />} label="Arrangement">
              Joiner tour, shared van
            </Fact>
            <Fact label="Price">{peso(price)} per {priceUnitOf(s)}</Fact>
            <Fact label="Good for">{(s.interests ?? []).join(', ') || 'Everyone'}</Fact>
          </dl>

          <section className="mt-10" aria-labelledby="plan">
            <h2 id="plan" className="type-head text-[30px] text-charcoal">
              Ang plano
            </h2>
            <p className="mt-1 text-sm text-ink-2">The day-by-day plan for this package.</p>
            <ol className="mt-5">
              <RouteStop first when={fmtTime(s.pickupTime)} what={`Pickup at ${s.pickup}`} />
              {s.itinerary.map((line, i) => {
                const st = splitStep(line)
                return <RouteStop key={line} when={st.when} what={st.what} last={i === s.itinerary.length - 1} />
              })}
            </ol>
          </section>

          <Inclusions inclusions={s.inclusions} exclusions={s.exclusions} />

          <section className="mt-10" aria-labelledby="schedule">
            <h2 id="schedule" className="type-head text-[30px] text-charcoal">
              Schedule
            </h2>
            {deps.length === 0 ? (
              <p className="mt-2 text-sm text-ink-2">No upcoming departures are scheduled.</p>
            ) : (
              <ul className="mt-4 divide-y divide-line overflow-hidden rounded-[22px] bg-surface ring-1 ring-line">
                {deps.map(({ dep, avail }) => {
                  const off = promoFor(dep, DEMO_TODAY)
                  return (
                    <li key={dep.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-ink">{shortRange(dep.startDate, dep.endDate)}</p>
                        <p className="text-sm text-ink-2">
                          {fmtDate(dep.startDate, { weekday: true, year: false }).split(',')[0]} departure
                          {off > 0 && <span className="block font-semibold text-sili sm:ml-2 sm:inline">{dep.promo!.label}: {peso(off)} off</span>}
                        </p>
                      </div>
                      <p className={`text-sm font-semibold ${avail.state === 'open' ? (avail.left <= 4 ? 'text-sili' : 'text-palay') : 'text-ink-3'}`}>
                        {avail.state === 'open' ? `${avail.left} seats left` : avail.state === 'full' ? 'Full' : 'Booking closed'}
                      </p>
                      {avail.state === 'open' && preview && inert('Book')}
                      {avail.state === 'open' && !preview && (
                        <Link
                          to={`/app/tours/${s.id}/dates?d=${dep.id}`}
                          className="inline-flex h-10 items-center rounded-full bg-sili px-4 text-sm font-semibold text-white hover:bg-sili-600"
                          aria-label={`Book ${shortRange(dep.startDate, dep.endDate)}`}
                        >
                          Book
                        </Link>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section className="mt-10 scroll-mt-24" id="reviews" aria-labelledby="reviews-h">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 id="reviews-h" className="type-head text-[30px] text-charcoal">
                  Kuwento ng biyahe
                </h2>
                <p className="mt-1 text-sm text-ink-2">Reviews from travellers who joined this tour. Only completed trips can be reviewed.</p>
              </div>
              {rating.count > 0 && !preview && (
                <Link to={`/app/reviews?tour=${s.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
                  See all {rating.count} reviews <ArrowRight className="size-4" aria-hidden />
                </Link>
              )}
            </div>
            {rating.count === 0 ? (
              <p className="mt-4 rounded-[18px] bg-sand/70 px-5 py-4 text-sm text-ink-2">No reviews yet. Travellers can rate this tour after their trip.</p>
            ) : (
              <>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[22px] bg-surface px-5 py-4 ring-1 ring-line">
                  <p className="flex items-baseline gap-2">
                    <span className="type-hero text-[40px] text-charcoal tnum">{rating.avg.toFixed(1)}</span>
                    <span className="text-sm text-ink-2">out of 5</span>
                  </p>
                  <div>
                    <Stars value={rating.avg} size="lg" />
                    <p className="mt-1 text-sm text-ink-2">
                      From {rating.count} completed {rating.count === 1 ? 'trip' : 'trips'}
                    </p>
                  </div>
                </div>
                <ul className="mt-4 grid gap-3">
                  {reviews.slice(0, 3).map((r) => (
                    <li key={r.id}>
                      <ReviewCard review={r} showTour={false} />
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>

          <section className="mt-10" aria-labelledby="conditions">
            <h2 id="conditions" className="type-head text-[30px] text-charcoal">
              Before you book
            </h2>
            <ul className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Condition title={`${DOWN_PAYMENT_RATE * 100}% down payment holds your seat`}>
                Pay by GCash, Maya or bank transfer and upload your receipt. Staff verify it before your booking is confirmed.
              </Condition>
              <Condition title={`Balance due ${BALANCE_DUE_DAYS_BEFORE} days before`}>The remaining balance is due {BALANCE_DUE_DAYS_BEFORE} days before the departure date.</Condition>
              <Condition title={`Online booking closes ${BOOKING_CUTOFF_DAYS} days before`}>After that, message us and staff will check if a seat can still be added.</Condition>
              <Condition title="Cancellations">Request a cancellation from My Trips any time before the travel date. Staff review each request and contact you.</Condition>
            </ul>
          </section>
        </div>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[22px] bg-surface p-6 ring-1 ring-line">
            <PriceTag price={price} was={next && price < s.price ? s.price : undefined} unit={priceUnitOf(s)} size="lg" />
            <a href="#reviews" className="mt-2 inline-flex hover:underline">
              <RatingBadge avg={rating.avg} count={rating.count} />
            </a>
            <p className="mt-3 text-sm text-ink-2">
              {next ? (
                <>
                  Next departure <span className="font-semibold text-ink">{fmtDate(next.dep.startDate, { weekday: true, year: false })}</span>, {next.avail.left} seats left
                </>
              ) : (
                'No open departures right now, so this tour can’t be booked online.'
              )}
            </p>
            <p className="mt-1 text-sm text-ink-2">
              Pickup {fmtTime(s.pickupTime)} at {s.pickup}
            </p>
            <div className="mt-5 grid gap-2">
              {preview ? (
                <p className="rounded-xl bg-warn-bg px-3 py-2 text-sm text-warn">Preview only. Booking is switched off here.</p>
              ) : next ? (
                <LinkButton to={`/app/tours/${s.id}/dates`} size="lg" full>
                  <CalendarDays className="size-5" aria-hidden /> View dates
                </LinkButton>
              ) : (
                dest && (
                  <LinkButton to={`/app/custom/new?destination=${dest.id}`} size="lg" full>
                    <PencilRuler className="size-5" aria-hidden /> Plan a custom trip to {dest.name}
                  </LinkButton>
                )
              )}
              {!preview && (
                <Button variant="ghost" full icon={<MessageCircleQuestion className="size-4" aria-hidden />} onClick={() => openWith({ kind: 'tour', id: s.id })}>
                  Ask about this tour
                </Button>
              )}
            </div>
            {dest && !preview && (
              <p className="mt-4 border-t border-line pt-4 text-sm text-ink-2">
                New to {dest.name}?{' '}
                <Link to={`/app/destinations/${dest.id}`} className="font-semibold text-brand-700 hover:underline">
                  Read about the place
                </Link>
              </p>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function Fact({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="bg-surface px-4 py-4">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-ink-2">
        {icon}
        {label}
      </dt>
      <dd className="mt-1 text-[15px] font-medium text-ink">{children}</dd>
    </div>
  )
}

/** One stop on the plan, drawn on the dashed route line that runs through the customer app. */
function RouteStop({ when, what, first = false, last = false }: { when: string; what: string; first?: boolean; last?: boolean }) {
  return (
    <li className="relative flex gap-4 pb-6 last:pb-0">
      {!last && <span className="route-line-y absolute top-5 bottom-0 left-[9px] w-0.5 text-line-strong" aria-hidden />}
      <span className={`relative mt-1 grid size-5 shrink-0 place-items-center rounded-full ${first ? 'bg-sili' : 'border-2 border-brand-600 bg-surface'}`} aria-hidden>
        {first && <span className="size-1.5 rounded-full bg-white" />}
      </span>
      <div className="min-w-0">
        {when && <p className="text-xs font-semibold text-brand-700">{when}</p>}
        <p className="text-[15px] text-ink">{what}</p>
      </div>
    </li>
  )
}

function Condition({ title, children }: { title: string; children: ReactNode }) {
  return (
    <li className="rounded-[18px] bg-sand/70 px-5 py-4">
      <p className="font-semibold text-ink">{title}</p>
      <p className="mt-1 text-ink-2">{children}</p>
    </li>
  )
}

export function Inclusions({ inclusions, exclusions }: { inclusions: string[]; exclusions: string[] }) {
  return (
    <section className="mt-10 grid gap-6 sm:grid-cols-2" aria-label="What’s included">
      <div>
        <h2 className="type-head text-[24px] text-charcoal">Included</h2>
        <ul className="mt-3 space-y-2 text-[15px]">
          {inclusions.map((i) => (
            <li key={i} className="flex gap-2.5">
              <Check className="mt-0.5 size-5 shrink-0 text-palay" aria-hidden /> {i}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h2 className="type-head text-[24px] text-charcoal">Not included</h2>
        <ul className="mt-3 space-y-2 text-[15px]">
          {exclusions.map((i) => (
            <li key={i} className="flex gap-2.5">
              <X className="mt-0.5 size-5 shrink-0 text-ink-3" aria-hidden /> {i}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

/** Shown for a package that is no longer offered, including on a saved or shared link. Existing bookings are unaffected. */
export function UnavailableTour() {
  return (
    <EmptyState
      title="This tour is not open for booking"
      body="The package is no longer offered, so it cannot be booked. If you already have a booking, it stays as agreed in My Trips."
      action={<LinkButton to="/app/explore">Explore other tours</LinkButton>}
    />
  )
}
