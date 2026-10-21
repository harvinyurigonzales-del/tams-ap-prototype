import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'success' | 'error' | 'info'
}

interface UiState {
  toasts: Toast[]
  toast: (text: string, tone?: Toast['tone']) => void
  dismiss: (id: number) => void
}

let n = 0
export const useUi = create<UiState>((set) => ({
  toasts: [],
  toast: (text, tone = 'success') => {
    const id = ++n
    set((s) => ({ toasts: [...s.toasts, { id, text, tone }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))
