# TAMS AP Booking Management System (prototype)

A clickable, frontend-only prototype of the booking management system for **TAMS AP Travel and Tours**, built for the mini-defense. It shows the customer side (browse, book, pay) and the admin side (verify, confirm, assign vans, reports) using fictional sample data.

> **No database, no backend, no real login, no payment gateway, no SMS/email/AI.** Everything runs in the browser and resets on reload or **Reset demo**.

## Demo accounts (fictional)

| Side | Email | Password |
| --- | --- | --- |
| Customer | `maria.santos@example.com` | `Maria2026!` |
| Admin | `admin@tamsap.example.com` | `Admin2026!` |

Both login screens also have a **Use demo account** button.

## How the demo works

- The clock is fixed at **Thu, Oct 8, 2026, 9:30 AM (Asia/Manila)**. Business logic never reads the real date.
- One canonical seed (`src/seed/canonical.ts`) feeds two separate in-memory copies: one for the customer demo, one for the admin demo. They never share data.
- The customer demo starts **without** Maria's Baguio booking so the presenter can create it live (it becomes `BK-2026-0148` / `PAY-2026-0192`). The admin demo starts **with** a prepared copy of that same booking.
- Nothing is stored in `localStorage`, cookies or IndexedDB. Closing or reloading the tab resets everything.
- Business rules (50% down payment, 2-day booking cut-off, van/driver conflict checks, and so on) live in `src/domain/rules.ts`. Report figures are calculated in `src/domain/metrics.ts`.

Suggested script: start at `/`, run **Customer demo** on a phone-width window, then **Admin demo** on a laptop-width window, then **Reset demo**.

## Run it locally (VS Code)

Requires [Node.js](https://nodejs.org/) 20 or newer.

```bash
git clone https://github.com/harvinyurigonzales-del/tams-ap-prototype.git
cd tams-ap-prototype
code .            # opens the folder in VS Code
npm install
npm run dev       # http://localhost:5173
```

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server with hot reload |
| `npm run build` | Type-check and build to `dist/` (includes the service worker) |
| `npm run preview` | Serve the production build at http://localhost:4173 (use this to test offline/install) |
| `npm test` | Unit tests: seed figures and both demo scripts |
| `npm run e2e` | Browser tests of the demo script (run `npm run build` first; needs Playwright's Chromium: `npx playwright install chromium`) |
| `npm run icons` | Regenerate the PNG app icons from the placeholder monogram |

The service worker only runs in the production build, so check offline mode and installation with `npm run build && npm run preview`.

## Deploy to Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub and choose **Add New → Project**.
2. Import `tams-ap-prototype`. Vercel detects **Vite**: build command `npm run build`, output directory `dist`. No environment variables are needed.
3. Click **Deploy**. Every push to `main` redeploys automatically.

`vercel.json` adds the single-page-app rewrite and makes sure `sw.js` and the manifest are never cached stale.

## Installing as an app (PWA)

- **Chrome / Edge (desktop, Android):** use **Install app** on the start screen or the install icon in the address bar.
- **Safari on iPhone/iPad:** Share → **Add to Home Screen** (the app shows these steps).
- Some browsers do not support installing web apps; the prototype still works in a normal tab.
- After the first online visit, the app works offline. When a new version is deployed, a banner offers **Reload** (which also resets the demo data).

## Replacing placeholders

- **Logo:** `src/ui/BrandMark.tsx` and the files in `public/icons/` (regenerate with `npm run icons` or replace directly). No official logo is used.
- **Colours:** the `@theme` block in `src/styles.css` (spec section 8).
- **Photos:** trips show gradient placeholders (`PhotoPlaceholder` in `src/ui/Card.tsx`).
- **Sample data:** `src/seed/canonical.ts`. If you change it, update the expected numbers in `src/__tests__/metrics.test.ts`.

## Project layout

```
src/
  app/          start screen, reset, shared auth layout
  features/
    customer/   customer screens (/app/...)
    admin/      admin screens (/admin/...)
  domain/       business rules and report metrics (pure functions)
  seed/         canonical sample data and the two working copies
  state/        in-memory stores (customer, admin, toasts)
  ui/           buttons, fields, badges, dialogs, charts
  pwa/          service worker registration and install help
e2e/            Playwright demo-script tests
```

All names, emails (`example.com`), mobile numbers (`0900 555 …`) and plate numbers are fictional.
