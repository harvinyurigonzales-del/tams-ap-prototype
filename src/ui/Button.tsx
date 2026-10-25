import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Link, type LinkProps } from 'react-router-dom'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent'
type Size = 'sm' | 'md' | 'lg'

const VARIANT: Record<Variant, string> = {
  primary: 'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-800 disabled:bg-brand-200 disabled:text-white',
  secondary: 'border border-line-strong bg-surface text-ink hover:border-brand-300 hover:bg-brand-50 disabled:text-ink-3 disabled:bg-surface-muted',
  ghost: 'text-brand-700 hover:bg-brand-50 disabled:text-ink-3',
  danger: 'bg-bad text-white hover:bg-[#912018] disabled:bg-bad-bg disabled:text-bad/60',
  accent: 'bg-sili text-white hover:bg-sili-600 disabled:bg-sili-50 disabled:text-sili/50',
}
const SIZE: Record<Size, string> = {
  sm: 'h-8 px-3 text-sm rounded-lg gap-1.5',
  md: 'h-10 px-4 text-sm rounded-xl gap-2',
  lg: 'h-12 px-5 text-base rounded-xl gap-2',
}

export const buttonClass = (variant: Variant = 'primary', size: Size = 'md', full = false) =>
  `inline-flex items-center justify-center font-semibold transition-colors disabled:cursor-not-allowed ${VARIANT[variant]} ${SIZE[size]} ${full ? 'w-full' : ''}`

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  full?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function Button({ variant = 'primary', size = 'md', full, loading, icon, children, className = '', disabled, type = 'button', ...rest }: Props) {
  return (
    <button type={type} className={`${buttonClass(variant, size, full)} ${className}`} disabled={disabled || loading} aria-busy={loading || undefined} {...rest}>
      {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
}

export function LinkButton({ variant = 'primary', size = 'md', full, className = '', ...rest }: LinkProps & { variant?: Variant; size?: Size; full?: boolean }) {
  return <Link className={`${buttonClass(variant, size, full)} ${className}`} {...rest} />
}

/** A disabled control must always say why (spec section 7). */
export function DisabledHint({ children, id }: { children: ReactNode; id?: string }) {
  return (
    <p id={id} className="mt-1.5 text-xs text-ink-2">
      {children}
    </p>
  )
}
