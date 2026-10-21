import { expect, test } from '@playwright/test'

test('works offline after the first visit', async ({ page, context }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready
    return !!reg.active
  })
  await page.reload()
  await context.setOffline(true)
  await page.goto('/admin/login')
  await expect(page.getByRole('heading', { name: 'Staff login' })).toBeVisible()
  await page.getByRole('button', { name: 'Use demo account' }).click()
  await expect(page.getByText('₱22,494')).toBeVisible()
  await context.setOffline(false)
})

test('manifest is served', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest')
  expect(res.ok()).toBeTruthy()
  const m = await res.json()
  expect(m.theme_color).toBe('#5B3CC4')
  expect(m.icons).toHaveLength(3)
})
