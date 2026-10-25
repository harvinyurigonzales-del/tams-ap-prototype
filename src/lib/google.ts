// Google sign-in through Google Identity Services (the "Sign in with Google" button and popup).
//
// It only turns on when VITE_GOOGLE_CLIENT_ID is set at build time. The client ID is public by design;
// the client secret is never used or stored in this app. See docs/google-sign-in.md for the setup and for
// the server step a production system needs (verifying the ID token before trusting it).

interface GisId {
  initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: 'popup'; auto_select?: boolean; context?: string }) => void
  renderButton: (el: HTMLElement, o: Record<string, unknown>) => void
}
declare global {
  interface Window {
    google?: { accounts: { id: GisId } }
  }
}

export const GOOGLE_CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim() || undefined

let loading: Promise<GisId> | undefined

export function loadGoogleIdentity(): Promise<GisId> {
  if (window.google?.accounts?.id) return Promise.resolve(window.google.accounts.id)
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = () => (window.google?.accounts?.id ? resolve(window.google.accounts.id) : reject(new Error('Google sign-in did not load.')))
    s.onerror = () => {
      loading = undefined
      reject(new Error('Could not reach Google. Check your connection and try again.'))
    }
    document.head.appendChild(s)
  })
  return loading
}

/**
 * Reads the profile from a Google ID token. This decodes without verifying the signature, which is fine for a
 * front-end prototype with no server. A real system must send the token to its server and verify it there.
 */
export function profileFromCredential(jwt: string) {
  const part = jwt.split('.')[1]
  const json = decodeURIComponent(
    atob(part.replace(/-/g, '+').replace(/_/g, '/'))
      .split('')
      .map((c) => `%${c.charCodeAt(0).toString(16).padStart(2, '0')}`)
      .join(''),
  )
  const p = JSON.parse(json) as { email?: string; name?: string; sub?: string; email_verified?: boolean }
  if (!p.email || !p.sub || p.email_verified === false) throw new Error('Google did not share a verified email address.')
  return { email: p.email, name: p.name ?? '', sub: p.sub }
}
