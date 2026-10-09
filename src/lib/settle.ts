// Settle-up algorithm. Pure: balances in, payments out.
//
// Objectives, in strict priority order:
//   1. Fewest payments.
//   2. Smallest maximum number of payments any one player is involved in.
//   3. Smallest largest payment.
//   4. Roundest amounts, then fewest tiny (< $1) payments, then a deterministic order.
//
// A set of k players whose balances sum to zero can always be settled with k−1
// payments (a tree), so the fewest payments is n − (max number of disjoint
// zero-sum groups). We search those partitions exactly and, within each group,
// enumerate every debtor→creditor payment tree.

export interface Balance {
  id: string
  name: string
  /** Positive: is owed money. Negative: owes money. */
  cents: number
}

export interface Payment {
  from: string
  to: string
  cents: number
}

/** Above this many non-zero players, fall back to greedy matching. */
const MAX_EXACT_PLAYERS = 14
/** Above this many players in one zero-sum group, settle the group greedily. */
const MAX_EXACT_GROUP = 11

interface Candidate {
  payments: Payment[]
  maxDegree: number
  maxAmount: number
  roundPenalty: number
  tinyCount: number
  key: string
}

export function settle(balances: Balance[]): Payment[] {
  const players = balances
    .filter((b) => b.cents !== 0)
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id))
  const total = players.reduce((s, p) => s + p.cents, 0)
  if (total !== 0) throw new Error(`Balances must sum to zero (off by ${total} cents)`)
  if (players.length === 0) return []
  if (players.length > MAX_EXACT_PLAYERS) return sortPayments(greedy(players), players)

  const n = players.length
  const full = (1 << n) - 1
  const sums = new Int32Array(1 << n)
  for (let mask = 1; mask <= full; mask++) {
    const low = mask & -mask
    sums[mask] = sums[mask ^ low] + players[31 - Math.clz32(low)].cents
  }

  // maxGroups[mask]: most zero-sum groups `mask` splits into (-1 if mask isn't zero-sum).
  const maxGroups = new Int8Array(1 << n).fill(-1)
  maxGroups[0] = 0
  const groupsOf = (mask: number): number => {
    if (maxGroups[mask] !== -1 || sums[mask] !== 0) return maxGroups[mask]
    const low = mask & -mask
    const rest = mask ^ low
    let best = 1
    // Proper subsets of `mask` that contain `low`.
    for (let sub = (rest - 1) & rest; ; sub = (sub - 1) & rest) {
      const group = sub | low
      if (sums[group] === 0 && group !== mask) {
        best = Math.max(best, 1 + groupsOf(mask ^ group))
      }
      if (sub === 0) break
    }
    maxGroups[mask] = best
    return best
  }
  groupsOf(full)

  // Every partition of `mask` into the maximum number of zero-sum groups.
  const partitions = (mask: number): number[][] => {
    if (mask === 0) return [[]]
    const low = mask & -mask
    const rest = mask ^ low
    const out: number[][] = []
    for (let sub = rest; ; sub = (sub - 1) & rest) {
      const group = sub | low
      const remaining = mask ^ group
      if (sums[group] === 0 && groupsOf(remaining) === maxGroups[mask] - 1) {
        for (const p of partitions(remaining)) out.push([group, ...p])
      }
      if (sub === 0) break
    }
    return out
  }

  const groupCache = new Map<number, Candidate[]>()
  const candidatesFor = (mask: number): Candidate[] => {
    let c = groupCache.get(mask)
    if (!c) {
      const members = players.filter((_, i) => mask & (1 << i))
      c = groupCandidates(members)
      groupCache.set(mask, c)
    }
    return c
  }

  let best: { score: number[]; key: string; payments: Payment[] } | null = null
  for (const partition of partitions(full)) {
    const groups = partition.map(candidatesFor)
    // Lexicographic minimisation; group choices are independent once the max
    // constraints are fixed, because degrees and amounts don't cross groups.
    const maxDegree = Math.max(...groups.map((g) => Math.min(...g.map((c) => c.maxDegree))))
    const byDegree = groups.map((g) => g.filter((c) => c.maxDegree <= maxDegree))
    const maxAmount = Math.max(...byDegree.map((g) => Math.min(...g.map((c) => c.maxAmount))))
    const chosen = byDegree.map(
      (g) => g.filter((c) => c.maxAmount <= maxAmount).sort(compareCandidates)[0],
    )
    const payments = sortPayments(chosen.flatMap((c) => c.payments), players)
    const score = [
      maxDegree,
      maxAmount,
      chosen.reduce((s, c) => s + c.roundPenalty, 0),
      chosen.reduce((s, c) => s + c.tinyCount, 0),
    ]
    const key = paymentsKey(payments, players)
    if (!best || compareScores(score, key, best.score, best.key) < 0) {
      best = { score, key, payments }
    }
  }
  return best!.payments
}

function compareCandidates(a: Candidate, b: Candidate): number {
  return (
    a.roundPenalty - b.roundPenalty ||
    a.tinyCount - b.tinyCount ||
    (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  )
}

function compareScores(a: number[], aKey: string, b: number[], bKey: string): number {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i] - b[i]
  return aKey < bKey ? -1 : aKey > bKey ? 1 : 0
}

/** 0 for multiples of $5, 1 for whole dollars, 2 for quarters, 3 otherwise. */
export function roundPenalty(cents: number): number {
  if (cents % 500 === 0) return 0
  if (cents % 100 === 0) return 1
  if (cents % 25 === 0) return 2
  return 3
}

/** Every debtor→creditor payment tree that settles a minimal zero-sum group. */
function groupCandidates(members: Balance[]): Candidate[] {
  if (members.length > MAX_EXACT_GROUP) return [toCandidate(greedy(members), members)]
  const debtors = members.filter((m) => m.cents < 0)
  const creditors = members.filter((m) => m.cents > 0)
  const edges: [Balance, Balance][] = []
  for (const d of debtors) for (const c of creditors) edges.push([d, c])

  const need = members.length - 1
  const index = new Map(members.map((m, i) => [m.id, i]))
  const out: Candidate[] = []
  const chosen: [Balance, Balance][] = []

  const parent = members.map((_, i) => i)
  const find = (x: number): number => (parent[x] === x ? x : find(parent[x]))

  const recurse = (start: number) => {
    if (chosen.length === need) {
      const payments = treePayments(members, chosen)
      if (payments) out.push(toCandidate(payments, members))
      return
    }
    for (let e = start; e <= edges.length - (need - chosen.length); e++) {
      const [d, c] = edges[e]
      const rd = find(index.get(d.id)!)
      const rc = find(index.get(c.id)!)
      if (rd === rc) continue
      parent[rd] = rc
      chosen.push(edges[e])
      recurse(e + 1)
      chosen.pop()
      parent[rd] = rd
    }
  }
  recurse(0)
  // A minimal zero-sum group always has at least one valid tree; greedy finds one.
  return out.length ? out : [toCandidate(greedy(members), members)]
}

/** Payment amounts on a spanning tree, or null if any flow runs creditor→debtor. */
function treePayments(members: Balance[], edges: [Balance, Balance][]): Payment[] | null {
  const remaining = new Map(members.map((m) => [m.id, m.cents]))
  const adjacent = new Map(members.map((m) => [m.id, new Set<string>()]))
  for (const [d, c] of edges) {
    adjacent.get(d.id)!.add(c.id)
    adjacent.get(c.id)!.add(d.id)
  }
  const sign = new Map(members.map((m) => [m.id, Math.sign(m.cents)]))
  const payments: Payment[] = []
  const leaves = members.filter((m) => adjacent.get(m.id)!.size === 1).map((m) => m.id)
  while (payments.length < edges.length) {
    const leaf = leaves.pop()!
    const neighbours = adjacent.get(leaf)!
    if (neighbours.size !== 1) continue
    const other = [...neighbours][0]
    const amount = remaining.get(leaf)!
    if (Math.sign(amount) !== sign.get(leaf)) return null
    payments.push(amount < 0 ? { from: leaf, to: other, cents: -amount } : { from: other, to: leaf, cents: amount })
    remaining.set(other, remaining.get(other)! + amount)
    remaining.set(leaf, 0)
    neighbours.delete(other)
    adjacent.get(other)!.delete(leaf)
    if (adjacent.get(other)!.size === 1) leaves.push(other)
  }
  return payments
}

function toCandidate(payments: Payment[], members: Balance[]): Candidate {
  const degree = new Map<string, number>()
  for (const p of payments) {
    degree.set(p.from, (degree.get(p.from) ?? 0) + 1)
    degree.set(p.to, (degree.get(p.to) ?? 0) + 1)
  }
  const sorted = sortPayments(payments, members)
  return {
    payments: sorted,
    maxDegree: Math.max(0, ...degree.values()),
    maxAmount: Math.max(0, ...payments.map((p) => p.cents)),
    roundPenalty: payments.reduce((s, p) => s + roundPenalty(p.cents), 0),
    tinyCount: payments.filter((p) => p.cents < 100).length,
    key: paymentsKey(sorted, members),
  }
}

/** Largest debtor pays largest creditor until everyone is square. */
function greedy(members: Balance[]): Payment[] {
  const debtors = members.filter((m) => m.cents < 0).map((m) => ({ id: m.id, left: -m.cents }))
  const creditors = members.filter((m) => m.cents > 0).map((m) => ({ id: m.id, left: m.cents }))
  const payments: Payment[] = []
  while (debtors.length && creditors.length) {
    debtors.sort((a, b) => b.left - a.left)
    creditors.sort((a, b) => b.left - a.left)
    const d = debtors[0]
    const c = creditors[0]
    const amount = Math.min(d.left, c.left)
    payments.push({ from: d.id, to: c.id, cents: amount })
    d.left -= amount
    c.left -= amount
    if (d.left === 0) debtors.shift()
    if (c.left === 0) creditors.shift()
  }
  return payments
}

function sortPayments(payments: Payment[], members: Balance[]): Payment[] {
  const name = new Map(members.map((m) => [m.id, m.name]))
  return [...payments].sort(
    (a, b) =>
      name.get(a.from)!.localeCompare(name.get(b.from)!) ||
      name.get(a.to)!.localeCompare(name.get(b.to)!) ||
      a.cents - b.cents,
  )
}

function paymentsKey(payments: Payment[], members: Balance[]): string {
  const name = new Map(members.map((m) => [m.id, m.name]))
  return payments.map((p) => `${name.get(p.from)}>${name.get(p.to)}:${p.cents}`).join('|')
}
