// Replaceable logo placeholder (spec section 8). No official TAMS AP logo is used or invented.
// To use the real logo, replace this component and the files in public/icons.
export function BrandMark({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5" aria-label="TAMS AP Travel and Tours">
      <span
        aria-hidden
        className={`grid size-9 shrink-0 place-items-center rounded-xl font-display text-sm font-bold ${inverse ? 'bg-white text-brand-700' : 'bg-brand-600 text-white'}`}
      >
        TA
      </span>
      {!compact && (
        <span className="flex flex-col leading-none" aria-hidden>
          <span className={`font-display text-base font-bold ${inverse ? 'text-white' : 'text-brand-900'}`}>TAMS AP</span>
          <span className={`mt-1 text-[11px] font-semibold tracking-[0.08em] ${inverse ? 'text-brand-100' : 'text-brand-600'}`}>TRAVEL AND TOURS</span>
        </span>
      )}
    </span>
  )
}
