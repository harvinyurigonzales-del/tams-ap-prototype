// Small validators shared by customer and admin forms. Messages follow the spec's wording.
export const emailError = (v: string) =>
  !v.trim() ? 'Enter your email address.' : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? '' : 'Enter a valid email address, like name@example.com.'

export const passwordError = (v: string) => (!v ? 'Enter your password.' : '')

export const newPasswordError = (v: string) =>
  !v ? 'Create a password.' : v.length < 8 ? 'Use at least 8 characters.' : ''

export const nameError = (v: string) => (v.trim().length < 2 ? 'Enter your full name.' : '')

/** Philippine mobile format, e.g. 0900 555 0101. Only the shape is checked; no number is ever contacted. */
export const mobileError = (v: string) =>
  !v.trim() ? 'Enter a mobile number.' : /^(09|\+639)\d{9}$/.test(v.replace(/[\s-]/g, '')) ? '' : 'Use the format 09XX XXX XXXX.'

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
