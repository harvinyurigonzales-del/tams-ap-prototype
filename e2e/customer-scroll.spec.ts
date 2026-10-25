import { expect, test } from './fixtures'

// Regression: an extension that makes window.scrollTo return a value used to crash client-side navigation.
test('navigation survives a patched window.scrollTo', async ({ page }) => {
  await page.addInitScript(() => {
    const original = window.scrollTo.bind(window)
    window.scrollTo = ((...args: Parameters<typeof window.scrollTo>) => {
      original(...(args as [number, number]))
      return 0
    }) as typeof window.scrollTo
  })
  await page.goto('/')
  await page.getByRole('link', { name: /Customer demo/ }).click()
  await page.getByRole('link', { name: /^Book this date/ }).click()
  await expect(page.getByRole('heading', { name: 'Choose date' })).toBeVisible()
  await page.getByRole('link', { name: 'Home', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: 'Tara, alis muna tayo.' })).toBeVisible()
})
