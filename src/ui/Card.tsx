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

/** Stand-in for a destination photo: no real photos are bundled, so a gradient with the place name is shown. */
export function PhotoPlaceholder({ tint, label, className = '' }: { tint: [string, string]; label: string; className?: string }) {
  return (
    <div
      role="img"
      aria-label={`${label} (photo placeholder)`}
      className={`relative overflow-hidden ${className}`}
      style={{ background: `linear-gradient(135deg, ${tint[0]}, ${tint[1]})` }}
    >
      <svg className="absolute inset-x-0 bottom-0 h-1/2 w-full text-white/15" viewBox="0 0 200 60" preserveAspectRatio="none" aria-hidden>
        <path d="M0 60 L0 38 L35 14 L60 32 L95 4 L130 34 L160 18 L200 40 L200 60 Z" fill="currentColor" />
      </svg>
      <span className="absolute bottom-2 left-3 text-[11px] font-medium text-white/85">{label} · photo placeholder</span>
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
