import { Info } from 'lucide-react'

export function DemoBanner({ side }: { side?: 'Customer demo' | 'Admin demo' }) {
  return (
    <div role="note" className="flex items-center justify-center gap-2 bg-brand-900 px-4 py-1.5 text-center text-xs font-medium text-brand-50">
      <Info className="size-3.5 shrink-0" aria-hidden />
      <span>
        Prototype · sample data only{side ? ` · ${side}` : ''} · changes are temporary
      </span>
    </div>
  )
}
