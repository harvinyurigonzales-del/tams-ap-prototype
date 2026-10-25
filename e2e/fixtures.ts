import { test as base } from '@playwright/test'

export { expect, type Page } from '@playwright/test'

/** Every journey runs on the seed's own date, so the dates and prices in the assertions stay fixed. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      ;(window as unknown as { __TAMS_TODAY__: string }).__TAMS_TODAY__ = '2026-10-08'
      // Journeys use the presenter shortcuts to play the staff side forward.
      sessionStorage.setItem('tams-presenter', '1')
    })
    await use(page)
  },
})

/** Signs in from the login page with one of the sample accounts listed under the form. */
export async function signInSample(page: import('@playwright/test').Page, label: 'Maria Santos' | 'Paolo Rivera' | 'Liza Manalo' | 'Admin') {
  await page.getByRole('button', { name: 'Sample accounts' }).click()
  await page.getByRole('list').filter({ has: page.getByRole('button', { name: /^Maria Santos/ }) }).getByRole('button', { name: new RegExp(`^${label}`) }).click()
}

const NAV_GROUPS: Record<string, string> = {
  Dashboard: 'Overview', Notifications: 'Overview',
  Bookings: 'Bookings and requests', Calendar: 'Bookings and requests', Requests: 'Bookings and requests',
  Customers: 'Bookings and requests', Inquiries: 'Bookings and requests', Reviews: 'Bookings and requests',
  Vehicles: 'Fleet and operations', Drivers: 'Fleet and operations', Maintenance: 'Fleet and operations', 'Tour packages': 'Fleet and operations',
  Payments: 'Finance and reports', Reports: 'Finance and reports',
  'Staff accounts': 'Administration', 'Manage chatbot': 'Administration', Settings: 'Administration',
}

/** Opens a staff portal page from the side navigation, expanding its group first when it is collapsed. */
export async function adminNav(page: import('@playwright/test').Page, label: string) {
  const nav = page.getByRole('navigation', { name: 'Admin' })
  const header = nav.getByRole('button', { name: new RegExp(`^${NAV_GROUPS[label]}`) })
  if ((await header.getAttribute('aria-expanded')) === 'false') await header.click()
  await nav.getByRole('link', { name: new RegExp(`^${label}`) }).click()
}
