import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { X } from 'lucide-react'
import { Button } from './Button'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}

/** Native <dialog> so focus trapping, Escape and the backdrop come from the browser. */
export function Dialog({ open, onClose, title, children, footer, wide }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`m-auto w-[calc(100%-2rem)] ${wide ? 'max-w-2xl' : 'max-w-md'} rounded-2xl bg-surface p-0 text-ink shadow-pop backdrop:bg-brand-900/40`}
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
            <h2 id={titleId} className="font-display text-lg font-semibold">{title}</h2>
            <button onClick={onClose} className="-mr-1 rounded-lg p-1 text-ink-2 hover:bg-surface-muted" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <div className="overflow-y-auto px-5 py-4 text-sm text-ink-2">{children}</div>
          {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

interface ConfirmProps {
  open: boolean
  onClose: () => void
  title: string
  body: ReactNode
  confirmLabel: string
  tone?: 'primary' | 'danger'
  /** Return an error string to keep the dialog open, or nothing to close it. */
  onConfirm: () => string | void | Promise<string | void>
  delay?: number
  children?: ReactNode
}

/** Confirmation dialog with an optional short simulated delay where a spinner reads as realistic. */
export function ConfirmDialog({ open, onClose, title, body, confirmLabel, tone = 'primary', onConfirm, delay = 0, children }: ConfirmProps) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setBusy(false)
      setError('')
    }
  }, [open])
  const run = async () => {
    setBusy(true)
    if (delay) await new Promise((r) => setTimeout(r, delay))
    const err = await onConfirm()
    setBusy(false)
    if (err) setError(err)
    else onClose()
  }
  return (
    <Dialog
      open={open}
      onClose={busy ? () => {} : onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button variant={tone} onClick={run} loading={busy}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div>{body}</div>
        {children}
        {error && (
          <p role="alert" className="rounded-lg bg-bad-bg px-3 py-2 text-sm font-medium text-bad">
            {error}
          </p>
        )}
      </div>
    </Dialog>
  )
}
