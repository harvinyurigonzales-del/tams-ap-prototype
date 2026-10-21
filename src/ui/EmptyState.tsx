import type { ReactNode } from 'react'
import { Inbox } from 'lucide-react'

export function EmptyState({ title, body, icon, action }: { title: string; body?: ReactNode; icon?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon ?? <Inbox className="size-6" aria-hidden />}</div>
      <p className="font-display text-base font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-2">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
