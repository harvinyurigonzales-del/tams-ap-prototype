import { resetDemoClock } from '../lib/demoClock'
import { useAdmin } from './adminStore'
import { useChatbot } from './chatbot'
import { useCustomer } from './customerStore'
import { usePlanner } from './planner'
import { useUi } from './ui'

/** Reset Demo: both simulations go back to the canonical seed and both sessions are logged out. */
export function resetAll() {
  useCustomer.getState().reset()
  useAdmin.getState().reset()
  useChatbot.getState().reset()
  usePlanner.getState().clear()
  resetDemoClock()
  useUi.setState({ toasts: [] })
}
