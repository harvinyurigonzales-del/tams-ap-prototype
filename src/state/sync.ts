import { useAdmin } from './adminStore'
import { useChatbot } from './chatbot'
import { useCustomer } from './customerStore'
import { deadlinesPending, runDeadlines } from '../domain/paymentPolicy'
import { DATA_VERSION } from './migrate'
import { DATA_KEY, parseSaved, writeSaved, type Saved } from './persist'

// Keeps the customer site, the staff portal, the saved copy and other open tabs on the same records.
// Both stores hold the same `data` object: whichever one changes it, the other is handed the new object,
// and the result is written to localStorage. A change written by another tab arrives through `storage`.

let applying = false
let queued = false

function snapshot(): Saved {
  const a = useAdmin.getState()
  return {
    v: DATA_VERSION,
    data: a.data,
    maintenance: a.maintenance,
    staffAccounts: a.accounts,
    settings: a.settings,
    customerAccounts: useCustomer.getState().accounts,
    presets: useChatbot.getState().presets,
  }
}

function save() {
  if (queued) return
  queued = true
  // Several changes in one action are written once.
  queueMicrotask(() => {
    queued = false
    writeSaved(snapshot())
  })
}

/**
 * Applies the payment-deadline policy to the shared records. Runs when the app loads and after every change, so
 * reminders, overdue notices and automatic cancellations happen while the app is open; it is not a background job.
 */
export function applyDeadlines() {
  const d = useAdmin.getState().data
  if (!deadlinesPending(d)) return
  const next = structuredClone(d)
  runDeadlines(next)
  useAdmin.setState({ data: next })
}

let started = false

/** Starts syncing. Safe to call more than once. */
export function startSync() {
  if (started) return
  started = true
  useCustomer.subscribe((s, p) => {
    if (applying) return
    if (s.data !== p.data) {
      applying = true
      useAdmin.setState({ data: s.data })
      applying = false
    }
    if (s.data !== p.data || s.accounts !== p.accounts) save()
    if (s.data !== p.data) queueMicrotask(applyDeadlines)
  })
  useAdmin.subscribe((s, p) => {
    if (applying) return
    if (s.data !== p.data) {
      applying = true
      useCustomer.setState({ data: s.data })
      applying = false
    }
    if (s.data !== p.data || s.maintenance !== p.maintenance || s.accounts !== p.accounts || s.settings !== p.settings) save()
    if (s.data !== p.data) queueMicrotask(applyDeadlines)
  })
  useChatbot.subscribe((s, p) => {
    if (!applying && s.presets !== p.presets) save()
  })

  if (typeof window !== 'undefined') window.addEventListener('storage', (e) => {
    if (e.key !== DATA_KEY) return
    const next = parseSaved(e.newValue)
    if (!next) return
    applying = true
    useCustomer.setState({ data: next.data, ...(next.customerAccounts ? { accounts: next.customerAccounts } : {}) })
    useAdmin.setState({
      data: next.data,
      maintenance: next.maintenance,
      ...(next.staffAccounts ? { accounts: next.staffAccounts as ReturnType<typeof useAdmin.getState>['accounts'] } : {}),
      ...(next.settings ? { settings: next.settings as ReturnType<typeof useAdmin.getState>['settings'] } : {}),
    })
    if (next.presets) useChatbot.setState({ presets: next.presets })
    applying = false
  })

  // The first visit saves the fresh seed right away, so every tab starts from the same records.
  applyDeadlines()
  save()
}
