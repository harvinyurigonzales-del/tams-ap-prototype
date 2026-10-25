import { expect, test, type Page, signInSample } from './fixtures'

async function pay(page: Page) {
  await page.getByRole('button', { name: 'Use sample payment details' }).click()
  await page.getByRole('button', { name: 'Submit payment' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit payment' }).click()
  await expect(page.getByRole('heading', { name: 'Payment submitted' })).toBeVisible()
  await page.getByRole('link', { name: 'Back to trip' }).click()
}

test('presenter plays the staff side of a booking, and every step notifies the customer', async ({ page }) => {
  await page.goto('/app/book/DEP-BAG-1017?pax=2')
  await signInSample(page, 'Maria Santos')
  await expect(page.getByRole('heading', { name: 'Booking details' })).toBeVisible()
  await page.getByRole('button', { name: 'Review booking' }).click()
  await page.getByRole('button', { name: 'Submit booking' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit booking' }).click()
  await page.getByRole('link', { name: 'Pay now' }).click()
  await pay(page)

  const step = (name: string) => page.getByRole('button', { name })
  // A rejected proof asks for a new one.
  await step('Staff reject the payment').click()
  await expect(page.getByText(/reference number does not match/).first()).toBeVisible()
  await page.getByRole('link', { name: 'Submit new proof' }).click()
  await pay(page)
  await step('Staff verify the payment').click()
  await expect(page.getByText('Partially paid').first()).toBeVisible()
  await step('Staff confirm the booking').click()
  await expect(page.getByText('Confirmed').first()).toBeVisible()
  await step('Send the trip reminder').click()
  await page.getByRole('link', { name: 'Pay balance' }).click()
  await pay(page)
  await step('Staff verify the payment').click()
  await step('Mark the trip completed').click()
  await expect(page.getByText('Completed').first()).toBeVisible()
  await expect(page.getByText('Presenter shortcut')).toHaveCount(0)

  await page.getByRole('button', { name: /^Notifications/ }).click()
  await page.getByRole('link', { name: 'View all notifications' }).click()
  for (const t of ['Booking received', 'Payment submitted', 'Payment needs a new proof', 'Payment verified', 'Booking confirmed', 'Trip reminder', 'Trip completed'])
    await expect(page.getByText(t, { exact: true }).first()).toBeVisible()
})

test('cancellation request can be approved by staff', async ({ page }) => {
  await page.goto('/app/book/DEP-BAG-1017?pax=1')
  await signInSample(page, 'Maria Santos')
  await page.getByRole('button', { name: 'Review booking' }).click()
  await page.getByRole('button', { name: 'Submit booking' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit booking' }).click()
  await page.getByRole('link', { name: 'Pay later' }).click()
  await page.getByRole('button', { name: 'Request cancellation' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Send request' }).click()
  await page.getByRole('button', { name: 'Staff approve the cancellation' }).click()
  await expect(page.getByText(/Cancelled: Cancelled at your request/)).toBeVisible()
})
