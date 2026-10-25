# Google sign-in: what is done and what is left

The customer log-in and sign-up screens have a **Continue with Google** option built on
[Google Identity Services](https://developers.google.com/identity/gsi/web) (the official
"Sign in with Google" button and popup).

## Current state

- Without configuration, the button opens a notice that Google sign-in is not connected yet.
  It never signs anyone in and sends nothing to Google.
- With `VITE_GOOGLE_CLIENT_ID` set, the app loads Google's script, shows Google's own button and,
  after the person picks an account in Google's popup, creates or reuses a demo customer with that
  Google name and email (`googleSignIn` in `src/state/customerStore.ts`).
- The prototype has no server, so it reads the ID token in the browser without verifying its
  signature (`src/lib/google.ts`). That is acceptable for a demo only. See "Before production".
- No client secret is used anywhere. The client ID is public by design.

## Turn it on (about 10 minutes)

1. In [Google Cloud Console](https://console.cloud.google.com/), create or pick a project.
2. **APIs & Services → OAuth consent screen**: choose External, fill in the app name
   (TAMS AP Travel and Tours), support email and logo, and add test users while the app is in testing.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**, type **Web application**.
4. Under **Authorized JavaScript origins**, add every origin that serves the app, for example:
   - `http://localhost:5173` (development)
   - `http://localhost:4173` (preview build)
   - the production Vercel domain, such as `https://tams-ap-prototype.vercel.app`
   - preview domains you want to test on (each Vercel preview URL is its own origin)

   No redirect URI is needed: the popup flow returns the credential to the page.
5. Copy the **Client ID** (it ends in `.apps.googleusercontent.com`).
6. In Vercel: **Project → Settings → Environment Variables**, add `VITE_GOOGLE_CLIENT_ID` with that value
   for Production (and Preview if wanted), then redeploy. Locally, put it in `.env.local`
   (see `.env.example`). Vite reads it at build time.

## Before production

A real system must not trust a token decoded in the browser. Add a small server endpoint that:

1. receives the `credential` (ID token) from the browser,
2. verifies it with Google's library (for example `google-auth-library`'s `verifyIdToken`) against the
   client ID, checking `aud`, `iss`, expiry and `email_verified`,
3. finds or creates the customer, and returns the app's own session (an HttpOnly cookie).

Keep any server-side secrets (database keys, session secrets) in the hosting provider's environment
variables, never in client code or the repository.
