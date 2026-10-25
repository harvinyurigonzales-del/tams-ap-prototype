import { CalendarRange, Clock, MapPin, MessageCircleQuestion, PencilRuler, Sun } from 'lucide-react'
import type { PhotoCredit } from '../../seed/types'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { catalogTours } from '../../domain/recommend'
import { useAssistant } from '../../state/assistant'
import { useCustomer } from '../../state/customerStore'
import { Button, LinkButton } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { Picture } from '../../ui/Picture'
import { SaveButton, TourCard } from './Cards'
import { BackLink } from './Explore'

export function DestinationDetails() {
  const { destinationId } = useParams()
  const data = useCustomer((s) => s.data)
  const markViewed = useCustomer((s) => s.markViewed)
  const openWith = useAssistant((s) => s.openWith)
  const dest = data.destinations.find((x) => x.id === destinationId)
  useEffect(() => {
    if (dest) markViewed('destination', dest.id)
  }, [dest, markViewed])
  if (!dest) return <EmptyState title="Destination not found" action={<LinkButton to="/app/explore?view=destinations">All destinations</LinkButton>} />
  const tours = catalogTours(data).filter((s) => s.destinationId === dest.id)

  return (
    <div>
      <BackLink to="/app/explore?view=destinations" label="Destinations" />
      <div className="relative">
        <Picture image={dest.image} eager sizes="(min-width: 1180px) 1132px, 100vw" className="aspect-[4/3] rounded-[28px] sm:aspect-[16/8] lg:aspect-[21/8]" labelAt="tr" />
        <div className="pointer-events-none absolute inset-0 rounded-[28px] bg-gradient-to-t from-black/75 via-black/15 to-transparent" aria-hidden />
        <div className="absolute inset-x-0 bottom-0 p-5 text-white sm:p-8">
          <p className="flex items-center gap-1 text-sm text-white/90">
            <MapPin className="size-4" aria-hidden /> {dest.province}
          </p>
          <h1 className="mt-1 type-hero text-[40px] sm:text-[60px] lg:text-[80px]">{dest.name}</h1>
        </div>
      </div>
      {dest.image.credit && <PhotoCreditLine credit={dest.image.credit} />}
      <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <p className="max-w-2xl text-lg text-ink">{dest.summary}</p>
            <SaveButton item={{ kind: 'destination', id: dest.id }} name={dest.name} withLabel className="shrink-0" />
          </div>
          <p className="mt-4 max-w-2xl text-ink-2">{dest.overview}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Good for">
            {dest.interests.map((i) => (
              <li key={i} className="rounded-full bg-surface-muted px-2.5 py-1 text-xs font-medium text-ink-2">
                {i}
              </li>
            ))}
          </ul>
          <h2 className="mt-10 type-head text-[30px] text-charcoal">Highlights</h2>
          <ul className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
            {dest.highlights.map((h) => (
              <li key={h} className="flex items-center gap-3 border-b border-line pb-3 text-[15px]">
                <span className="size-2 shrink-0 rounded-full bg-sili" aria-hidden />
                {h}
              </li>
            ))}
          </ul>
          <h2 className="mt-10 type-head text-[30px] text-charcoal">Tours to {dest.name}</h2>
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
          <Card className="space-y-3 rounded-[22px] p-6 text-sm text-ink-2">
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

/** One-line attribution under a photo, linking to its source page and license. */
export function PhotoCreditLine({ credit }: { credit: PhotoCredit }) {
  return (
    <p className="mt-2 text-right text-xs text-ink-3">
      Photo: {credit.author},{' '}
      {credit.licenseUrl ? (
        <a href={credit.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-2">
          {credit.license}
        </a>
      ) : (
        credit.license
      )}
      {credit.source && (
        <>
          , via{' '}
          <a href={credit.source} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-ink-2">
            Wikimedia Commons
          </a>
        </>
      )}
    </p>
  )
}
