// TAMS AP logo, Concept A ("Heritage, Refined"). Files live in public/brand; the app icons in public/icons
// are rendered from the same artwork by `npm run icons`.
export function BrandMark({ compact = false, inverse = false, className = '' }: { compact?: boolean; inverse?: boolean; className?: string }) {
  if (compact) return <img src="/brand/tams-symbol.svg" alt="TAMS AP Travel and Tours" className={`${/(^|\s)h-/.test(className) ? '' : 'h-9'} w-auto ${className}`} />
  return (
    <img
      src={inverse ? '/brand/tams-horizontal-white.svg' : '/brand/tams-horizontal.svg'}
      alt="TAMS AP Travel and Tours"
      width={883}
      height={269}
      className={`${/(^|\s)h-/.test(className) ? '' : 'h-11'} w-auto ${className}`}
    />
  )
}
