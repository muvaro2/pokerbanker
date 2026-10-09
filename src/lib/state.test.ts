import { describe, expect, it } from 'vitest'
import { replay, suggestCounterparty, type RoomEvent } from './state'

let n = 0
const ev = (e: RoomEvent): [string, RoomEvent] => [`e${String(n++).padStart(4, '0')}`, e]
const join = (p: string) => ev({ t: 'join', p, name: p.toUpperCase(), by: p, ts: 0 })

describe('replay', () => {
  it('tracks buy-ins, stacks and chip transfers', () => {
    const { players } = replay([
      join('a'),
      join('b'),
      ev({ t: 'buyin', p: 'a', d: 2000, by: 'a', ts: 0 }),
      ev({ t: 'buyin', p: 'b', d: 2000, by: 'a', ts: 0 }),
      ev({ t: 'xfer', from: 'b', to: 'a', d: 1000, by: 'a', ts: 0 }),
      ev({ t: 'stack', p: 'a', v: 3550, by: 'a', ts: 0 }),
    ])
    expect(players.map((p) => [p.buyIn, p.stack])).toEqual([[3000, 3550], [1000, null]])
  })

  it('cash-out now moves the leaver’s net onto the counterparty’s buy-in', () => {
    const { players } = replay([
      join('a'),
      join('b'),
      ev({ t: 'buyin', p: 'a', d: 2000, by: 'a', ts: 0 }),
      ev({ t: 'buyin', p: 'b', d: 2000, by: 'b', ts: 0 }),
      ev({ t: 'cashout', p: 'a', stack: 3000, with: 'b', net: 1000, by: 'a', ts: 0 }),
    ])
    const [a, b] = players
    expect(a.status).toBe('settled')
    // B paid A $10 already, so B's $10 stack now means B is even.
    expect(b.buyIn).toBe(1000)
  })

  it('undo skips the target event and labels the log', () => {
    const events = [join('a'), ev({ t: 'buyin', p: 'a', d: 2000, by: 'a', ts: 0 })]
    const target = events[1][0]
    events.push(ev({ t: 'undo', target, by: 'a', ts: 0 }))
    const { players, log } = replay(events)
    expect(players[0].buyIn).toBe(0)
    expect(log[1].undone).toBe(true)
    expect(log[2].text).toBe('A undid: A bought in for $20.00')
  })

  it('cannot undo a join', () => {
    const events = [join('a')]
    events.push(ev({ t: 'undo', target: events[0][0], by: 'a', ts: 0 }))
    expect(replay(events).players).toHaveLength(1)
  })
})

describe('suggestCounterparty', () => {
  it('prefers counted stacks, then the biggest buy-in, for a winner leaving', () => {
    const { players } = replay([
      join('a'), join('b'), join('c'),
      ev({ t: 'buyin', p: 'b', d: 6000, by: 'b', ts: 0 }),
      ev({ t: 'buyin', p: 'c', d: 2000, by: 'c', ts: 0 }),
    ])
    expect(suggestCounterparty(players, 'a', 500)?.id).toBe('b')
    expect(suggestCounterparty(players, 'a', -500)?.id).toBe('c')
  })
})
