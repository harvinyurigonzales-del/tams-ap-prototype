// Renders the "TA" placeholder monogram to PNG icons with the bundled Chromium. Run: npm run icons
// Replace these files (and src/ui/BrandMark.tsx) when the official logo is available.
import { chromium } from '@playwright/test'
import { writeFile } from 'node:fs/promises'

const svg = (size, pad) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" ${pad ? '' : `rx="${size * 0.22}"`} fill="#5B3CC4"/>
  <text x="50%" y="50%" dy="0.35em" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${size * (pad ? 0.3 : 0.42)}" fill="#fff">TA</text>
</svg>`

const targets = [
  ['public/icons/icon-192.png', 192, false],
  ['public/icons/icon-512.png', 512, false],
  ['public/icons/maskable-512.png', 512, true],
  ['public/icons/apple-touch-icon.png', 180, true],
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()
for (const [file, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg(size, pad)}</body></html>`)
  await writeFile(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }))
  console.log('wrote', file)
}
await browser.close()
