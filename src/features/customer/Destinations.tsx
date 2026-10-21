import { CalendarRange, Clock, MapPin, MessageCircleQuestion, PencilRuler, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { catalogTours } from '../../domain/recommend'
import { useAssistant } from '../../state/assistant'
import { useCustomer } from '../../state/customerStore'
import { INTERESTS, type Interest } from '../../seed/types'
import { Button, LinkButton } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { Picture } from '../../ui/Picture'
import { DestinationCard, SaveButton, TourCard } from './Cards'
import { BackLink } from './Explore'

export function DestinationList() {
  const data = useCustomer((s) => s.data)
  const [interest, setInterest] = useState<Interest | ''>('')
  const list = data.destinations.filter((x) => !interest || x.interests.includes(interest))
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-900">Destinations</h1>
      <p className="mt-1 text-sm text-ink-2">Places we travel to in Luzon. Join a tour where one runs, or plan a custom trip anywhere on this list.</p>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Filter by interest">
        {(['', ...INTERESTS] as (Interest | '')[]).map((i) => (
          <button
            key={i || 'all'}
            aria-pressed={interest === i}
            onClick={() => setInterest(i)}
            className={`h-9 shrink-0 rounded-full px-4 text-sm font-semibold ${interest === i ? 'bg-brand-600 text-white' : 'border border-line bg-surface text-ink-2 hover:border-brand-300'}`}
          >
            {i || 'All'}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Card className="mt-5">
          <EmptyState title="No destinations for this interest yet" />
        </Card>
      ) : (
        <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((x) => (
            <li key={x.id}>
              <DestinationCard dest={x} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function DestinationDetails() {
  const { destinationId } = useParams()
  const data = useCustomer((s) => s.data)
  const markViewed = useCustomer((s) => s.markViewed)
  const openWith = useAssistant((s) => s.openWith)
  const dest = data.destinations.find((x) => x.id === destinationId)
  useEffect(() => {
    if (dest) markViewed('destination', dest.id)
  }, [dest, markViewed])
  if (!dest) return <EmptyState title="Destination not found" action={<LinkButton to="/app/destinations">All destinations</LinkButton>} />
  const tours = catalogTours(data).filter((s) => s.destinationId === dest.id)

  return (
    <div>
      <BackLink to="/app/destinations" label="Destinations" />
      <Picture image={dest.image} className="h-56 rounded-3xl md:h-80" />
      <div className="mt-5 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="font-display text-[28px] leading-tight font-bold text-brand-900">{dest.name}</h1>
              <p className="mt-1 flex items-center gap-1 text-sm text-ink-2">
                <MapPin className="size-4" aria-hidden /> {dest.province}
              </p>
            </div>
            <SaveButton item={{ kind: 'destination', id: dest.id }} name={dest.name} withLabel className="shrink-0" />
          </div>
          <p className="mt-4 text-ink">{dest.overview}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Good for">
            {dest.interests.map((i) => (
              <li key={i} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-2">
                {i}
              </li>
            ))}
          </ul>
          <h2 className="mt-6 font-display text-lg font-semibold text-brand-900">Highlights</h2>
          <ul className="mt-2 grid gap-2 sm:grid-cols-2">
            {dest.highlights.map((h) => (
              <li key={h} className="rounded-xl bg-surface px-4 py-3 text-sm shadow-card ring-1 ring-line">
                {h}
              </li>
            ))}
          </ul>
          <h2 className="mt-8 font-display text-lg font-semibold text-brand-900">Tours to {dest.name}</h2>
          {tours.length === 0 ? (
            <p className="mt-2 text-sm text-ink-2">No joiner tour runs here yet. Plan a custom trip and staff will put one together.</p>
          ) : (
            <ul className="mt-3 grid gap-4 sm:grid-cols-2">
              {tours.map((s) => (
                <li key={s.id}>
                  <TourCard service={s} />
                </li>
              ))}
            </ul>
          )}
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <Card className="space-y-3 p-5 text-sm text-ink-2">
            <p className="flex items-start gap-2">
              <Sun className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Best months: {dest.bestMonths}
            </p>
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Travel time from Manila: {dest.travelTime} by van
            </p>
            <p className="flex items-start gap-2">
              <CalendarRange className="mt-0.5 size-4 shrink-0 text-brand-600" aria-hidden /> Suggested stay: {dest.suggestedDays === 1 ? 'a day trip' : `${dest.suggestedDays} days`}
            </p>
            <div className="grid gap-2 pt-2">
              <LinkButton to={`/app/custom/new?destination=${dest.id}`} size="lg" full>
                <PencilRuler className="size-5" aria-hidden /> Plan a custom trip here
              </LinkButton>
              <Button variant="ghost" full icon={<MessageCircleQuestion className="size-4" aria-hidden />} onClick={() => openWith({ kind: 'destination', id: dest.id })}>
                Ask about {dest.name}
              </Button>
            </div>
          </Card>
        </aside>
      </div>
    </div>
  )
}
