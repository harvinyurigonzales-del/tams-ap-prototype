import { create } from 'zustand'
import type { ChatPreset } from '../domain/assistant'
import { startingState } from './persist'

// Preset answers that admins manage in Manage chatbot. Ask TAMS checks them before its built-in answers.
// They are configuration rather than records, saved with the shared data so an edit shows up in Ask TAMS right away.

const SEED: ChatPreset[] = [
  {
    id: 'PRE-01', title: 'Office hours', active: true,
    keywords: ['office hours', 'business hours', 'open hours', 'what time are you open', 'are you open'],
    answer: 'Our office is open Monday to Saturday, 8:00 AM to 6:00 PM. You can book and upload payments online any time, and staff reply to messages during office hours.',
  },
  {
    id: 'PRE-02', title: 'Office location', active: true,
    keywords: ['office address', 'where is your office', 'visit your office', 'office location', 'walk in'],
    answer: 'Our office is in Malolos, Bulacan. Message staff before you visit so someone can meet you.',
    link: { label: 'Message staff', to: '/app/messages' },
  },
  {
    id: 'PRE-03', title: 'Discounts for seniors and PWD', active: true,
    keywords: ['senior discount', 'pwd discount', 'senior citizen', 'student discount', 'discount for seniors'],
    answer: 'Tell staff when you book if anyone in your group is a senior citizen or a person with disability. Staff confirm which discounts apply to your trip after checking IDs.',
  },
  {
    id: 'PRE-04', title: 'Bad weather', active: false,
    keywords: ['typhoon', 'bagyo', 'storm signal', 'bad weather'],
    answer: 'If the weather makes travel unsafe, staff contact you before the trip about the next steps.',
  },
]

interface ChatbotState {
  presets: ChatPreset[]
  save: (id: string | null, p: Omit<ChatPreset, 'id' | 'active'>) => { ok: true } | { ok: false; error: string }
  setActive: (id: string, active: boolean) => void
  remove: (id: string) => void
  reset: () => void
}

export function presetError(p: Omit<ChatPreset, 'id' | 'active'>, others: ChatPreset[]): string | null {
  if (p.title.trim().length < 3) return 'Give the answer a short title.'
  const kws = p.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean)
  if (kws.length === 0) return 'Add at least one question or phrase that should trigger this answer.'
  if (kws.some((k) => k.length < 3)) return 'Each trigger phrase needs at least 3 characters.'
  const clash = others.find((o) => o.active && o.keywords.some((k) => kws.includes(k.toLowerCase())))
  if (clash) return `“${clash.title}” already uses one of these phrases.`
  if (p.answer.trim().length < 15) return 'Write the answer customers will see (at least 15 characters).'
  if (p.answer.length > 600) return 'Keep the answer under 600 characters.'
  if (p.link && (!p.link.label.trim() || !p.link.to.startsWith('/app'))) return 'A link needs a label and a page in the customer app (starting with /app).'
  return null
}

export const useChatbot = create<ChatbotState>((set, get) => ({
  presets: startingState().presets ?? structuredClone(SEED),
  save: (id, p) => {
    const err = presetError(p, get().presets.filter((x) => x.id !== id))
    if (err) return { ok: false, error: err }
    const clean = { title: p.title.trim(), keywords: [...new Set(p.keywords.map((k) => k.trim().toLowerCase()).filter(Boolean))], answer: p.answer.trim(), link: p.link?.label.trim() ? p.link : undefined }
    if (id) set({ presets: get().presets.map((x) => (x.id === id ? { ...x, ...clean } : x)) })
    else {
      const n = Math.max(0, ...get().presets.map((x) => Number(x.id.slice(4)))) + 1
      set({ presets: [...get().presets, { id: `PRE-${String(n).padStart(2, '0')}`, active: true, ...clean }] })
    }
    return { ok: true }
  },
  setActive: (id, active) => set({ presets: get().presets.map((x) => (x.id === id ? { ...x, active } : x)) }),
  remove: (id) => set({ presets: get().presets.filter((x) => x.id !== id) }),
  reset: () => set({ presets: structuredClone(SEED) }),
}))
