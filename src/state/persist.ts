import type { ChatPreset } from '../domain/assistant'
import { primeDemoClock } from '../lib/demoClock'
import { sharedSeed, type MaintenanceRecord } from '../seed/derive'
import type { Dataset } from '../seed/types'
import { DATA_VERSION, upgrade } from './migrate'

// One saved copy of the business data, shared by the customer site and the admin portal in this browser.
// Records live in localStorage, so they survive a refresh, a logout and switching between customer and staff
// accounts, and other tabs on the same site pick up changes through the `storage` event. Who is signed in is
// kept per tab in sessionStorage, so one tab can be Maria and another the staff portal.
//
// This is a prototype store, not a server: another browser or device has its own copy.

export const DATA_KEY = 'tams-ap-data-v1'
export const SESSION_KEY = 'tams-ap-session-v1'
const VERSION = DATA_VERSION

/** Customer login details. */
export interface CustomerAccount {
  email: string
  /** Empty for accounts created through Google sign-in. */
  password: string
  customerId: string
  googleSub?: string
}

/** Everything that is saved. Accounts and settings are optional so each store can fall back to its own defaults. */
export interface Saved {
  v: number
  data: Dataset
  maintenance: MaintenanceRecord[]
  customerAccounts?: CustomerAccount[]
  staffAccounts?: unknown[]
  settings?: unknown
  presets?: ChatPreset[]
}

export interface Session {
  customerId?: string | null
  staffId?: string | null
}

function storage(kind: 'local' | 'session'): Storage | null {
  try {
    return typeof window === 'undefined' ? null : kind === 'local' ? window.localStorage : window.sessionStorage
  } catch {
    return null
  }
}

function read(): Saved | null {
  try {
    const raw = storage('local')?.getItem(DATA_KEY)
    if (!raw) return null
    return upgrade(JSON.parse(raw) as Saved)
  } catch {
    return null
  }
}

function stampsOf(d: Dataset) {
  return [...d.notifications.map((n) => n.at), ...d.bookings.map((b) => b.createdAt), ...d.payments.map((p) => p.submittedAt)]
}

let start: Saved | null = null

/** The data the stores start from: the saved copy, or a fresh seed the first time this browser opens the app. */
export function startingState(): Saved {
  if (!start) {
    start = read() ?? seeded()
    primeDemoClock(stampsOf(start.data))
  }
  return start
}

/** A fresh copy of the sample data, for "Reset all sample data". */
export function freshState(): Saved {
  return seeded()
}

function seeded(): Saved {
  return { v: VERSION, ...sharedSeed() }
}

let lastWritten = ''
export function writeSaved(s: Saved) {
  try {
    const raw = JSON.stringify(s)
    if (raw === lastWritten) return
    lastWritten = raw
    storage('local')?.setItem(DATA_KEY, raw)
  } catch {
    // Storage can be full or blocked; the app keeps working for this page view.
  }
}

export function clearSaved() {
  lastWritten = ''
  try {
    storage('local')?.removeItem(DATA_KEY)
  } catch {
    // Ignore blocked storage.
  }
}

/** Parses a saved copy written by another tab. */
export function parseSaved(raw: string | null): Saved | null {
  if (!raw) return null
  try {
    const s = upgrade(JSON.parse(raw) as Saved)
    if (!s) return null
    lastWritten = raw
    primeDemoClock(stampsOf(s.data))
    return s
  } catch {
    return null
  }
}

export function readSession(): Session {
  try {
    return JSON.parse(storage('session')?.getItem(SESSION_KEY) ?? '{}') as Session
  } catch {
    return {}
  }
}

export function writeSession(patch: Session) {
  try {
    storage('session')?.setItem(SESSION_KEY, JSON.stringify({ ...readSession(), ...patch }))
  } catch {
    // Ignore blocked storage: the session then lasts for this page view.
  }
}

/**
 * When this tab last logged out. A protected page that loses its account because of that logout sends the person
 * Home (or to the staff login) instead of to a login page that would bring them back to it. A guest who opens a
 * protected page later is still asked to log in.
 */
const leaving = { at: 0 }
export const markSignedOut = () => {
  leaving.at = Date.now()
}
export const justSignedOut = () => Date.now() - leaving.at < 2000
