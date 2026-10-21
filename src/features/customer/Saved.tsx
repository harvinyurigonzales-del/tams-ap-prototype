import { Heart } from 'lucide-react'
import { myRecords, useCustomer } from '../../state/customerStore'
import { LinkButton } from '../../ui/Button'
import { Card } from '../../ui/Card'
import { EmptyState } from '../../ui/EmptyState'
import { DestinationCard, TourCard } from './Cards'

export function Saved() {
  const { data, customerId } = useCustomer()
  const saved = myRecords(data, customerId).saved
  const tours = saved.filter((x) => x.kind === 'tour').map((x) => data.services.find((s) => s.id === x.id)).filter((s) => !!s)
  const dests = saved.filter((x) => x.kind === 'destination').map((x) => data.destinations.find((d) => d.id === x.id)).filter((d) => !!d)
  return (
    <div>
      <h1 className="font-display text-2xl font-bold text-brand-900">Saved</h1>
      <p className="mt-1 text-sm text-ink-2">Tours and destinations you saved in this demo session.</p>
      {saved.length === 0 ? (
        <Card className="mt-5">
          <EmptyState
            icon={<Heart className="size-6" aria-hidden />}
            title="Nothing saved yet"
            body="Tap the heart on a tour or destination to keep it here."
            action={<LinkButton to="/app/destinations">Browse destinations</LinkButton>}
          />
        </Card>
      ) : (
        <>
          {tours.length > 0 && (
            <section className="mt-6" aria-labelledby="saved-tours">
              <h2 id="saved-tours" className="mb-3 font-display text-lg font-semibold text-brand-900">
                Tours <span className="text-ink-3 tnum">{tours.length}</span>
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {tours.map((s) => (
                  <li key={s.id}>
                    <TourCard service={s} />
                  </li>
                ))}
              </ul>
            </section>
          )}
          {dests.length > 0 && (
            <section className="mt-6" aria-labelledby="saved-dests">
              <h2 id="saved-dests" className="mb-3 font-display text-lg font-semibold text-brand-900">
                Destinations <span className="text-ink-3 tnum">{dests.length}</span>
              </h2>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {dests.map((d) => (
                  <li key={d.id}>
                    <DestinationCard dest={d} />
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
