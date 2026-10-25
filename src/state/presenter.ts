import { create } from 'zustand'

// Presenter shortcuts (playing the staff side forward, showing a prepared staff reply) are hidden from customer
// screens unless presenter mode is on. It is switched on from the start page or with ?presenter=1 and remembered
// for this browser tab only.

const KEY = 'tams-presenter'

function initial() {
  try {
    const param = new URLSearchParams(window.location.search).get('presenter')
    if (param === '1') sessionStorage.setItem(KEY, '1')
    if (param === '0') sessionStorage.removeItem(KEY)
    return sessionStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

export const usePresenter = create<{ on: boolean; set: (on: boolean) => void }>((set) => ({
  on: typeof window === 'undefined' ? false : initial(),
  set: (on) => {
    try {
      if (on) sessionStorage.setItem(KEY, '1')
      else sessionStorage.removeItem(KEY)
    } catch {
      // Storage can be blocked; the switch still works for this page view.
    }
    set({ on })
  },
}))
