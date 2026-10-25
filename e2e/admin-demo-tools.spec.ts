import { adminNav, expect, signInSample, test } from './fixtures'

test('bookings list names the next staff step, and Reset demo on the login page restores the sample data', async ({ page }) => {
  await page.goto('/login')
  await signInSample(page, 'Admin')
  await adminNav(page, 'Bookings')
  await expect(page.getByRole('columnheader', { name: 'Next step' })).toBeVisible()
  const awaiting = page.getByText('Payments awaiting verification').locator('..')
  const before = await awaiting.textContent()

  // The Next step button opens the booking panel with that step's control.
  await page.locator('tbody').getByRole('button', { name: 'Verify payment' }).first().click()
  const panel = page.getByRole('complementary', { name: /^Booking BK-2026-/ })
  await panel.getByRole('button', { name: 'View proof' }).first().click()
  await page.getByRole('dialog').getByRole('button', { name: 'Verify payment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Verify payment' }).click()
  await expect(awaiting).not.toHaveText(before!)
  await page.screenshot({ path: 'test-results/admin-bookings-next-step.png', fullPage: true })

  await page.getByRole('link', { name: /Account settings/ }).click()
  await page.getByRole('main').getByRole('button', { name: 'Log out' }).click()
  await page.goto('/login')
  await page.getByRole('button', { name: 'Reset demo' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Reset demo' }).click()
  await expect(page.getByText('Demo reset.')).toBeVisible()
  await page.screenshot({ path: 'test-results/login-demo-tools.png', fullPage: true })

  await signInSample(page, 'Admin')
  await adminNav(page, 'Bookings')
  await expect(awaiting).toHaveText(before!)
})
