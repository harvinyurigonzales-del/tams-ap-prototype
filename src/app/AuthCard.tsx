import type { ReactNode } from 'react'
import { BrandMark } from '../ui/BrandMark'

/** Shared login layout: phone-first card for customers, centred desktop card for admin. */
export function AuthCard({ title, subtitle, children, footer }: { title: string; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-md px-5 py-8 sm:py-14">
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-card sm:p-8">
        <BrandMark />
        <h1 className="mt-7 font-display text-[28px] leading-tight font-bold text-brand-900">{title}</h1>
        {subtitle && <p className="mt-1.5 text-sm text-ink-2">{subtitle}</p>}
        <div className="mt-6">{children}</div>
      </div>
      {footer && <div className="mt-5 text-center text-sm text-ink-2">{footer}</div>}
    </div>
  )
}
