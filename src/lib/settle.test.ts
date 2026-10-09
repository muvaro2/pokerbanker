import { describe, expect, it } from 'vitest'
import { settle, type Balance, type Payment } from './settle'

const b = (name: string, cents: number): Balance => ({ id: name, name, cents })

function applyPayments(balances: Balance[], payments: Payment[]): Map<string, number> {
  const left = new Map(balances.map((x) => [x.id, x.cents]))
  for (const p of payments) {
    expect(p.cents).toBeGreaterThan(0)
    left.set(p.from, left.get(p.from)! + p.cents)
    left.set(p.to, left.get(p.to)! - p.cents)
  }
  return left
}

function expectSettles(balances: Balance[], payments: Payment[]) {
  for (const v of applyPayments(balances, payments).values()) expect(v).toBe(0)
}

function maxDegree(payments: Payment[]): number {
  const d = new Map<string, number>()
  for (const p of payments) {
    d.set(p.from, (d.get(p.from) ?? 0) + 1)
    d.set(p.to, (d.get(p.to) ?? 0) + 1)
  }
  return Math.max(0, ...d.values())
}

describe('settle', () => {
  it('returns nothing when everyone is even', () => {
    expect(settle([b('A', 0), b('B', 0)])).toEqual([])
    expect(settle([])).toEqual([])
  })

  it('rejects balances that do not sum to zero', () => {
    expect(() => settle([b('A', 100), b('B', -50)])).toThrow()
  })

  it('settles a simple pair', () => {
    expect(settle([b('A', -2000), b('B', 2000)])).toEqual([{ from: 'A', to: 'B', cents: 2000 }])
  })

  it('finds independent zero-sum groups to minimise payment count', () => {
    // {B, E} and {A, C, D} each settle internally: 1 + 2 payments.
    const balances = [b('A', -1000), b('B', -700), b('C', 300), b('D', 700), b('E', 700)]
    const payments = settle(balances)
    expectSettles(balances, payments)
    expect(payments).toHaveLength(3)
  })

  it('pairs exact matches', () => {
    const balances = [b('A', -530), b('B', 530), b('C', -2050), b('D', 2050), b('E', -1300), b('F', 1300)]
    const payments = settle(balances)
    expect(payments).toHaveLength(3)
    expectSettles(balances, payments)
  })

  it('spreads payments so no one player makes them all when counts tie', () => {
    // One debtor owing three creditors needs 3 payments either way, but here
    // two debtors can split the work instead of one player paying everyone.
    const balances = [b('A', -1500), b('B', -1500), b('C', 1000), b('D', 1000), b('E', 1000)]
    const payments = settle(balances)
    expectSettles(balances, payments)
    expect(payments).toHaveLength(4)
    expect(maxDegree(payments)).toBe(2)
  })

  it('minimises the largest payment once count and spread tie', () => {
    const balances = [b('A', -1000), b('B', -1000), b('C', 500), b('D', 1500)]
    const payments = settle(balances)
    expectSettles(balances, payments)
    expect(payments).toHaveLength(3)
    expect(Math.max(...payments.map((p) => p.cents))).toBe(1000)
  })

  it('is deterministic regardless of input order', () => {
    const balances = [b('A', -1234), b('B', -866), b('C', 500), b('D', 1100), b('E', 500)]
    const first = settle(balances)
    expect(settle([...balances].reverse())).toEqual(first)
    expectSettles(balances, first)
  })

  it('handles a full table of 9 quickly', () => {
    const balances = [
      b('A', -2000), b('B', -1735), b('C', -620), b('D', -45), b('E', 1210),
      b('F', 990), b('G', 1580), b('H', 345), b('I', 275),
    ]
    const start = performance.now()
    const payments = settle(balances)
    expect(performance.now() - start).toBeLessThan(2000)
    expectSettles(balances, payments)
    expect(payments.length).toBeLessThanOrEqual(8)
  })

  it('falls back to a valid settlement for very large tables', () => {
    const balances = Array.from({ length: 16 }, (_, i) => b(`P${String(i).padStart(2, '0')}`, i < 8 ? -(i + 1) * 100 : (i - 7) * 100))
    expectSettles(balances, settle(balances))
  })
})
