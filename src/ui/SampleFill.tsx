import { Eraser, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Button } from './Button'
import { ConfirmDialog } from './Dialog'

/**
 * Demo helper for long forms. Fills the form with sample answers only when pressed, never submits, and asks before
 * replacing anything the person already typed. Every filled value stays editable.
 */
export function SampleFill({
  dirty,
  onFill,
  onClear,
  label = 'Use sample data',
  what = 'sample answers',
  className = '',
}: {
  /** True when the form holds answers the person typed or chose. */
  dirty: boolean
  onFill: () => void
  onClear?: () => void
  label?: string
  what?: string
  className?: string
}) {
  const [ask, setAsk] = useState<'fill' | 'clear' | null>(null)
  return (
    <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-dashed border-line-strong bg-surface-muted/60 px-3.5 py-2.5 ${className}`}>
      <p className="min-w-0 flex-1 basis-56 text-xs text-ink-2">
        <span className="font-semibold text-ink">Demo helper.</span> Fills in {what} you can edit. Nothing is sent until you press the button at the end.
      </p>
      <div className="flex gap-1.5">
        <Button size="sm" variant="secondary" icon={<Sparkles className="size-4" aria-hidden />} onClick={() => (dirty ? setAsk('fill') : onFill())}>
          {label}
        </Button>
        {onClear && (
          <Button size="sm" variant="ghost" icon={<Eraser className="size-4" aria-hidden />} onClick={() => (dirty ? setAsk('clear') : onClear())} disabled={!dirty}>
            Clear
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={ask === 'fill'}
        onClose={() => setAsk(null)}
        title="Replace your answers?"
        body={`This replaces what you've entered with ${what}. You can still change every field before sending.`}
        confirmLabel="Replace with sample data"
        onConfirm={onFill}
      />
      <ConfirmDialog
        open={ask === 'clear'}
        onClose={() => setAsk(null)}
        title="Clear this form?"
        body="This removes what you've entered so you can start again."
        confirmLabel="Clear form"
        tone="danger"
        onConfirm={() => onClear?.()}
      />
    </div>
  )
}
