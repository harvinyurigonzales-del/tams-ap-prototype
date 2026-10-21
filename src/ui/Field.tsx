import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'

const control =
  'w-full rounded-xl border bg-surface px-3.5 text-[15px] text-ink placeholder:text-ink-3 transition-colors hover:border-line-strong focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 disabled:bg-surface-muted'

interface Base {
  label: string
  error?: string
  hint?: ReactNode
  icon?: ReactNode
  trailing?: ReactNode
}

function Shell({ id, label, error, hint, children }: Base & { id: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-err`} className="mt-1.5 text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-ink-2">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export function TextField({ label, error, hint, icon, trailing, className = '', ...rest }: Base & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <Shell id={id} label={label} error={error} hint={hint}>
      <div className="relative">
        {icon && <span className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-3">{icon}</span>}
        <input
          id={id}
          aria-invalid={!!error || undefined}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          className={`${control} h-12 ${icon ? 'pl-10' : ''} ${trailing ? 'pr-12' : ''} ${error ? 'border-bad' : 'border-line'} ${className}`}
          {...rest}
        />
        {trailing && <span className="absolute top-1/2 right-2 -translate-y-1/2">{trailing}</span>}
      </div>
    </Shell>
  )
}

export function TextArea({ label, error, hint, className = '', ...rest }: Base & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <Shell id={id} label={label} error={error} hint={hint}>
      <textarea
        id={id}
        aria-invalid={!!error || undefined}
        className={`${control} min-h-24 py-3 ${error ? 'border-bad' : 'border-line'} ${className}`}
        {...rest}
      />
    </Shell>
  )
}

export function Select({ label, error, hint, children, className = '', ...rest }: Base & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <Shell id={id} label={label} error={error} hint={hint}>
      <select id={id} aria-invalid={!!error || undefined} className={`${control} h-12 ${error ? 'border-bad' : 'border-line'} ${className}`} {...rest}>
        {children}
      </select>
    </Shell>
  )
}

/** Small inline select for table filters (admin). */
export function FilterSelect({ label, className = '', children, ...rest }: { label: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="inline-flex items-center gap-2 text-sm text-ink-2">
      <span className="sr-only sm:not-sr-only">{label}</span>
      <select className={`h-9 rounded-lg border border-line bg-surface px-2.5 text-sm text-ink hover:border-line-strong ${className}`} {...rest}>
        {children}
      </select>
    </label>
  )
}
