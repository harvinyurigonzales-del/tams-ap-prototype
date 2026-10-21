import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { useUi } from '../state/ui'

export function Toaster() {
  const { toasts, dismiss } = useUi()
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-50 flex flex-col items-center gap-2 px-4 md:bottom-6">
      {toasts.map((t) => (
        <div key={t.id} role="status" className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl bg-ink px-4 py-3 text-sm text-white shadow-pop">
          {t.tone === 'success' ? (
            <CheckCircle2 className="mt-px size-5 shrink-0 text-[#6EE7B7]" aria-hidden />
          ) : t.tone === 'error' ? (
            <XCircle className="mt-px size-5 shrink-0 text-[#FCA5A5]" aria-hidden />
          ) : (
            <Info className="mt-px size-5 shrink-0 text-brand-200" aria-hidden />
          )}
          <span className="flex-1">{t.text}</span>
          <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="-mr-1 rounded p-0.5 text-white/70 hover:text-white">
            <X className="size-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
