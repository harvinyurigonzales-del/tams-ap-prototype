import { create } from 'zustand'
import type { AssistantContext } from '../domain/assistant'

/** Open state of the Ask TAMS panel and what the customer is asking about. UI only; nothing is persisted. */
interface AssistantUi {
  open: boolean
  context?: AssistantContext
  /** A question to ask as soon as the panel opens, e.g. from "Ask about this tour". */
  prefill?: string
  openWith: (context?: AssistantContext, prefill?: string) => void
  close: () => void
  clearContext: () => void
}

export const useAssistant = create<AssistantUi>((set) => ({
  open: false,
  openWith: (context, prefill) => set({ open: true, context, prefill }),
  close: () => set({ open: false, prefill: undefined }),
  clearContext: () => set({ context: undefined }),
}))
