# TAMS AP Booking Management System (prototype)

A clickable, frontend-only prototype of the booking management system for **TAMS AP Travel and Tours**, built for the mini-defense. It shows the customer side (browse, book, pay) and the admin side (verify, confirm, assign vans, reports) using fictional sample data.

> **No database, no backend, no real login, no payment gateway, no SMS/email/live chat, no external AI.** Everything runs in the browser and resets on reload or **Reset demo**.

## Demo accounts (fictional)

| Side | Email | Password |
| --- | --- | --- |
| Customer | `maria.santos@example.com` | `Maria2026!` |
| Customer with no history | `paolo.rivera@example.com` | `Paolo2026!` |
| Admin | `admin@tamsap.example.com` | `Admin2026!` |

Both login screens also have a **Use demo account** button. The customer login also has **Use a new customer instead** (Paolo), to show suggestions for someone with no trips, saved items or preferences.

## How the demo works

- The clock is fixed at **Thu, Oct 8, 2026, 9:30 AM (Asia/Manila)**. Business logic never reads the real date.
- One canonical seed (`src/seed/canonical.ts`) feeds two separate in-memory copies: one for the customer demo, one for the admin demo. They never share data.
- The customer demo starts **without** Maria's Baguio booking so the presenter can create it live (it becomes `BK-2026-0148` / `PAY-2026-0192`). The admin demo starts **with** a prepared copy of that same booking.
- Nothing is stored in `localStorage`, cookies or IndexedDB. Closing or reloading the tab resets everything.
- Business rules (50% down payment, 2-day booking cut-off, van/driver conflict checks, and so on) live in `src/domain/rules.ts`. Report figures are calculated in `src/domain/metrics.ts`.

Suggested script: start at `/`, run **Customer demo** on a phone-width window, then **Admin demo** on a laptop-width window, then **Reset demo**.

## Customer side

Guests can browse everything; logging in is needed for personal records and to send anything. When a guest is sent to log in, they come back to the same page with their form answers (or the item they tried to save) kept.

| Route | Screen |
| --- | --- |
| `/app` | Home: search, quick links, **Needs your attention**, promo, suggestion rows |
| `/app/explore` | Mobile Explore hub: Tours, Destinations, Van rental, Custom trip |
| `/app/tours`, `/app/tours/:id`, `/app/tours/:id/dates` | Tour catalog with filters (destination, price, length, interest, open dates), tour page, date picker |
| `/app/destinations`, `/app/destinations/:id` | Destinations, with Save, tours there and **Plan a custom trip here** |
| `/app/custom/new?destination=…`, `/app/custom/:id` | Custom-trip request form and tracking page (proposal, accept, request changes, withdraw) |
| `/app/rental`, `/app/rental/request?category=…`, `/app/rentals/:id` | Van rental landing, request form with live estimate, tracking page (quote, accept) |
| `/app/trips` (`?tab=custom`, `?tab=rental`) | My Trips: Bookings, Custom requests, Van rental requests |
| `/app/trips/:id` | Booking page with timeline, payments, linked request and **Before you travel** checklist |
| `/app/saved`, `/app/preferences`, `/app/messages`, `/app/messages/:id`, `/app/notifications`, `/app/account` | Saved items, travel preferences, staff messages, notifications, account |

Old links still work: `/app/services…` goes to `/app/tours…` (the old van service goes to `/app/rental`), `/app/rent` to `/app/rental/request`, and `/app/inquiries` to `/app/messages`.

Navigation: on desktop the header has Home, Explore Tours, Destinations, Van Rental and My Trips, plus Saved, Messages, Notifications and an account menu. On phones the bottom bar has Home, Explore, My Trips and Account. The **Ask TAMS** button floats above the bottom bar.

### Request lifecycle

Custom trips and van rentals start as **requests**, not bookings: `Submitted → Under review → Proposal ready → Accepted`, or `Closed` (withdrawn by the customer or closed by staff) from any open step. For rentals, "Proposal ready" is shown as **Quote ready**. A customer can **Request changes** on a proposal or quote, which sends it back to Under review. Accepting creates **exactly one** linked `Pending` booking (accepting again returns the same booking). That booking follows the normal rules: pay the 50% down payment, staff verify it and confirm. Nothing is confirmed automatically, and requests never count in bookings, revenue or any report; an accepted request counts once, as its booking. Proposals and quotes are valid for 7 days. Rules: `src/domain/requests.ts`.

### Van rental pricing (sample policy)

Rentals always come with a driver. Standard van (Toyota Hiace or similar, 12 seats) ₱6,500 and Premium van (Hyundai Staria or similar, 10 seats) ₱7,500 per **service day** (up to 12 hours, fuel and driver included).

- Every calendar day the van is out is one service day; there is no partial-day discount.
- Multi-day trips add ₱1,000 per night for the driver's meals and lodging.
- Same-day trips over 12 hours add about ₱500 per extra hour.
- One-way trips are billed as a full day because the van returns empty.
- Tolls, parking and entrance fees are excluded.
- The form shows an **estimate**; staff send the **quote**. A request does not reserve a van, and payment happens only after the customer accepts a quote.
- Checks: pickup in Metro Manila, Bulacan, Pampanga, Rizal, Cavite or Laguna; destination in Luzon; requests close 2 days before travel; up to 7 days; return after departure; passengers within the vehicle's seats; and at least one van of the category free on those days (checked by calendar day, like admin assignment).

Custom-trip proposals use sample rates: private van ₱6,500 per day per 12 people, hotel ₱2,200 per twin room per night, guide and fees ₱650 per person.

### Suggestions (simulated)

Home suggestions are **simple rules, not AI** (`src/domain/recommend.ts`, pure functions kept apart from the UI). Each card says why it was picked.

- **Continue planning:** the customer's saved items and pages viewed in this session.
- **Inspired by your … trip:** only when the logged-in customer has a real completed trip in the sample data (Maria: Tagaytay); picks tours that share interests with it.
- **Matches your interests / Around your budget:** scored on shared interests (3 points each), price within budget (+2), trip length (+2), with small adjustments for travel style.
- **Upcoming departures with open seats** and **Destinations to explore:** shown to everyone, including guests and Paolo.
- Tours with no open departure are never offered as bookable. No card appears twice. **Not interested** hides a card for the session (with Undo). Changing **Travel preferences** changes the rows right away.

### Ask TAMS (simulated assistant)

A floating assistant labelled **"Demo assistant · simulated responses"**. It is not an AI model and calls no external API: questions are matched by keywords to fixed topics and answers are built from the sample data (`src/domain/assistant.ts`).

- Topics: tour prices, inclusions, pickup points, open dates and seats, promos, payment methods, down payment and balance, cancellation, what to bring, van rental, custom trips, destination info, and the status of the customer's own bookings and requests.
- Ambiguous questions get a clarification (for example "How much?" or "San Juan"). Questions it cannot answer (pets, insurance, weather…) are never guessed; it offers to **Send to staff**.
- Personal answers require login and only read the active customer's records. Asking about another customer's reference says it isn't in your account.
- **Ask about this tour / booking / request** buttons open the assistant with that context.
- Escalation: explanation → editable subject and question → optional related booking or request → **Send to staff** → `INQ-2026-####` with status **Awaiting staff**, listed in Messages. Statuses: Awaiting staff, Staff replied, Resolved. No staff are online and nothing is sent by email, SMS or live chat; the sample contact is `hello@tamsap.example.com`.

### Demo controls (customer side)

Clearly marked boxes that play the staff side so a walkthrough can continue without the admin demo:

- **Simulate staff review / Simulate staff proposal (quote)** on a custom or rental request.
- **Show sample staff reply** in a message thread.

### Reset, refresh and offline

- **Reset demo** and reloading the page both clear everything: bookings, requests, messages, saved items, preferences, suggestions dismissed, assistant chat, drafts and checklist ticks. Nothing uses browser storage.
- After the first online visit, all routes, the destination photos and the illustrations work offline (they are in the service worker precache). Data still lives only in memory.

## Customer walkthrough

1. Open `/app` as a guest: only **Upcoming departures** and **Destinations to explore** rows appear. Tap **Ask TAMS** and ask "How much is the Baguio tour?".
2. Log in with **Use demo account**. Home now shows **Needs your attention** (Banaue proposal, Morong quote) and personalised rows with reasons.
3. Book the **Baguio Weekend Escape**, Oct 17, 2 people, and submit the sample payment (as before). Do this **before** accepting any proposal or quote so the booking gets `BK-2026-0148`, matching the admin demo.
4. **Destinations → Sagada → Plan a custom trip here**, fill in pickup and send. Use **Simulate staff review**, then **Simulate staff proposal**, then **Accept proposal**: a pending booking is created and linked.
5. Open the Banaue proposal (`CR-2026-0012`) and try **Request changes**.
6. **Van rental → Request a van**: try 13 passengers or "Outside Luzon" to see the checks, then send a valid request and watch the estimate. Open `VR-2026-0005` in My Trips and **Accept quote**.
7. Open **My Trips → Tagaytay Day Tour (Nov 7)** to show **Before you travel**: pickup, balance, assigned van and driver, and the checklist.
8. In Ask TAMS, ask "Can I bring my dog?", choose **Send to staff**, link the Tagaytay booking and send. In Messages, press **Show sample staff reply**.
9. **Account → Travel preferences**: switch to Beach and save; the suggestion rows change. Log out and use **Use a new customer instead** to show the no-history view.

## Admin seeded scenarios

- **Requests** page (`/admin/requests`):
  - `CR-2026-0009` Maria, Vigan, Under review, with a prepared proposal; press **Send proposal**.
  - `CR-2026-0011` Juan, Baler, Submitted; **Start review**, then send.
  - `CR-2026-0012` Maria, Banaue, Proposal ready (₱30,900).
  - `CR-2026-0004`, Closed.
  - `VR-2026-0005` Maria, Morong, Quote ready (₱14,000).
  - `VR-2026-0001` Joel, Baler, Accepted and linked to `BK-2026-0130` (the quote waived the driver allowance, ₱13,000). Only the booking counts in reports.
- **Inquiries:** each shows its status. Prepared answers can be inserted with **Insert scripted reply**, then **Record reply** (status becomes Staff replied) and **Mark resolved**. `INQ-2026-0004` is Maria's escalated question about `CR-2026-0012`.
- Booking panels show **From request …** for bookings created from a proposal or quote.
- The admin and customer demos still do not share data: accepting a proposal in the customer demo does not appear in the admin demo.

## Images

- `public/images/destinations/baguio.jpg` and `banaue.jpg` are photos taken from the team's design file *(USER SIDE SAMPLE) Group 5 - Travel Agency.pdf*. Their original source and license are not stated there, so they are labelled **Representative photo**. Confirm the license (or replace them) before any public use.
- The other destinations and both vans use simple illustrations generated for this prototype (SVG, no third-party assets) and are labelled **Illustration** in the app.

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
| `npm test` | Unit tests: seed figures, demo scripts, rental pricing, requests, suggestions, assistant, reset |
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
- **Photos:** destination and van images live in `public/images/` and are referenced from `src/seed/canonical.ts` (`image.kind` sets the Illustration / Representative photo label).
- **Sample data:** `src/seed/canonical.ts`. If you change it, update the expected numbers in `src/__tests__/metrics.test.ts`.

## Project layout

```
src/
  app/          start screen, reset, shared auth layout
  features/
    customer/   customer screens (/app/...)
    admin/      admin screens (/admin/...)
  domain/       business rules, requests, suggestions, assistant and report metrics (pure functions)
  seed/         canonical sample data and the two working copies
  state/        in-memory stores (customer, admin, assistant panel, toasts)
  ui/           buttons, fields, badges, dialogs, charts
  pwa/          service worker registration and install help
e2e/            Playwright demo-script tests
```

All names, emails (`example.com`), mobile numbers (`0900 555 …`) and plate numbers are fictional.
