import { resetDemoClock } from '../lib/demoClock'
import { MARIA_ID, removeCustomerRecords } from '../seed/derive'
import { canonical } from '../seed/canonical'
import { useAdmin } from './adminStore'
import { useAssistant } from './assistant'
import { useChatbot } from './chatbot'
import { useCustomer } from './customerStore'
import { clearSaved } from './persist'
import { usePlanner } from './planner'
import { useUi } from './ui'

/** Every record goes back to the sample data and everyone in this tab is logged out. */
export function resetAll() {
  clearSaved()
  resetDemoClock()
  useCustomer.getState().reset()
  // The admin store shares the customer's fresh records through sync; reset it for its own state too.
  const data = useCustomer.getState().data
  useAdmin.getState().reset()
  useAdmin.setState({ data })
  useChatbot.getState().reset()
  usePlanner.getState().clear()
  useAssistant.getState().close()
  useUi.setState({ toasts: [] })
}

/**
 * Clears Maria's journey: her bookings with their payments and van assignments, requests, reviews, messages,
 * notifications, saved trips and preferences. Her profile and login stay, and nobody else's records change.
 */
export function resetMaria() {
  const data = structuredClone(useAdmin.getState().data)
  removeCustomerRecords(data, MARIA_ID)
  const seed = canonical.customers.find((c) => c.id === MARIA_ID)!
  const me = data.customers.find((c) => c.id === MARIA_ID)
  if (me) Object.assign(me, { name: seed.name, mobile: seed.mobile, city: seed.city })
  useAdmin.setState({ data })
  if (useCustomer.getState().customerId === MARIA_ID) useCustomer.setState({ drafts: {}, checklist: {}, chat: [], viewed: [], dismissed: [] })
  usePlanner.getState().clear()
  useAssistant.getState().close()
}
