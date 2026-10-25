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
