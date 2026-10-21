import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'success' | 'error' | 'info'
  action?: { label: string; run: () => void }
}

interface UiState {
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone'], action?: Toast['action']) => void
  dismiss: (id: number) => void
}

let n = 0
export const useUi = create<UiState>((set) => ({
  toasts: [],
  toast: (text, tone = 'success', action) => {
    const id = ++n
    set((s) => ({ toasts: [...s.toasts, { id, text, tone, action }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), action ? 6000 : 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
