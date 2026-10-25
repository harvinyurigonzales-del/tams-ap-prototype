import { create } from 'zustand'

// Demo shortcuts on customer screens (playing the staff side forward, showing a prepared staff reply). They are on
// by default so the whole journey can be shown from the customer side; switch them off from the login page or with
// ?presenter=0. The choice is remembered for this browser tab only.

const KEY = 'tams-presenter'

function initial() {
  try {
    const param = new URLSearchParams(window.location.search).get('presenter')
    if (param === '0') sessionStorage.setItem(KEY, '0')
    if (param === '1') sessionStorage.setItem(KEY, '1')
    return sessionStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}

export const usePresenter = create<{ on: boolean; set: (on: boolean) => void }>((set) => ({
  on: typeof window === 'undefined' ? false : initial(),
  set: (on) => {
    try {
      sessionStorage.setItem(KEY, on ? '1' : '0')
    } catch {
      // Storage can be blocked; the switch still works for this page view.
    }
    set({ on })
  },
}))
