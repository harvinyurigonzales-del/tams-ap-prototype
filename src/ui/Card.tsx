import type { HTMLAttributes, ReactNode } from 'react'

export function Card({ className = '', children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={`rounded-2xl border border-line bg-surface shadow-card ${className}`} {...rest}>
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="font-display text-lg font-semibold text-brand-900">{children}</h2>
      {action}
    </div>
  )
}

export function Row({ label, children, strong }: { label: ReactNode; children: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 text-sm ${strong ? 'font-semibold text-ink' : 'text-ink-2'}`}>
      <span>{label}</span>
      <span className={`tnum text-right ${strong ? '' : 'text-ink'}`}>{children}</span>
    </div>
  )
}
