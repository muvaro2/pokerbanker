// All money is integer cents.

export function formatCents(cents: number): string {
  const sign = cents < 0 ? '−' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rem = String(abs % 100).padStart(2, '0')
  return `${sign}$${dollars.toLocaleString('en-US')}.${rem}`
}

/** Parses "20", "20.5", "$20.35", "-5" into cents. Returns null if invalid. */
export function parseCents(text: string): number | null {
  const s = text.trim().replace(/[$,\s]/g, '').replace('−', '-')
  if (!/^-?(\d+(\.\d{0,2})?|\.\d{1,2})$/.test(s)) return null
  const neg = s.startsWith('-')
  const [whole, frac = ''] = s.replace('-', '').split('.')
  const cents = Number(whole || '0') * 100 + Number(frac.padEnd(2, '0'))
  return neg ? -cents : cents
}

/** Text for a cents value in an input field (no $ sign). */
export function centsToInput(cents: number | null): string {
  if (cents === null) return ''
  return (cents / 100).toFixed(2)
}
