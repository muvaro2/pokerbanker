// Spreading a chip-count mismatch across players so balances sum to zero.

import type { Balance } from './settle'

export type AdjustMode =
  | { kind: 'proportional' }
  | { kind: 'even' }
  | { kind: 'one'; playerId: string }

export interface PlayerCount {
  id: string
  name: string
  buyIn: number
  stack: number
}

export interface Adjusted extends Balance {
  /** Balance before the mismatch was spread. */
  raw: number
  /** Cents added to (positive) or taken from (negative) this player. */
  adjustment: number
}

/**
 * Mismatch = total stacks − total buy-ins. Every cent of it is taken back out of
 * the players' balances. Leftover cents from uneven division always go in the
 * losers' favour: a cent added goes to the biggest loser first, and a cent taken
 * comes from the biggest winner first. Ties break by name, so it's deterministic.
 */
export function adjustBalances(players: PlayerCount[], mode: AdjustMode): Adjusted[] {
  const raw = players.map((p) => p.stack - p.buyIn)
  const mismatch = players.reduce((s, p) => s + p.stack - p.buyIn, 0)
  const total = -mismatch // amount to add across all balances
  const n = players.length
  const adjustment = new Array<number>(n).fill(0)

  if (n > 0 && total !== 0) {
    if (mode.kind === 'one') {
      const i = players.findIndex((p) => p.id === mode.playerId)
      if (i < 0) throw new Error('Unknown player')
      adjustment[i] = total
    } else {
      const stackTotal = players.reduce((s, p) => s + p.stack, 0)
      const proportional = mode.kind === 'proportional' && stackTotal > 0
      for (let i = 0; i < n; i++) {
        const exact = proportional ? (total * players[i].stack) / stackTotal : total / n
        adjustment[i] = Math.trunc(exact) || 0 // avoid -0
      }
      let leftover = total - adjustment.reduce((s, a) => s + a, 0)
      const step = Math.sign(leftover)
      // Adding: biggest losers first. Taking: biggest winners first.
      const order = players
        .map((_, i) => i)
        .sort((a, b) => step * (raw[a] - raw[b]) || players[a].name.localeCompare(players[b].name))
      for (let k = 0; leftover !== 0; k = (k + 1) % n) {
        adjustment[order[k]] += step
        leftover -= step
      }
    }
  }

  return players.map((p, i) => ({
    id: p.id,
    name: p.name,
    raw: raw[i],
    adjustment: adjustment[i],
    cents: raw[i] + adjustment[i],
  }))
}
