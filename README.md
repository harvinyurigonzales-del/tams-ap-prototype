# TAMS AP Booking Management System (prototype)

A clickable, frontend-only prototype of the booking management system for **TAMS AP Travel and Tours**, built for the mini-defense. It shows the customer side (browse, book, pay) and the admin side (verify, confirm, assign vans, reports) using fictional sample data.

> **No database, no backend, no real login, no payment gateway, no SMS/email/live chat, no external AI.** Everything runs in the browser. Records are kept in this browser's local storage, so they survive a reload, a logout and switching between customer and staff.

## Sample accounts (fictional)

| Account | Email | Password | Lands on |
| --- | --- | --- | --- |
| Maria Santos (customer) | `maria.santos@example.com` | `Maria2026!` | Customer Home |
| Paolo Rivera (new customer) | `paolo.rivera@example.com` | `Paolo2026!` | Customer Home |
| Liza Manalo (staff) | `staff@tamsap.example.com` | `Staff2026!` | Staff dashboard |
| Admin | `admin@tamsap.example.com` | `Admin2026!` | Staff dashboard |

There is one login page for everyone (`/app/login`; `/admin/login` is the same form titled "Staff login"). Nobody picks a role: the account decides where it goes. Sign-up creates customer accounts only. A collapsed **Sample accounts** section under the form signs in with any of the four accounts in one tap.

The site opens on the customer Home page (`/` goes to `/app`, or to the staff dashboard for a signed-in staff member). Customer pages that need an account send guests to log in and bring them back to the booking, trip plan or request they started. Staff pages send customers to the customer site, and the customer site's account pages send staff to the staff portal.

## How the data works

- The clock is fixed at **Thu, Oct 8, 2026 (Asia/Manila)**. Business logic never reads the real date.
- **One shared set of records** (`src/state/sync.ts`, `src/state/persist.ts`). The customer site and the staff portal read and write the same data: a booking Maria makes appears for staff, and what staff do (verify a payment, confirm, assign a van, complete a trip, answer a request) appears for Maria, each with a notification. A trip staff mark **Completed** unlocks a review for its owner.
- Records live in `localStorage` (key `tams-ap-data-v1`). Other tabs of the same browser update right away through the `storage` event, so Maria can be open in one tab and the staff portal in another.
- The signed-in account is kept per tab in `sessionStorage` (`tams-ap-session-v1`), so one tab can be a customer and another staff. A reload keeps you signed in.
- **Limitations:** the records belong to one browser on one device. A different browser, a private window, another device or clearing site data starts again from the sample data. There is no server, so two people on two computers never see each other's changes, and simultaneous edits in two tabs are last-write-wins.
- **Sample data** is generated from `src/seed/canonical.ts` and `src/seed/expand.ts` (`sharedSeed()` in `src/seed/derive.ts`): 12 drivers, 15 vans, about 40 other customers and 79 bookings with their payments, van assignments and custom and rental requests. Every booking points at a real customer, departure and payment; departures never exceed their seats; no van or driver is double-booked; and a van always has enough seats.
- **Maria starts clean:** her profile only, with no trips, requests, reviews, saved items, preferences or notifications. What she does is kept until someone deliberately resets it.
- Business rules (50% down payment, 2-day booking cut-off, van/driver conflict checks, and so on) live in `src/domain/rules.ts`. Report figures are calculated in `src/domain/metrics.ts`.

## Resetting (for presenters)

Open **`/presenter`** (not linked from the app):

- **Reset Maria's journey** removes only Maria's bookings and their payments, requests, reviews, messages, notifications, van assignments, saved items and preferences, and restores her profile. Everyone else's records stay as they are.
- **Reset all sample data** puts every record, account and setting back to the original sample data.
- The same page switches presenter shortcuts on or off for the tab.

You can also clear the site data for the page in the browser, which has the same effect as **Reset all sample data**.

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

Navigation: on desktop the header has Home, Explore Tours, Destinations, Van Rental, Reviews and My Trips, plus Saved, Messages, the notification bell and an account menu (Account, Travel preferences, Log out). On phones a floating bottom bar has Home, Explore, **Ask TAMS** (centre), My Trips and Profile; the header keeps the notification bell and a **More** menu for Van Rental, Reviews, Saved and Messages. The bar hides on login and sign-up, booking and payment steps, while typing and while Ask TAMS is open. On desktop **Ask TAMS** is a floating button in the corner.

The notification bell opens a panel (a bottom sheet on phones) with the latest updates, unread ones marked, **Mark all as read**, a per-item mark-as-read button and **View all notifications**. Opening it marks nothing as read; choosing an item marks it read and opens the booking, request or message it is about. Escape closes it, and the arrow keys move between items.

Ask TAMS starts a fresh conversation every time it is closed or minimised (on phones also when you leave the page from the bottom bar). A reply still on its way when the chat closes is dropped. Follow-up questions keep their context while the chat is open.

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

### Ask TAMS (rules-based assistant)

Developer note: Ask TAMS is not an AI model and calls no external API. Questions are matched by keywords to fixed topics and answers are built from the catalog data (`src/domain/assistant.ts`). Customer copy never describes this; the panel subtitle is "Quick answers about trips, prices and payments". Preset answers from **Manage chatbot** (`src/state/chatbot.ts`) are checked first. Every answer comes with 3–4 follow-up questions that never repeat the question just asked. For tests, `window.__TAMS_ASSIST_FAIL__ = true` makes the next answer fail so the Retry path can be checked.

- Topics: tour prices, inclusions, pickup points, open dates and seats, promos, payment methods, down payment and balance, cancellation, what to bring, van rental, custom trips, destination info, and the status of the customer's own bookings and requests.
- Ambiguous questions get a clarification (for example "How much?" or "San Juan"). Questions it cannot answer (pets, insurance, weather…) are never guessed; it offers to **Send to staff**.
- Personal answers require login and only read the active customer's records. Asking about another customer's reference says it isn't in your account.
- **Ask about this tour / booking / request** buttons open the assistant with that context.
- Escalation: explanation → editable subject and question → optional related booking or request → **Send to staff** → `INQ-2026-####` with status **Awaiting staff**, listed in Messages. Statuses: Awaiting staff, Staff replied, Resolved. No staff are online and nothing is sent by email, SMS or live chat; the sample contact is `hello@tamsap.example.com`.

### Presenter mode (customer side)

Customer screens contain no demo or prototype wording. Presenter shortcuts appear only in presenter mode: switch it on at `/presenter` or open any page with `?presenter=1`. It lasts for the browser tab (`sessionStorage` key `tams-presenter`). The e2e fixtures switch it on. Shortcuts play the staff side forward from the customer's own screen (verify, confirm, remind, complete, send a proposal or a sample reply). With the shared records, the real staff portal in another tab does the same.

### Reviews

Only travellers with a **Completed** trip of their own can rate it, once per trip. Completed trips show in My Trips under **Completed trips** with **Rate your trip**, on the booking page, and in **Trips you can review** on the Reviews page; with several, each lists its package, dates and reference. Only the 1–5 star rating is required; a comment, title, suggestion and who you travelled with are optional. A rating-only review shows as "Rated N out of 5 stars." and counts in the averages.

### Responsive website

It is a responsive website (RWD), not an installable app: no manifest, no offline mode. Layouts adapt from phone to desktop in the browser. An earlier version shipped a service worker; `public/sw.js` and a check in `src/main.tsx` remove it from browsers that still have it.

## Walkthrough

1. Open `/` on a phone-width window: the customer Home page. Log in with **Sample accounts → Maria Santos**. My Trips and the notification bell are empty.
2. Book the **Baguio Weekend Escape** (Oct 17) and submit the sample payment.
3. In a second tab (laptop width), open `/admin/login` and use **Sample accounts → Liza Manalo**. The bell shows Maria's payment; choose it to open her booking. Verify the payment, confirm the booking, assign a van and driver, record the balance and press **Mark trip completed**.
4. Back in Maria's tab, the bell shows each update. **Trip completed** opens the review for that trip; choose a star rating and post it (the comment is optional).
5. Reload either tab, or log out and back in: everything is still there. Use `/presenter → Reset Maria's journey` to start her again.

## Admin seeded scenarios

- **Requests** page (`/admin/requests`):
  - `CR-2026-0011` Juan, Baler, Submitted; **Start review**, then send.
  - `CR-2026-0001` to `CR-2026-0005` and `VR-2026-0002` to `VR-2026-0004`: other customers' requests at each stage.
  - `VR-2026-0001` Joel, Baler, Accepted and linked to `BK-2026-0130` (the quote waived the driver allowance, ₱13,000). Only the booking counts in reports.
- `CR-2026-0013` Angelica, La Union, sent from the **TAMS Trip Planner** with flexible dates. A first proposal was sent and the customer asked for changes. **Revise proposal** opens the proposal editor (dates, itinerary, price lines, inclusions, validity, note); saving sets firm dates, which flexible requests need before sending. The **Customer response** panel tracks Sent, Changes requested, Revising, Accepted and Expired.
- **Inquiries:** each shows its status. Prepared answers can be inserted with **Insert suggested reply**, then **Record reply** (status becomes Staff replied, and the customer is notified) and **Mark resolved**.
- Booking panels show **From request …** for bookings created from a proposal or quote.
- Customer and staff share the same records: a proposal or quote staff send appears in the customer's My Trips, and accepting it there creates the booking staff see.

### Admin roles

- **Staff** see bookings, payments, calendar and assignment, customers, requests (including the proposal editor), inquiries, reviews, notifications and settings (Account; General is read-only). Vehicles, drivers and maintenance are view only.
- **Admin** also see **Reports**, **Tour packages**, **Staff accounts** and **Manage chatbot**, can add, edit and remove vans and drivers, schedule, reschedule, cancel and confirm maintenance, and edit business details.
- Admin-only pages are hidden from the staff menu; opening one by link shows an **Admin only** screen. Store actions check the role too. This is client-side only: real access control belongs on a server.
- Maintenance that is past its end date stays **Overdue** and keeps the van out of service until an admin confirms it is done (seeded: Van 05).
- The avatar in the header opens **Settings → Account** (profile and password).
- The side navigation is grouped into **Overview**, **Bookings and requests**, **Fleet and operations**, **Finance and reports** and **Administration**. Groups fold away (the one holding the current page stays open) and show how many items are waiting when folded. The list scrolls without a visible scrollbar on short screens and becomes a drawer on phones.
- **Booking panel:** answer a cancellation request (approve or decline), send a trip reminder and **Mark trip completed** (needs the balance paid).
- **Sales outlook** (dashboard): actual sales as a solid navy line, the forecast as a dashed red line with its likely range as a shaded band with dotted edges, and the same month last year as a dotted grey line, with a legend and a table view. Status colours (green, amber, red) are kept for status only.

## Images

Photos are from Wikimedia Commons under Creative Commons licenses, plus four supplied by the TAMS AP team whose license still needs confirming. Sources, authors and licenses for every photo are in [`docs/photo-sources.md`](docs/photo-sources.md) and on the in-app **Photo credits** page (`/app/credits`), linked from every footer. The hero slideshow shows no caption or credit on the photo itself; its ten photos are all Creative Commons and credited on that page.

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
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build at http://localhost:4173 |
| `npm test` | Unit tests: shared sample data checks, the Maria → staff → review journey, rules, rental pricing, requests, suggestions, assistant, reset |
| `npm run e2e` | Browser tests at phone and laptop widths, including two-tab customer/staff journeys (run `npm run build` first; needs Playwright's Chromium: `npx playwright install chromium`) |

## Deploy to Vercel

1. Sign in at [vercel.com](https://vercel.com) with GitHub and choose **Add New → Project**.
2. Import `tams-ap-prototype`. Vercel detects **Vite**: build command `npm run build`, output directory `dist`. No environment variables are needed.
3. Click **Deploy**. Every push to `main` redeploys automatically.

`vercel.json` adds the single-page-app rewrite and keeps `sw.js` (the clean-up worker) from being cached stale.

## Replacing placeholders

- **Logo:** `src/ui/BrandMark.tsx` and the favicon files in `public/icons/`. No official logo is used.
- **Colours:** the `@theme` block in `src/styles.css` (spec section 8).
- **Photos:** destination and van images live in `public/images/` and are referenced from `src/seed/canonical.ts` (`image.kind` sets the Illustration / Representative photo label).
- **Sample data:** `src/seed/canonical.ts` and the generator in `src/seed/expand.ts`. `src/__tests__/shared-data.test.ts` checks that the generated records stay consistent. Bump `VERSION` in `src/state/persist.ts` when the stored shape changes.

## Project layout

```
src/
  app/          routing, presenter page (/presenter), not-found page
  features/
    customer/   customer screens (/app/...)
    admin/      admin screens (/admin/...)
  domain/       business rules, requests, suggestions, assistant and report metrics (pure functions)
  seed/         canonical sample data, the generator and the shared starting records
  state/        stores (customer, admin, assistant, toasts), login routing, local storage and cross-tab sync
  ui/           buttons, fields, badges, dialogs, charts
e2e/            Playwright demo-script tests
```

All names, emails (`example.com`), mobile numbers (`0900 555 …`) and plate numbers are fictional.
