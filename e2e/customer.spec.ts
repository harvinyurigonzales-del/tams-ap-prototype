import { expect, signInSample, test } from './fixtures'

test('guest lands on Home, Maria starts clean, and books and pays a tour', async ({ page }) => {
  // No start screen: the site opens on the customer Home page.
  await page.goto('/')
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

  await page.goto('/app/login')
  await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByText('Enter your email address.')).toBeVisible()
  await page.getByLabel('Email').fill('maria.santos@example.com')
  await page.getByLabel('Password', { exact: true }).fill('wrong-password')
  await page.getByRole('button', { name: 'Log in', exact: true }).click()
  await expect(page.getByText('Email or password is incorrect.')).toBeVisible()
  await signInSample(page, 'Maria Santos')
  await expect(page).toHaveURL(/\/app$/)
  await expect(page.getByText('Hello, Maria')).toBeVisible()

  // A clean start: no trips and no notifications.
  await expect(page.getByRole('button', { name: 'Notifications', exact: true })).toBeVisible()
  const nav = page.getByRole('navigation', { name: 'Main' }).last()
  await nav.getByRole('link', { name: 'My Trips' }).click()
  await expect(page.getByText('No bookings yet')).toBeVisible()

  await nav.getByRole('link', { name: 'Explore' }).click()
  await page.getByRole('link', { name: 'Baguio Weekend Escape', exact: true }).click()
  await page.getByRole('link', { name: 'View dates' }).click()
  await expect(page.getByRole('heading', { name: 'October 2026' })).toBeVisible()
  await page.getByRole('gridcell', { name: /Oct 17, 2026, 8 left/ }).click()
  await page.getByRole('button', { name: 'Continue' }).click()
  // Booking steps hide the bottom bar.
  await expect(page.getByRole('navigation', { name: 'Main' }).last()).toBeHidden()

  await page.getByRole('button', { name: 'Add a traveller' }).click()
  await expect(page.getByText('₱4,998').first()).toBeVisible()
  await page.getByRole('button', { name: 'Review booking' }).click()
  await page.getByRole('button', { name: 'Submit booking' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit booking' }).click()
  await expect(page.getByRole('heading', { name: 'Booking received' })).toBeVisible()
  const ref = (await page.getByText(/BK-2026-\d{4}/).first().textContent())!.match(/BK-2026-\d{4}/)![0]

  await page.getByRole('link', { name: 'Pay now' }).click()
  await page.getByRole('button', { name: 'Use sample payment details' }).click()
  await expect(page.getByLabel('Reference number')).toHaveValue(/^\d{4} \d{3} \d{6}$/)
  await page.getByRole('button', { name: 'Submit payment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit payment' }).click()
  await expect(page.getByRole('heading', { name: 'Payment submitted' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to trip' }).click()
  await expect(page.getByText('Awaiting verification').first()).toBeVisible()

  // The records survive a full reload.
  await page.reload()
  await expect(page.getByText(ref).first()).toBeVisible()
  await expect(page.getByText('Awaiting verification').first()).toBeVisible()
})
