import { Compass } from 'lucide-react'
import { LinkButton } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'

export function NotFound({ home = '/', homeLabel = 'Back to start' }: { home?: string; homeLabel?: string }) {
  return (
    <div className="grid min-h-[60vh] place-items-center px-4">
      <EmptyState
        icon={<Compass className="size-6" aria-hidden />}
        title="Page not found"
        body="We couldn’t find this page."
        action={<LinkButton to={home}>{homeLabel}</LinkButton>}
      />
    </div>
  )
}
