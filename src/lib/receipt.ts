import type { PaymentMethod } from '../seed/types'
import { fmtStamp, peso } from './format'

// Fictional demo receipts. They are drawn from the payment's own method, amount and reference so the receipt a
// customer attaches and the one staff compare always match. Every receipt is marked as a demonstration.

const STYLE: Record<PaymentMethod, { title: string; band: string; to: string }> = {
  GCash: { title: 'SAMPLE E-WALLET', band: '#1D3A7A', to: '0900 555 0300' },
  Maya: { title: 'SAMPLE E-WALLET', band: '#0F6E5B', to: '0900 555 0301' },
  'Bank transfer': { title: 'SAMPLE BANK TRANSFER', band: '#3A3550', to: 'Acct 0000-1234-5678' },
  Cash: { title: 'SAMPLE CASH RECEIPT', band: '#6B4E16', to: 'TAMS AP office' },
}

const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('')
const letters = (n: number) => Array.from({ length: n }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 30)]).join('')

/** A made-up reference in the shape each method uses (13-digit e-wallet number, Maya code, bank transfer ID). */
export function sampleReference(method: PaymentMethod) {
  if (method === 'GCash') return `${digits(4)} ${digits(3)} ${digits(6)}`
  if (method === 'Maya') return `MY${letters(4)}-${letters(4)}-${digits(2)}`
  if (method === 'Bank transfer') return `IBFT ${digits(4)} ${digits(4)} ${digits(4)}`
  return `OR-${digits(6)}`
}

const esc = (s: string) => s.replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' })[c]!)

/** Data URL of a fictional receipt that shows exactly these payment details. */
export function demoReceiptSrc(p: { method: PaymentMethod; amount: number; reference: string; at: string; note: string; from?: string }) {
  const st = STYLE[p.method]
  const rows: [string, string][] = [
    ['Reference no.', p.reference.trim()],
    ['Date', fmtStamp(p.at)],
    ['Method', p.method],
    ['From', p.from || 'Customer'],
    ['To', st.to],
    ['Note', p.note],
  ]
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 500" font-family="Arial, Helvetica, sans-serif">
<rect width="300" height="500" rx="16" fill="#fff" stroke="#E4E1EE"/>
<path d="M16 0h268a16 16 0 0 1 16 16v72H0V16A16 16 0 0 1 16 0z" fill="${st.band}"/>
<text x="150" y="40" text-anchor="middle" font-size="17" font-weight="700" fill="#fff">${st.title}</text>
<text x="150" y="64" text-anchor="middle" font-size="11.5" fill="#fff" fill-opacity=".85">Fictional receipt · not a real transaction</text>
<text x="150" y="128" text-anchor="middle" font-size="13" fill="#5B5670">Sent to TAMS AP Travel</text>
<text x="150" y="172" text-anchor="middle" font-size="32" font-weight="700" fill="#1E1B2E">${esc(peso(p.amount))}.00</text>
<line x1="24" y1="200" x2="276" y2="200" stroke="#E4E1EE" stroke-dasharray="4 4"/>
<g font-size="12.5" fill="#5B5670">${rows
    .map(([k, v], i) => `<text x="24" y="${232 + i * 30}">${k}</text><text x="276" y="${232 + i * 30}" text-anchor="end" fill="#1E1B2E"${i === 0 ? ' font-weight="700"' : ''}>${esc(v)}</text>`)
    .join('')}</g>
<rect x="24" y="414" width="252" height="58" rx="10" fill="#FFF1D6"/>
<text x="150" y="439" text-anchor="middle" font-size="12" font-weight="700" fill="#9A5B00">SAMPLE RECEIPT</text>
<text x="150" y="457" text-anchor="middle" font-size="11" fill="#9A5B00">Generated from the payment form.</text>
</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
