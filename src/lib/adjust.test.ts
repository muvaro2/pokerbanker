import { describe, expect, it } from 'vitest'
import { adjustBalances, type PlayerCount } from './adjust'

const p = (name: string, buyIn: number, stack: number): PlayerCount => ({ id: name, name, buyIn, stack })
const sum = (xs: { cents: number }[]) => xs.reduce((s, x) => s + x.cents, 0)

describe('adjustBalances', () => {
  it('leaves balanced tables alone', () => {
    const out = adjustBalances([p('A', 2000, 3000), p('B', 2000, 1000)], { kind: 'even' })
    expect(out.map((x) => x.adjustment)).toEqual([0, 0])
    expect(out.map((x) => x.cents)).toEqual([1000, -1000])
  })

  it('spreads evenly and takes leftover cents from the biggest winners', () => {
    // 10 cents too many chips across 3 players: −3 each, 1 cent left to take.
    const players = [p('A', 2000, 2500), p('B', 2000, 1510), p('C', 2000, 2000)]
    const out = adjustBalances(players, { kind: 'even' })
    expect(sum(out)).toBe(0)
    expect(out.map((x) => x.adjustment)).toEqual([-4, -3, -3])
  })

  it('spreads evenly and gives leftover cents to the biggest losers', () => {
    // 10 cents short: +3 each, 1 cent to give.
    const players = [p('A', 2000, 2500), p('B', 2000, 1490), p('C', 2000, 2000)]
    const out = adjustBalances(players, { kind: 'even' })
    expect(sum(out)).toBe(0)
    expect(out.map((x) => x.adjustment)).toEqual([3, 4, 3])
  })

  it('spreads proportionally to stacks', () => {
    // $1.00 too many; stacks 30:10:0 → A absorbs 75¢, B 25¢, C nothing.
    const players = [p('A', 2000, 3000), p('B', 1000, 1000), p('C', 900, 0)]
    const out = adjustBalances(players, { kind: 'proportional' })
    expect(sum(out)).toBe(0)
    expect(out.map((x) => x.adjustment)).toEqual([-75, -25, 0])
  })

  it('puts the whole difference on one chosen player', () => {
    const players = [p('A', 2000, 2500), p('B', 2000, 1510)]
    const out = adjustBalances(players, { kind: 'one', playerId: 'B' })
    expect(out.map((x) => x.adjustment)).toEqual([0, -10])
    expect(sum(out)).toBe(0)
  })

  it('breaks ties deterministically by name', () => {
    const players = [p('B', 2000, 2000), p('A', 2000, 2001)]
    // 1 cent too many: A is the bigger winner.
    expect(adjustBalances(players, { kind: 'even' }).map((x) => x.adjustment)).toEqual([0, -1])
    const tied = [p('B', 2000, 2000), p('A', 2000, 2000), p('C', 1999, 2000)]
    // 1 cent too many, all split to 0 each; C is the biggest winner.
    expect(adjustBalances(tied, { kind: 'even' }).map((x) => x.adjustment)).toEqual([0, 0, -1])
  })
})
