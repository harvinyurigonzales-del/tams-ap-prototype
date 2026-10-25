import { ArrowUpRight, CalendarDays, ChevronRight, CircleDollarSign, MapPin, MessageCircle, Search, SlidersHorizontal, Sparkles, Ticket, Users, X } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { availableMoods, departureInWindow } from '../../domain/moods'
import { recommendationRows, type RecItem, type RecRow } from '../../domain/recommend'
import { proposalExpired } from '../../domain/requests'
import { BALANCE_DUE_DAYS_BEFORE, DOWN_PAYMENT_RATE, money, payableOptions, promoFor } from '../../domain/rules'
import { DEMO_TODAY } from '../../lib/demoClock'
import { fmtDate, fmtTime, peso } from '../../lib/format'
import { useAssistant } from '../../state/assistant'
import { myRecords, useCustomer, useMe } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import type { Dataset, Service } from '../../seed/types'
import { LoopCarousel } from '../../ui/LoopCarousel'
import { Picture, srcSetOf } from '../../ui/Picture'
import { DestinationCard, destinationOf, pickupPlace, PriceTag, SaveButton, TourCard } from './Cards'
import { TRIP_DESK } from './Trips'

/**
 * Hero background photos: a broad tour of the catalog, north to south. They are decorative, so they carry no
 * caption or credit on screen; every photo is credited on the Photo credits page (source data in seed/photoData.ts).
 */
const HERO_SLIDES = ['DST-BANAUE', 'DST-VIGAN', 'DST-PAGUDPUD', 'DST-HUNDRED', 'DST-BAGUIO', 'DST-PINATUBO', 'DST-ZAMBALES', 'DST-INTRAMUROS', 'DST-TAGAYTAY', 'DST-BATANGAS']
/** Time each photo shows, and the crossfade between them. */
const SLIDE_MS = 2000
const FADE_MS = 1100
const FADE_EASE = 'cubic-bezier(0.4, 0, 0.2, 1)'
/** The destination given the large storytelling feature: a real photo and a scheduled joiner tour. */
const SPOTLIGHT_DESTINATION = 'DST-BAGUIO'

const tours = (d: Dataset) => d.services.filter((s) => s.type === 'tour')

export function Home() {
  const me = useMe()
  const { data, customerId, viewed, dismissed, dismiss, undoDismiss } = useCustomer()
  const toast = useUi((s) => s.toast)
  const mine = myRecords(data, customerId)
  const rows = recommendationRows(data, { customerId, prefs: mine.prefs, saved: mine.saved, viewed, dismissed })
  const hasPrefs = !!mine.prefs && (mine.prefs.interests.length > 0 || mine.prefs.budgetMax > 0)

  const notInterested = (i: RecItem, name: string) => {
    dismiss(i.kind, i.id)
    toast(`Hidden ${name} for this session.`, 'info', { label: 'Undo', run: () => undoDismiss(i.kind, i.id) })
  }

  return (
    <div>
      <Hero greeting={me ? `Hello, ${me.name.split(' ')[0]}` : undefined} />
      <div data-hero-hold className="relative z-10 mx-auto -mt-[92px] max-w-[1180px] px-4 sm:px-6 md:-mt-[52px]">
        <TripSearch />
      </div>

      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        {customerId && <NeedsAttention />}
        <Featured />
        <Moods />
      </div>

      <Spotlight />

      <div className="mx-auto max-w-[1180px] px-4 sm:px-6">
        <Reassurance />

        {customerId && !hasPrefs && (
          <div className="mt-14 flex flex-wrap items-center gap-3 rounded-[22px] bg-brand-50 px-5 py-4">
            <Sparkles className="size-5 text-brand-700" aria-hidden />
            <p className="flex-1 text-sm text-brand-900">Tell us what you like and the rows below will follow your answers.</p>
            <Link to="/app/preferences" className="text-sm font-semibold text-brand-700 hover:underline">
              Set travel preferences
            </Link>
          </div>
        )}

        {rows.map((row) => (
          <RecCarousel key={row.id} row={row} onDismiss={notInterested} />
        ))}

        <p className="mt-10 flex items-start gap-2 text-xs text-ink-3">
          <SlidersHorizontal className="mt-px size-3.5 shrink-0" aria-hidden />
          <span>
            Suggestions are based on your travel preferences, saved items, the trips you’ve viewed and your past trips.{' '}
            {customerId && (
              <Link to="/app/preferences" className="font-semibold text-brand-700 underline">
                Change preferences
              </Link>
            )}
          </span>
        </p>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ Hero */

function Hero({ greeting }: { greeting?: string }) {
  const data = useCustomer((s) => s.data)
  const slides = HERO_SLIDES.map((id) => data.destinations.find((x) => x.id === id)!).filter(Boolean)
  const [index, setIndex] = useState(0)
  // The photo being faded out stays fully visible underneath the one fading in, so the crossfade never dips.
  const [prev, setPrev] = useState(-1)
  // Paused while the tab is hidden or while keyboard focus is in the hero or the trip search. Focus leaving
  // (including a click on blank page, which fires no focusin) releases it, so the slideshow never stays stuck.
  // Reduced motion keeps the gentle crossfade (an opacity change, nothing moves) so the photos still change.
  const [held, setHeld] = useState(false)
  const [hidden, setHidden] = useState(() => typeof document !== 'undefined' && document.hidden)
  const [loaded, setLoaded] = useState<Set<number>>(() => new Set())
  // A photo that fails to load is skipped, so one broken file never freezes the slideshow.
  const [broken, setBroken] = useState<Set<number>>(() => new Set())
  const n = slides.length
  const step = (from: number, dir: 1 | -1) => {
    for (let k = 1; k <= n; k++) {
      const i = (from + dir * k + n) % n
      if (!broken.has(i)) return i
    }
    return from
  }
  const next = step(index, 1)
  const running = !held && !hidden && n > 1
  const nextReady = loaded.has(next)

  useEffect(() => {
    const onVis = () => setHidden(document.hidden)
    const inHero = (el: Element | null) => !!el?.closest?.('[data-hero-hold]') && el.matches(':focus-visible')
    const onFocus = (e: FocusEvent) => setHeld(inHero(e.target as Element | null))
    const onBlur = () => setHeld(false)
    document.addEventListener('visibilitychange', onVis)
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onBlur)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onBlur)
    }
  }, [])
  useEffect(() => {
    // Change only once the next photo has loaded, so a slow network never fades to an empty frame.
    if (!running || !nextReady) return
    const t = window.setTimeout(() => {
      setPrev(index)
      setIndex(next)
    }, SLIDE_MS)
    return () => window.clearTimeout(t)
  }, [running, next, nextReady, index])

  // The photo on screen and the next two are in the page, so each one is loaded well before it shows.
  const mounted = (i: number) => i === index || i === next || i === step(next, 1) || i === prev || loaded.has(i)
  const first = slides[0]

  return (
    <section data-hero-hold className="relative isolate h-[min(92svh,860px)] min-h-[620px] overflow-hidden bg-charcoal text-white" aria-labelledby="hero-title">
      <div className="absolute inset-0 -z-10" aria-hidden data-slide={index}>
        {/* The first photo's tiny preview fills the frame until the photo itself arrives: no flash, no jump. */}
        {first?.image.lqip && !loaded.has(0) && (
          <img src={first.image.lqip} alt="" className="absolute inset-0 size-full scale-110 object-cover blur-xl" style={{ objectPosition: first.image.focus }} />
        )}
        {slides.map((dest, i) =>
          mounted(i) && !broken.has(i) ? (
            <img
              key={dest.id}
              src={dest.image.src}
              srcSet={srcSetOf(dest.image)}
              sizes="100vw"
              alt=""
              loading="eager"
              fetchPriority={i === 0 ? 'high' : 'low'}
              decoding="async"
              // Decoded before it counts as ready, so the fade never starts on a photo still being unpacked.
              onLoad={(e) =>
                e.currentTarget
                  .decode()
                  .catch(() => {})
                  .then(() => setLoaded((s) => (s.has(i) ? s : new Set(s).add(i))))
              }
              onError={() => setBroken((s) => (s.has(i) ? s : new Set(s).add(i)))}
              style={{
                objectPosition: dest.image.focus,
                willChange: 'opacity',
                transition: i === index ? `opacity ${FADE_MS}ms ${FADE_EASE}` : 'none',
              }}
              className={`absolute inset-0 size-full object-cover saturate-[0.92] ${
                i === index && loaded.has(i) ? 'z-[2] opacity-100' : i === prev ? 'z-[1] opacity-100' : 'opacity-0'
              }`}
            />
          ) : null,
        )}
      </div>
      {/* Two controlled washes keep the headline and navigation readable on every photo. */}
      <div className="absolute inset-x-0 top-0 -z-10 h-48 bg-gradient-to-b from-black/60 to-transparent" aria-hidden />
      <div className="absolute inset-0 -z-10 bg-gradient-to-t from-[#14110c]/92 via-[#14110c]/40 to-[#14110c]/5" aria-hidden />
      <div className="absolute inset-y-0 left-0 -z-10 w-full bg-gradient-to-r from-[#14110c]/45 to-transparent md:w-2/3" aria-hidden />

      <div className="mx-auto flex h-full max-w-[1280px] flex-col justify-end px-4 pb-[150px] sm:px-6 md:pb-[112px]">
        {greeting && <p className="tara-rise mb-3 text-sm font-semibold text-white/85">{greeting}</p>}
        <h1 id="hero-title" className="tara-rise type-hero max-w-[12ch] text-[50px] sm:text-[78px] lg:text-[104px]">
          Tara, alis muna tayo.
        </h1>
        <p className="tara-rise mt-5 max-w-md text-base text-white/88 [animation-delay:120ms] sm:text-lg">
          From quick day trips to Luzon getaways worth planning for, find your next trip with TAMS AP.
        </p>
        <div className="tara-rise mt-7 flex flex-wrap gap-3 [animation-delay:200ms]">
          <Link to="/app/explore" className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-semibold text-charcoal hover:bg-ivory">
            Explore tours
          </Link>
          <Link to="/app/custom/new" className="inline-flex h-12 items-center rounded-full px-6 text-[15px] font-semibold text-white ring-1 ring-white/70 hover:bg-white/10">
            Plan a group trip
          </Link>
        </div>
      </div>

    </section>
  )
}

/* ------------------------------------------------------------------ Search */

const field = 'flex min-w-0 flex-col gap-1 px-5 py-3 text-xs font-semibold text-ink-2'
const input = 'w-full min-w-0 bg-transparent text-[15px] font-medium text-ink focus:outline-none'

/**
 * Search that matches how trips are actually sold: joiner tours leave on set dates, so the date is the
 * earliest you can leave and the traveller count must fit the seats left. Results open on Explore.
 */
function TripSearch() {
  const data = useCustomer((s) => s.data)
  const navigate = useNavigate()
  const [dest, setDest] = useState('')
  const [from, setFrom] = useState('')
  const [pax, setPax] = useState('2')
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const p = new URLSearchParams({ view: 'tours' })
    if (dest) p.set('destination', dest)
    if (from) p.set('from', from)
    if (Number(pax) > 0) p.set('pax', pax)
    navigate(`/app/explore?${p}`)
  }
  return (
    <form
      role="search"
      aria-label="Find a trip"
      onSubmit={submit}
      className="grid overflow-hidden rounded-[26px] bg-surface shadow-pop ring-1 ring-black/5 md:grid-cols-[1.4fr_1fr_0.8fr_auto] md:items-stretch md:divide-x md:divide-line"
    >
      <label className={`${field} border-b border-line md:border-b-0`}>
        <span className="inline-flex items-center gap-1.5">
          <MapPin className="size-3.5" aria-hidden /> Destination
        </span>
        <select value={dest} onChange={(e) => setDest(e.target.value)} className={input}>
          <option value="">Anywhere in Luzon</option>
          {data.destinations.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}, {x.province}
            </option>
          ))}
        </select>
      </label>
      <label className={`${field} border-b border-line md:border-b-0`}>
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden /> Leaving on or after
        </span>
        <input type="date" value={from} min={DEMO_TODAY} onChange={(e) => setFrom(e.target.value)} className={input} />
      </label>
      <label className={`${field} border-b border-line md:border-b-0`}>
        <span className="inline-flex items-center gap-1.5">
          <Users className="size-3.5" aria-hidden /> Travelers
        </span>
        <select value={pax} onChange={(e) => setPax(e.target.value)} className={input}>
          {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
            <option key={n} value={n}>
              {n} {n === 1 ? 'traveler' : 'travelers'}
            </option>
          ))}
        </select>
      </label>
      <div className="p-3 md:p-2.5">
        <button type="submit" className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-600 px-7 text-[15px] font-semibold text-white hover:bg-brand-700 md:h-full">
          <Search className="size-4" aria-hidden /> Find a trip
        </button>
      </div>
    </form>
  )
}

/* ------------------------------------------------------------------ Featured trips */

/** Tours with a bookable departure, soonest first; the one on promo (if any) leads. */
function featuredTours(d: Dataset) {
  const list = tours(d)
    .map((s) => ({ s, next: departureInWindow(d, s.id) }))
    .filter((x) => x.next)
    .sort((a, b) => a.next!.dep.startDate.localeCompare(b.next!.dep.startDate))
  const promoIdx = list.findIndex((x) => x.next!.dep.promo && promoFor(x.next!.dep, DEMO_TODAY) > 0)
  if (promoIdx > 0) list.unshift(...list.splice(promoIdx, 1))
  return list.map((x) => x.s)
}

function Featured() {
  const data = useCustomer((s) => s.data)
  const list = featuredTours(data)
  if (!list.length) return null
  const [lead, ...rest] = list
  return (
    <section className="mt-16 md:mt-24" aria-labelledby="featured">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="featured" className="type-hero text-[36px] text-charcoal md:text-[52px]">
            Saan tayo next?
          </h2>
          <p className="mt-2 max-w-lg text-ink-2">Joiner tours with open seats, leaving from Quezon City. Prices are per person.</p>
        </div>
        <Link to="/app/explore" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
          See all tours <ArrowUpRight className="size-4" aria-hidden />
        </Link>
      </div>
      <FeatureTour service={lead} />
      {rest.length > 0 && (
        <ul className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {rest.slice(0, 3).map((s) => (
            <li key={s.id}>
              <TourCard service={s} />
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** The lead trip, given room: a wide photograph with the practical facts set beside it. */
function FeatureTour({ service: s }: { service: Service }) {
  const data = useCustomer((st) => st.data)
  const dest = destinationOf(data, s)
  const next = departureInWindow(data, s.id)!
  const off = promoFor(next.dep, DEMO_TODAY)
  return (
    <article className="group relative mt-8 grid overflow-hidden rounded-[28px] bg-surface ring-1 ring-line lg:grid-cols-[1.35fr_1fr]">
      <div className="relative">
        {dest && <Picture image={dest.image} sizes="(min-width: 1024px) 50vw, 100vw" className="aspect-[4/3] lg:aspect-auto lg:h-full" labelAt="bl" />}
        {off > 0 && (
          <span className="absolute top-4 left-4 rounded-full bg-sili px-3 py-1.5 text-xs font-semibold text-white">
            {next.dep.promo!.label}: {peso(off)} off, book by {fmtDate(next.dep.promo!.bookBy, { year: false })}
          </span>
        )}
        <SaveButton item={{ kind: 'tour', id: s.id }} name={s.name} className="absolute top-3.5 right-3.5 z-10" />
      </div>
      <div className="flex flex-col p-6 sm:p-8 lg:p-10">
        <p className="flex items-center gap-1.5 text-sm text-ink-2">
          <MapPin className="size-4" aria-hidden /> {s.destination}
        </p>
        <h3 className="mt-2 type-hero text-[32px] text-charcoal sm:text-[42px]">
          <Link to={`/app/tours/${s.id}`} className="after:absolute after:inset-0 focus-visible:outline-none group-focus-within:underline">
            {s.name}
          </Link>
        </h3>
        <p className="mt-3 text-ink-2">{s.summary}</p>
        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-4 text-sm">
          <Detail label="Length">{s.duration}</Detail>
          <Detail label="Arrangement">Joiner tour</Detail>
          <Detail label="Pickup">
            {pickupPlace(s)}, {fmtTime(s.pickupTime)}
          </Detail>
          <Detail label="Next departure">
            {fmtDate(next.dep.startDate, { weekday: true, year: false })}
            <span className={`block font-semibold ${next.avail.left <= 4 ? 'text-sili' : 'text-palay'}`}>{next.avail.left} seats left</span>
          </Detail>
        </dl>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-4 pt-8">
          <PriceTag price={s.price - off} was={off ? s.price : undefined} size="lg" />
          <Link
            to={`/app/tours/${s.id}/dates?d=${next.dep.id}`}
            className="relative z-10 inline-flex h-12 items-center rounded-full bg-sili px-6 text-[15px] font-semibold text-white hover:bg-sili-600"
            aria-label={`Book this date: ${s.name}, ${fmtDate(next.dep.startDate, { year: false })}`}
          >
            Book this date
          </Link>
        </div>
      </div>
    </article>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold text-ink-3">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{children}</dd>
    </div>
  )
}

/* ------------------------------------------------------------------ Moods */

function Moods() {
  const data = useCustomer((s) => s.data)
  const moods = availableMoods(data)
  if (!moods.length) return null
  return (
    <section className="mt-20" aria-labelledby="moods">
      <h2 id="moods" className="type-head text-[32px] text-charcoal md:text-[40px]">
        Anong trip ang trip mo?
      </h2>
      <p className="mt-1 text-ink-2">Browse by the kind of day you want. Each opens the matching tours.</p>
      <ul className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
        {moods.map(({ mood, count }) => (
          <li key={mood.id}>
            <Link
              to={`/app/explore?mood=${mood.id}`}
              className="flex h-full flex-col justify-between gap-6 rounded-[20px] bg-sand/80 p-4 ring-1 ring-transparent transition-colors hover:bg-sand hover:ring-sand-2"
            >
              <span>
                <span className="block type-head text-[19px] text-charcoal">{mood.label}</span>
                <span className="mt-1 block text-[13px] leading-snug text-ink-2">{mood.line}</span>
              </span>
              <span className="text-xs font-semibold text-brand-700">
                {count} {count === 1 ? 'tour' : 'tours'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

/* ------------------------------------------------------------------ Spotlight */

function Spotlight() {
  const data = useCustomer((s) => s.data)
  const dest = data.destinations.find((x) => x.id === SPOTLIGHT_DESTINATION)
  const tour = tours(data).find((s) => s.destinationId === SPOTLIGHT_DESTINATION)
  if (!dest || !tour) return null
  const next = departureInWindow(data, tour.id)
  // The route shows the package's own plan, so it is a real itinerary, not decoration.
  const stops = [
    { when: fmtTime(tour.pickupTime), what: `Pickup at ${pickupPlace(tour)}` },
    ...tour.itinerary.map((line) => {
      const i = line.indexOf(': ')
      return i > 0 ? { when: line.slice(0, i), what: line.slice(i + 2) } : { when: '', what: line }
    }),
  ]
  return (
    <section className="mt-24 md:mt-32" aria-labelledby="spotlight">
      <div className="mx-auto max-w-[1280px] px-4 sm:px-6">
        <div className="relative grid lg:grid-cols-12">
          <Picture image={dest.image} sizes="(min-width: 1024px) 66vw, 100vw" className="aspect-[4/3] rounded-[28px] lg:col-span-8 lg:col-start-1 lg:row-start-1 lg:aspect-auto lg:min-h-[640px]" labelAt="tl" />
          <div className="relative -mt-16 mx-3 rounded-[28px] bg-navy p-6 text-white shadow-pop sm:mx-8 sm:p-9 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:mx-0 lg:my-14 lg:self-center">
            <p className="text-sm font-semibold text-white/70">Konting layo, ibang mundo.</p>
            <h2 id="spotlight" className="mt-2 type-hero text-[46px] sm:text-[62px]">
              {dest.name}
            </h2>
            <p className="mt-3 text-white/85">{dest.overview}</p>
            <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-white/60">By van from Manila</dt>
                <dd className="font-semibold">{dest.travelTime}</dd>
              </div>
              <div>
                <dt className="text-white/60">Best months</dt>
                <dd className="font-semibold">{dest.bestMonths}</dd>
              </div>
            </dl>

            <div className="mt-7 border-t border-white/15 pt-6">
              <p className="text-sm font-semibold">{tour.name}</p>
              <ol className="mt-4 space-y-0">
                {stops.map((st, i) => (
                  <li key={st.what} className="relative flex gap-3 pb-4 last:pb-0">
                    {i < stops.length - 1 && <span className="route-line-y absolute top-4 bottom-0 left-[6px] w-0.5 text-white/35" aria-hidden />}
                    <span className={`relative mt-1 size-3.5 shrink-0 rounded-full ${i === 0 ? 'bg-sili' : 'border-2 border-white bg-navy'}`} aria-hidden />
                    <p className="text-sm text-white/85">
                      {st.when && <span className="mr-1.5 font-semibold text-white">{st.when}</span>}
                      {st.what}
                    </p>
                  </li>
                ))}
              </ol>
            </div>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Link to={`/app/tours/${tour.id}`} className="inline-flex h-12 items-center rounded-full bg-white px-6 text-[15px] font-semibold text-charcoal hover:bg-ivory">
                {next ? `See the tour, from ${peso(tour.price - promoFor(next.dep, DEMO_TODAY))}` : 'See the tour'}
              </Link>
              <Link to={`/app/destinations/${dest.id}`} className="text-sm font-semibold text-white underline-offset-4 hover:underline">
                About {dest.name}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ Practical reassurance */

function Reassurance() {
  const data = useCustomer((s) => s.data)
  const openWith = useAssistant((s) => s.openWith)
  const list = tours(data)
  const pickups = [...new Set(list.map((s) => s.pickup))]
  const times = list.map((s) => s.pickupTime).sort()
  const allVan = list.every((s) => s.inclusions.some((i) => /round-trip van/i.test(i)))
  return (
    <section className="mt-24" aria-labelledby="before-you-go">
      <h2 id="before-you-go" className="type-head text-[32px] text-charcoal md:text-[40px]">
        Bago ka mag-book
      </h2>
      <p className="mt-1 text-ink-2">The practical part, so there are no surprises on the day.</p>
      <ul className="mt-8 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
        <Assure icon={<MapPin className="size-5" aria-hidden />} title="Where we meet">
          {pickups.length === 1 ? `Joiner tours pick up at ${pickups[0]}` : `Pickup points: ${pickups.join('; ')}`}, between {fmtTime(times[0])} and {fmtTime(times.at(-1)!)} depending on the trip. Each
          tour page shows its exact time.
        </Assure>
        <Assure icon={<Ticket className="size-5" aria-hidden />} title="What’s included">
          {allVan ? 'Every joiner tour includes a round-trip van with driver and fuel. ' : ''}Meals, hotel nights and entrance fees differ by package, so each tour lists what’s in and what’s not.
        </Assure>
        <Assure icon={<CircleDollarSign className="size-5" aria-hidden />} title="How payment works">
          A {DOWN_PAYMENT_RATE * 100}% down payment by GCash, Maya or bank transfer holds your booking. Staff verify your receipt, then confirm. The balance is due {BALANCE_DUE_DAYS_BEFORE} days before you leave.
        </Assure>
        <Assure icon={<MessageCircle className="size-5" aria-hidden />} title="May tanong? Usap tayo.">
          <button onClick={() => openWith()} className="font-semibold text-brand-700 underline underline-offset-2">
            Open the help chat
          </button>{' '}
          for quick answers to common questions, or send staff a message from{' '}
          <Link to="/app/messages" className="font-semibold text-brand-700 underline underline-offset-2">
            Messages
          </Link>
          . Trip desk: {TRIP_DESK.mobile}.
        </Assure>
      </ul>
    </section>
  )
}

function Assure({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li>
      <span className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-full bg-sand text-brand-700">{icon}</span>
        <span className="route-line h-0.5 flex-1 text-sand-2" aria-hidden />
      </span>
      <h3 className="mt-4 type-head text-[22px] text-charcoal">{title}</h3>
      <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{children}</p>
    </li>
  )
}

/* ------------------------------------------------------------------ Needs attention */

/** Next actions across bookings and requests, so a waiting proposal or payment is not missed. */
function NeedsAttention() {
  const { data, customerId } = useCustomer()
  const mine = myRecords(data, customerId)
  const items: { to: string; title: string; body: string }[] = []
  for (const r of mine.customRequests) {
    if (r.status === 'Proposal ready' && r.proposal && !proposalExpired(r.proposal.validUntil))
      items.push({ to: `/app/custom/${r.id}`, title: 'Proposal ready to review', body: `${r.proposal.title}, ${peso(r.proposal.total)}, valid until ${fmtDate(r.proposal.validUntil, { year: false })}` })
  }
  for (const r of mine.rentalRequests) {
    if (r.status === 'Proposal ready' && r.quote && !proposalExpired(r.quote.validUntil))
      items.push({ to: `/app/rentals/${r.id}`, title: 'Van rental quote ready', body: `${r.dropoff}, ${peso(r.quote.total)}, valid until ${fmtDate(r.quote.validUntil, { year: false })}` })
  }
  for (const b of mine.bookings) {
    const opts = payableOptions(b, data.payments)
    if (b.status === 'Pending' && opts.length && money(b, data.payments).paid === 0)
      items.push({ to: `/app/trips/${b.id}`, title: 'Payment needed', body: `${b.label ?? data.services.find((s) => s.id === b.serviceId)?.name}, down payment ${peso(opts[0].amount)}` })
  }
  for (const q of mine.inquiries) {
    if (q.status === 'Staff replied') items.push({ to: `/app/messages/${q.id}`, title: 'Staff replied', body: q.subject })
  }
  if (!items.length) return null
  return (
    <section className="mt-10" aria-labelledby="attention">
      <h2 id="attention" className="mb-3 type-head text-[22px] text-charcoal">
        Needs your attention
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <li key={i.to} className="min-w-0">
            <Link to={i.to} className="flex items-center gap-3 rounded-[18px] bg-warn-bg px-5 py-4 ring-1 ring-warn/25 hover:ring-warn">
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

/* ------------------------------------------------------------------ Recommendation rows */

function RecCarousel({ row, onDismiss }: { row: RecRow; onDismiss: (i: RecItem, name: string) => void }) {
  const data = useCustomer((s) => s.data)
  return (
    <section className="mt-16" aria-labelledby={`row-${row.id}`}>
      <h2 id={`row-${row.id}`} className="mb-4 type-head text-[26px] text-charcoal md:text-[30px]">
        {row.title}
      </h2>
      <LoopCarousel
        label={row.title}
        items={row.items}
        itemKey={(i) => `${i.kind}:${i.id}`}
        renderItem={(i) => {
          const name = i.kind === 'tour' ? data.services.find((s) => s.id === i.id)!.name : data.destinations.find((x) => x.id === i.id)!.name
          const footer = (
            <button onClick={() => onDismiss(i, name)} className="inline-flex items-center gap-1 text-xs font-medium text-ink-3 hover:text-ink">
              <X className="size-3.5" aria-hidden /> Not interested
            </button>
          )
          return i.kind === 'tour' ? (
            <TourCard service={data.services.find((s) => s.id === i.id)!} reason={i.reason} footer={footer} />
          ) : (
            <DestinationCard dest={data.destinations.find((x) => x.id === i.id)!} reason={i.reason} footer={footer} />
          )
        }}
      />
    </section>
  )
}
