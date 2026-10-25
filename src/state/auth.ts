import { useAdmin, DEMO_ADMIN, DEMO_STAFF } from './adminStore'
import { DEMO_CUSTOMER, NEW_CUSTOMER, useCustomer } from './customerStore'

// One login for everyone. The account's stored role decides where it goes: customers to the customer site,
// staff and admins to the staff portal. Nobody picks a role at login, and one tab holds one signed-in account.

export type Workspace = 'customer' | 'staff'

type Result = { ok: true; workspace: Workspace } | { ok: false; error: string }

export function signIn(email: string, password: string): Result {
  const key = email.trim().toLowerCase()
  const isStaff = useAdmin.getState().accounts.some((a) => a.email.toLowerCase() === key)
  if (isStaff) {
    const r = useAdmin.getState().login(email, password)
    if (!r.ok) return r
    if (useCustomer.getState().customerId) useCustomer.getState().logout()
    return { ok: true, workspace: 'staff' }
  }
  const r = useCustomer.getState().login(email, password)
  if (!r.ok) return r
  if (useAdmin.getState().loggedIn) useAdmin.getState().logout()
  return { ok: true, workspace: 'customer' }
}

export function signOut() {
  useCustomer.getState().logout()
  useAdmin.getState().logout()
}

/** Who is signed in on this tab, if anyone. */
export function useWorkspace(): Workspace | null {
  const customer = useCustomer((s) => !!s.customerId)
  const staff = useAdmin((s) => s.loggedIn)
  return staff ? 'staff' : customer ? 'customer' : null
}

/** Customer tabs a guest is bounced from; logging in from one of them starts on Home instead. */
const TAB_PAGES = ['/app/trips', '/app/account', '/app/saved', '/app/messages', '/app/notifications', '/app/preferences']

/**
 * Where to go after login. Customers go back into a task they started (a booking, a trip plan, a request) or to
 * Home. Staff go to the dashboard, or to a specific record they followed a link to.
 */
export function destinationFor(workspace: Workspace, next: string | null): string {
  if (workspace === 'staff') return next?.startsWith('/admin') && next.includes('?') ? next : '/admin'
  if (!next || !next.startsWith('/app') || /^\/app\/(login|signup|forgot)/.test(next)) return '/app'
  return TAB_PAGES.includes(next.replace(/\/$/, '')) ? '/app' : next
}

export const workspaceHome = (w: Workspace) => (w === 'staff' ? '/admin' : '/app')

/** Sample accounts for trying the prototype, shown in a small section under the login form. */
export const SAMPLE_ACCOUNTS = [
  { label: 'Maria Santos', role: 'Customer', ...DEMO_CUSTOMER },
  { label: 'Paolo Rivera', role: 'New customer', ...NEW_CUSTOMER },
  { label: 'Liza Manalo', role: 'Staff', email: DEMO_STAFF.email, password: DEMO_STAFF.password },
  { label: 'Admin', role: 'Admin', email: DEMO_ADMIN.email, password: DEMO_ADMIN.password },
]
