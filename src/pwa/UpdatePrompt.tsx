import { RefreshCw, WifiOff, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

/** Service worker registration. A new version waits until the presenter chooses to reload, so a demo is never interrupted. */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()
  const online = useOnline()
  useEffect(() => {
    if (!offlineReady) return
    const t = setTimeout(() => setOfflineReady(false), 5000)
    return () => clearTimeout(t)
  }, [offlineReady, setOfflineReady])

  if (!needRefresh && !offlineReady && online) return null
  return (
    <div className="fixed inset-x-0 top-2 z-50 flex flex-col items-center gap-2 px-4">
      {!online && (
        <div role="status" className="flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-xs font-medium text-white shadow-pop">
          <WifiOff className="size-4" aria-hidden /> You are offline. The demo keeps working with sample data.
        </div>
      )}
      {needRefresh && (
        <div role="alert" className="flex w-full max-w-md items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm shadow-pop ring-1 ring-line">
          <RefreshCw className="size-5 shrink-0 text-brand-600" aria-hidden />
          <span className="flex-1">A new version is ready. Reloading resets the demo data.</span>
          <button className="font-semibold text-brand-700 hover:underline" onClick={() => updateServiceWorker(true)}>
            Reload
          </button>
          <button aria-label="Later" className="text-ink-3" onClick={() => setNeedRefresh(false)}>
            <X className="size-4" />
          </button>
        </div>
      )}
      {offlineReady && !needRefresh && (
        <div role="status" className="flex w-full max-w-md items-center gap-3 rounded-xl bg-surface px-4 py-3 text-sm shadow-pop ring-1 ring-line">
          <span className="flex-1">Ready to work offline.</span>
          <button aria-label="Dismiss" className="text-ink-3" onClick={() => setOfflineReady(false)}>
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}

function useOnline() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
