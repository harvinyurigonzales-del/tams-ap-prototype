import { Clock, Heart, MapPin } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { bookableDeparture, fromPrice } from '../../domain/recommend'
import { fmtDate, peso } from '../../lib/format'
import { useCustomer } from '../../state/customerStore'
import { useUi } from '../../state/ui'
import type { Dataset, Destination, SavedItem, Service } from '../../seed/types'
import { Picture } from '../../ui/Picture'

export const destinationOf = (d: Dataset, s: Service) => d.destinations.find((x) => x.id === s.destinationId)

/** Heart toggle. Guests are sent to log in, and the save is applied when they come back. */
export function SaveButton({ item, name, className = '', withLabel = false }: { item: SavedItem; name: string; className?: string; withLabel?: boolean }) {
  const { customerId, data, toggleSaved, setPendingSave } = useCustomer()
  const toast = useUi((s) => s.toast)
  const navigate = useNavigate()
  const loc = useLocation()
  const saved = !!customerId && (data.saved[customerId] ?? []).some((x) => x.kind === item.kind && x.id === item.id)
  const onClick = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!customerId) {
      setPendingSave(item)
      navigate(`/app/login?next=${encodeURIComponent(loc.pathname + loc.search)}`)
      return
    }
    const r = toggleSaved(item)
    if (r.ok) toast(r.value ? `Saved ${name}.` : `Removed ${name} from Saved.`)
  }
  return (
    <button
      onClick={onClick}
      aria-pressed={saved}
      aria-label={withLabel ? undefined : saved ? `Remove ${name} from Saved` : `Save ${name}`}
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ${withLabel ? 'h-10 border border-line-strong bg-surface px-4 text-sm text-ink hover:bg-brand-50' : 'size-9 justify-center bg-white/90 text-ink shadow-card hover:bg-white'} ${className}`}
    >
      <Heart className={`size-[18px] ${saved ? 'fill-brand-600 text-brand-600' : ''}`} aria-hidden />
      {withLabel && (saved ? 'Saved' : 'Save')}
    </button>
  )
}

export function TourCard({ service: s, reason, footer }: { service: Service; reason?: string; footer?: React.ReactNode }) {
  const data = useCustomer((st) => st.data)
  const dest = destinationOf(data, s)
  const next = bookableDeparture(data, s.id)
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition hover:shadow-pop">
      <div className="relative">
        {dest ? <Picture image={dest.image} className="h-36" /> : <div className="h-36 bg-brand-100" />}
        <SaveButton item={{ kind: 'tour', id: s.id }} name={s.name} className="absolute top-2 right-2 z-10" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold text-ink group-hover:text-brand-700">
          <Link to={`/app/tours/${s.id}`} className="after:absolute after:inset-0">
            {s.name}
          </Link>
        </h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
          <MapPin className="size-3.5" aria-hidden /> {s.destination} · {s.duration}
        </p>
        {reason && <p className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-800">{reason}</p>}
        <div className="mt-auto flex items-end justify-between gap-2 pt-3">
          <p className="text-sm">
            <span className="font-display text-lg font-bold text-brand-700 tnum">{peso(next ? fromPrice(data, s) : s.price)}</span>
            <span className="text-ink-2">/person</span>
          </p>
          <p className={`text-right text-xs font-medium ${next ? 'text-ink-2' : 'text-ink-3'}`}>
            {next ? `${fmtDate(next.dep.startDate, { year: false })} · ${next.avail.left} slots remaining` : 'No open dates'}
          </p>
        </div>
        {footer && <div className="relative z-10 mt-3">{footer}</div>}
      </div>
    </article>
  )
}

export function DestinationCard({ dest, reason, footer }: { dest: Destination; reason?: string; footer?: React.ReactNode }) {
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-surface shadow-card transition hover:shadow-pop">
      <div className="relative">
        <Picture image={dest.image} className="h-36" />
        <SaveButton item={{ kind: 'destination', id: dest.id }} name={dest.name} className="absolute top-2 right-2 z-10" />
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="font-display text-base font-semibold text-ink group-hover:text-brand-700">
          <Link to={`/app/destinations/${dest.id}`} className="after:absolute after:inset-0">
            {dest.name}
          </Link>
        </h3>
        <p className="mt-0.5 flex items-center gap-1 text-xs text-ink-2">
          <MapPin className="size-3.5" aria-hidden /> {dest.province}
          <span aria-hidden>·</span>
          <Clock className="size-3.5" aria-hidden /> {dest.travelTime}
        </p>
        <p className="mt-2 text-sm text-ink-2">{dest.summary}</p>
        {reason && <p className="mt-2 rounded-lg bg-brand-50 px-2.5 py-1.5 text-xs font-medium text-brand-800">{reason}</p>}
        {footer && <div className="relative z-10 mt-auto pt-3">{footer}</div>}
      </div>
    </article>
  )
}
