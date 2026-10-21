import { resetDemoClock } from '../lib/demoClock'
import { useAdmin } from './adminStore'
import { useCustomer } from './customerStore'
import { useUi } from './ui'

/** Reset Demo: both simulations go back to the canonical seed and both sessions are logged out. */
export function resetAll() {
  useCustomer.getState().reset()
  useAdmin.getState().reset()
  resetDemoClock()
  useUi.setState({ toasts: [] })
}
