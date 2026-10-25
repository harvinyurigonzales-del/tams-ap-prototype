import { useEffect } from 'react'
import { create } from 'zustand'
import { respond, type AssistantContext } from '../domain/assistant'
import { useChatbot } from './chatbot'
import { useCustomer } from './customerStore'

/**
 * Ask TAMS state: whether the panel is open, what the customer is asking about, and the answer in progress.
 * Answering lives here rather than in the panel, so closing the panel or changing page mid-answer never loses
 * or duplicates a reply. The conversation itself is kept in the customer session (useCustomer().chat).
 */
interface AssistantUi {
  open: boolean
  /** The page the panel was opened from (a tour, a destination, a booking). */
  context?: AssistantContext
  /** The tour or destination the conversation is about now, from the latest answer. */
  topic?: AssistantContext
  pending: boolean
  openWith: (context?: AssistantContext, prefill?: string) => void
  close: () => void
  clearContext: () => void
  /** Sends a question, typed or picked from the suggestions. Ignored while an answer is on its way. */
  ask: (question: string) => void
  retry: (entryId: number) => void
  /** Starts a new conversation. */
  reset: () => void
}

/** How long the "typing" indicator shows before an answer, in ms. */
export const ANSWER_DELAY = 450
let seq = 0

export const useAssistant = create<AssistantUi>((set, get) => {
  const answer = (question: string) => {
    const my = ++seq
    set({ pending: true })
    window.setTimeout(() => {
      // A newer conversation started meanwhile: drop this reply.
      if (my !== seq) return
      const c = useCustomer.getState()
      const { topic, context } = get()
      try {
        // Test hook: window.__TAMS_ASSIST_FAIL__ = n makes the next n answers fail, to check Retry.
        const w = window as unknown as { __TAMS_ASSIST_FAIL__?: number }
        if (w.__TAMS_ASSIST_FAIL__ && w.__TAMS_ASSIST_FAIL__ > 0) {
          w.__TAMS_ASSIST_FAIL__--
          throw new Error('Simulated failure')
        }
        const a = respond(c.data, { question, customerId: c.customerId, context: topic ?? context }, undefined, useChatbot.getState().presets)
        c.addChat({ from: 'assistant', text: a.text, answer: a })
        set({ pending: false, topic: a.about ?? topic })
      } catch {
        c.addChat({ from: 'assistant', text: 'Sorry, I couldn’t answer that just now. Your question is saved, so you can try again.', error: true, question })
        set({ pending: false })
      }
    }, ANSWER_DELAY)
  }

  return {
    open: false,
    pending: false,
    openWith: (context, prefill) => {
      const cur = get().context
      const changed = !!context && (context.kind !== cur?.kind || context.id !== cur?.id)
      set({ open: true, context: context ?? cur, ...(changed ? { topic: undefined } : {}) })
      if (prefill) get().ask(prefill)
    },
    close: () => set({ open: false }),
    clearContext: () => set({ context: undefined, topic: undefined }),
    ask: (question) => {
      const q = question.replace(/\s+/g, ' ').trim()
      if (!q || get().pending) return
      useCustomer.getState().addChat({ from: 'customer', text: q })
      answer(q)
    },
    retry: (entryId) => {
      const c = useCustomer.getState()
      const e = c.chat.find((m) => m.id === entryId)
      if (!e?.error || !e.question || get().pending) return
      c.removeChat(entryId)
      answer(e.question)
    },
    reset: () => {
      seq++
      useCustomer.getState().clearChat()
      set({ pending: false, topic: undefined })
    },
  }
})

/**
 * Lifts the Ask TAMS launcher above a page's own sticky action bar while that page is shown, so the two never
 * overlap. `phone` applies below 768px (on top of the tab bar), `tablet` from 768px up.
 */
export function useLauncherRaise(phone: number, tablet = 0) {
  useEffect(() => {
    const root = document.documentElement.style
    root.setProperty('--launcher-raise', `${phone}px`)
    root.setProperty('--launcher-raise-md', `${tablet}px`)
    return () => {
      root.removeProperty('--launcher-raise')
      root.removeProperty('--launcher-raise-md')
    }
  }, [phone, tablet])
}
