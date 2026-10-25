import { expect, test } from './fixtures'

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
  await expect(page.getByText('₱25,092')).toBeVisible()
  // New customer routes and their bundled images also work offline.
  await page.goto('/app/destinations/DST-BAGUIO')
  await expect(page.getByRole('heading', { name: 'Baguio', exact: true })).toBeVisible()
  const img = page.getByRole('img', { name: /Burnham Park/ }).first()
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true)
  await page.goto('/app/rental')
  await expect(page.getByRole('heading', { name: 'Van rental with driver' })).toBeVisible()
  await context.setOffline(false)
})

test('manifest is served', async ({ request }) => {
  const res = await request.get('/manifest.webmanifest')
  expect(res.ok()).toBeTruthy()
  const m = await res.json()
  expect(m.theme_color).toBe('#1D3A7A')
  expect(m.icons).toHaveLength(3)
})
