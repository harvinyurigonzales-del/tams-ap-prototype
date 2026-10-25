import { adminNav, expect, test, type Page, signInSample } from './fixtures'

const nav = (page: Page) => page.getByRole('navigation', { name: 'Admin' })

test('staff do not see admin-only modules, and a direct link shows the lock screen', async ({ page }) => {
  await page.goto('/admin/reports')
  await signInSample(page, 'Liza Manalo')
  // Login starts on the dashboard; the admin-only link then shows the lock screen.
  await expect(page.getByRole('heading', { name: 'Magandang umaga, Liza' })).toBeVisible()
  await page.goto('/admin/reports')
  await expect(page.getByRole('heading', { name: 'Admin only' })).toBeVisible()
  for (const name of ['Reports', 'Tour packages', 'Staff accounts', 'Manage chatbot']) await expect(nav(page).getByRole('link', { name })).toHaveCount(0)
  await expect(page.getByRole('link', { name: /Account settings, Liza Manalo \(Staff\)/ })).toBeVisible()

  // Fleet and maintenance are view only for staff.
  await adminNav(page, 'Vehicles')
  await expect(page.getByRole('button', { name: 'Add van' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Van 03 details' }).click()
  await expect(page.getByRole('complementary', { name: 'Van 03 details' }).getByText(/View only/)).toBeVisible()
  await adminNav(page, 'Maintenance')
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Schedule maintenance' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Mark done' })).toHaveCount(0)

  // The avatar opens Account settings; General is read-only for staff.
  await page.getByRole('link', { name: /Account settings/ }).click()
  await expect(page.getByRole('tab', { name: 'Account', selected: true })).toBeVisible()
  await page.getByRole('tab', { name: 'General' }).click()
  await expect(page.getByText('Only an admin can change the business details.')).toBeVisible()
})

test('admin manages fleet, maintenance, staff, packages and chatbot answers', async ({ page }) => {
  await page.goto('/admin/login')
  await signInSample(page, 'Admin')
  await expect(page.getByRole('heading', { name: 'Magandang umaga, Admin' })).toBeVisible()

  // Add a van, then confirm overdue maintenance so Van 05 is back in service.
  await adminNav(page, 'Vehicles')
  await page.getByRole('button', { name: 'Add van' }).click()
  const dlg = page.getByRole('dialog')
  await dlg.getByLabel('Make, model and year').fill('Toyota Hiace (2025)')
  await dlg.getByLabel('Plate number').fill('TMS 1001')
  await dlg.getByRole('button', { name: 'Add van' }).click()
  await expect(dlg.getByText('Another van already has this plate number.')).toBeVisible()
  await dlg.getByLabel('Plate number').fill('TMS 9901')
  await dlg.getByRole('button', { name: 'Add van' }).click()
  await expect(page.getByRole('button', { name: 'Van 16 details' })).toBeVisible()
  await page.getByRole('button', { name: 'Van 01 details' }).click()
  await page.getByRole('button', { name: 'Remove van' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Remove van' }).click()
  await expect(page.getByRole('dialog').getByText(/upcoming trip/)).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  await adminNav(page, 'Maintenance')
  await expect(page.getByText(/Van 05 is past the scheduled maintenance date/)).toBeVisible()
  await page.getByRole('button', { name: 'Mark done' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm done' }).click()
  await expect(page.getByText(/Van 05 is past/)).toHaveCount(0)
  await page.getByRole('tab', { name: /Done/ }).click()
  await expect(page.getByText('Van 05 · Oil change and brake check')).toBeVisible()

  // Staff accounts: a deactivated account cannot log in.
  await adminNav(page, 'Staff accounts')
  await page.getByRole('button', { name: 'Deactivate Liza Manalo' }).click()
  await expect(page.getByRole('button', { name: 'Reactivate Liza Manalo' })).toBeVisible()

  // Tour packages: a package with bookings can be deactivated but not deleted.
  await adminNav(page, 'Tour packages')
  await page.getByRole('button', { name: 'Baguio Weekend Escape details' }).click()
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Delete package' }).click()
  await expect(page.getByRole('dialog').getByText(/Deactivate it instead/).first()).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click()

  // Chatbot preset answers feed Ask TAMS.
  await adminNav(page, 'Manage chatbot')
  await page.getByLabel('Customer question').fill('What are your office hours?')
  await page.getByRole('button', { name: 'Check answer' }).click()
  await expect(page.getByText('Preset: Office hours')).toBeVisible()

  // Log out and try the deactivated account.
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click()
  await signInSample(page, 'Liza Manalo')
  await expect(page.getByText('This account is deactivated. Ask an admin to turn it back on.')).toBeVisible()
})

test('planner request: revise after changes are requested, set dates, and resend', async ({ page }) => {
  await page.goto('/admin/login')
  await signInSample(page, 'Liza Manalo')
  await adminNav(page, 'Requests')
  await page.getByRole('button', { name: /CR-2026-0013/ }).click()
  const response = page.getByRole('region', { name: 'Customer response' })
  await expect(response.getByText('Changes requested')).toBeVisible()
  await expect(response.getByText(/beginner surf lesson/)).toBeVisible()
  await response.getByRole('button', { name: 'Revise proposal' }).click()
  const dlg = page.getByRole('dialog', { name: 'Edit proposal' })
  await dlg.getByRole('button', { name: 'Add price line' }).click()
  await dlg.getByLabel('Description').last().fill('Beginner surf lesson')
  await dlg.getByLabel('Unit price (₱)').last().fill('500')
  await dlg.getByLabel('Qty').last().fill('6')
  await dlg.getByLabel('Note to the customer (optional)').fill('We added a surf lesson on Day 2.')
  await dlg.getByRole('button', { name: 'Save proposal' }).click()
  await expect(page.getByText('Revised proposal (not sent)')).toBeVisible()
  await expect(page.getByText('Beginner surf lesson · ₱500 × 6 trip')).toBeVisible()
  await page.getByRole('button', { name: 'Send revised proposal' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Send proposal' }).click()
  await expect(response.getByText('Sent', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('Waiting for the customer to accept or ask for changes.')).toBeVisible()
})

test('log out from the profile, and login starts on Home', async ({ page }) => {
  // Customer: a guest bounced from a tab lands on Home after login.
  await page.goto('/app/trips')
  await signInSample(page, 'Maria Santos')
  await expect(page).toHaveURL(/\/app$/)
  // Signed in, the login page sends Maria back to her own workspace, and staff pages send her to the customer site.
  await page.goto('/app/login')
  await expect(page).toHaveURL(/\/app$/)
  await page.goto('/admin')
  await expect(page).toHaveURL(/\/app$/)
  await page.getByRole('button', { name: /Account menu for/ }).click()
  await page.getByRole('button', { name: 'Log out' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('button', { name: /Account menu for/ })).toHaveCount(0)

  // Admin: the avatar opens Account, which has Log out.
  await page.goto('/admin/login')
  await signInSample(page, 'Admin')
  await page.getByRole('link', { name: /Account settings/ }).click()
  await page.getByRole('main').getByRole('button', { name: 'Log out' }).click()
  await expect(page.getByRole('heading', { name: 'Staff login' })).toBeVisible()
})
