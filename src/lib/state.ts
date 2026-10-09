// A room is an append-only event log. Current state is derived by replaying it,
// so concurrent edits never overwrite each other and undo is just skipping an event.

import { formatCents as $ } from './money'

interface Base {
  /** Player ID of whoever performed the action. */
  by: string
  /** Server timestamp (ms). */
  ts: number
}

export type RoomEvent = Base &
  (
    | { t: 'join'; p: string; name: string; pay?: string }
    | { t: 'pay'; p: string; pay: string }
    /** Buy-in change (delta, cents). */
    | { t: 'buyin'; p: string; d: number }
    /** Stack set to a value, or null for "not counted yet". */
    | { t: 'stack'; p: string; v: number | null }
    /** `to` takes `d` cents of chips from `from`. */
    | { t: 'xfer'; from: string; to: string; d: number }
    /**
     * Player leaves with `stack`. With `with`, they settle now: `net` (stack − buy-in
     * at that moment) is paid between them and that player. Without, they're
     * settled with everyone else at the end.
     */
    | { t: 'cashout'; p: string; stack: number; with?: string; net?: number }
    | { t: 'remove'; p: string }
    | { t: 'undo'; target: string }
  )

export type Status = 'active' | 'left' | 'settled' | 'removed'

export interface Player {
  id: string
  name: string
  pay: string
  buyIn: number
  stack: number | null
  status: Status
  /** For settled players: who they settled with and the amount (+ = they received). */
  settledWith?: { id: string; net: number }
}

export interface LogEntry {
  id: string
  ts: number
  text: string
  undone: boolean
  undoable: boolean
}

export interface RoomState {
  players: Player[]
  log: LogEntry[]
}

/** `events` must be in chronological order (Firebase push keys sort that way). */
export function replay(events: [string, RoomEvent][]): RoomState {
  const undone = new Set<string>()
  const byId = new Map(events)
  for (const [, e] of events) {
    if (e.t === 'undo' && isUndoable(byId.get(e.target))) undone.add(e.target)
  }

  const players = new Map<string, Player>()
  const name = (id: string) => players.get(id)?.name ?? '?'
  const log: LogEntry[] = []
  const textOf = new Map<string, string>()

  for (const [id, e] of events) {
    const skip = undone.has(id)
    let text = describe(e, name)
    if (e.t === 'undo') {
      const target = textOf.get(e.target)
      if (target) text = `${name(e.by)} undid: ${target}`
    }
    textOf.set(id, text)
    if (!skip) apply(players, e)
    log.push({ id, ts: e.ts, text, undone: skip, undoable: isUndoable(e) })
  }

  return { players: [...players.values()], log }
}

function isUndoable(e: RoomEvent | undefined): boolean {
  return !!e && e.t !== 'join' && e.t !== 'undo'
}

function apply(players: Map<string, Player>, e: RoomEvent) {
  const get = (id: string) => players.get(id)
  switch (e.t) {
    case 'join':
      players.set(e.p, { id: e.p, name: e.name, pay: e.pay ?? '', buyIn: 0, stack: null, status: 'active' })
      return
    case 'pay': {
      const p = get(e.p)
      if (p) p.pay = e.pay
      return
    }
    case 'buyin': {
      const p = get(e.p)
      if (p) p.buyIn += e.d
      return
    }
    case 'stack': {
      const p = get(e.p)
      if (p) p.stack = e.v
      return
    }
    case 'xfer': {
      const from = get(e.from)
      const to = get(e.to)
      if (from && to) {
        from.buyIn -= e.d
        to.buyIn += e.d
      }
      return
    }
    case 'cashout': {
      const p = get(e.p)
      if (!p) return
      p.stack = e.stack
      if (e.with && e.net !== undefined) {
        const other = get(e.with)
        p.status = 'settled'
        p.settledWith = { id: e.with, net: e.net }
        // If `other` pays the leaver x, `other` has already paid x of what they'll
        // owe, so their buy-in drops by x (and rises by x if they received).
        if (other) other.buyIn -= e.net
      } else {
        p.status = 'left'
      }
      return
    }
    case 'remove': {
      const p = get(e.p)
      if (p) p.status = 'removed'
      return
    }
    case 'undo':
      return
  }
}

function describe(e: RoomEvent, name: (id: string) => string): string {
  const actor = name(e.by)
  const self = (p: string) => e.by === p
  switch (e.t) {
    case 'join':
      return `${e.name} joined`
    case 'pay':
      return self(e.p) ? `${actor} updated their payment info` : `${actor} updated ${name(e.p)}'s payment info`
    case 'buyin': {
      const verb = e.d >= 0 ? `bought in for ${$(e.d)}` : `reduced buy-in by ${$(-e.d)}`
      return self(e.p)
        ? `${actor} ${verb}`
        : `${actor} ${e.d >= 0 ? `added ${$(e.d)} to` : `removed ${$(-e.d)} from`} ${name(e.p)}'s buy-in`
    }
    case 'stack': {
      const value = e.v === null ? 'not counted' : $(e.v)
      return self(e.p) ? `${actor} set their stack to ${value}` : `${actor} set ${name(e.p)}'s stack to ${value}`
    }
    case 'xfer':
      return `${name(e.to)} took ${$(e.d)} in chips from ${name(e.from)}` + (self(e.to) || self(e.from) ? '' : ` (by ${actor})`)
    case 'cashout': {
      const who = name(e.p)
      const base = `${who} cashed out with ${$(e.stack)}`
      if (!e.with || e.net === undefined) return `${base}; settles at the end`
      if (e.net === 0) return `${base}; even, nothing owed`
      return e.net > 0
        ? `${base}; ${name(e.with)} pays ${who} ${$(e.net)}`
        : `${base}; ${who} pays ${name(e.with)} ${$(-e.net)}`
    }
    case 'remove':
      return self(e.p) ? `${actor} left the room` : `${actor} removed ${name(e.p)}`
    case 'undo':
      return `${actor} undid an action`
  }
}

/** Players still part of the end-of-night settlement. */
export function atTable(players: Player[]): Player[] {
  return players.filter((p) => p.status === 'active' || p.status === 'left')
}

/**
 * Who a leaving player should settle with now. If the leaver is owed money, pick
 * whoever looks furthest down; if they owe, whoever looks furthest up. Counted
 * stacks are used when known; otherwise the biggest buy-in is the best guess at
 * who's down (and the smallest at who's up).
 */
export function suggestCounterparty(players: Player[], leaverId: string, net: number): Player | undefined {
  const others = players.filter((p) => p.status === 'active' && p.id !== leaverId)
  const known = (p: Player) => p.stack !== null
  const score = (p: Player) => (known(p) ? p.stack! - p.buyIn : -p.buyIn)
  const dir = net >= 0 ? 1 : -1 // ascending score = furthest down first
  return [...others].sort(
    (a, b) =>
      Number(known(b)) - Number(known(a)) ||
      dir * (score(a) - score(b)) ||
      a.name.localeCompare(b.name),
  )[0]
}
