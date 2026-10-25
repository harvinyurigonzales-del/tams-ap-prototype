// Renders the TAMS AP app icon (public/brand/tams-icon.svg, Concept A) to PNG icons with the bundled
// Chromium. Run: npm run icons
import { chromium } from '@playwright/test'
import { readFile, writeFile } from 'node:fs/promises'

const icon = await readFile('public/brand/tams-icon.svg', 'utf8')
const symbol = await readFile('public/brand/tams-symbol.svg', 'utf8')

// Rounded icon for "any"; full-bleed Cream square with the symbol inside the safe zone for maskable.
const html = (size, pad) =>
  pad
    ? `<div style="width:${size}px;height:${size}px;background:#F5EFE3;display:grid;place-items:center"><div style="width:${size * 0.66}px">${symbol.replace('<svg ', '<svg style="width:100%;height:auto;display:block" ')}</div></div>`
    : `<div style="width:${size}px;height:${size}px">${icon.replace('<svg ', '<svg style="width:100%;height:100%;display:block" ')}</div>`

const targets = [
  ['public/icons/apple-touch-icon.png', 180, true],
]

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined })
const page = await browser.newPage()
for (const [file, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size })
  await page.setContent(`<html><body style="margin:0;background:transparent">${html(size, pad)}</body></html>`)
  await writeFile(file, await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } }))
  console.log('wrote', file)
}
await browser.close()
