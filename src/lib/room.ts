// Firebase Realtime Database access. Layout:
//   rooms/{CODE}/meta   { createdAt, lastActivity }
//   rooms/{CODE}/events/{pushId}  RoomEvent
// Firebase has no TTL, so expiry is done here: rooms whose lastActivity is over
// 24h old are treated as missing, and any client deletes them on startup.

import { initializeApp } from 'firebase/app'
import {
  connectDatabaseEmulator,
  endAt,
  get,
  getDatabase,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  remove,
  runTransaction,
  serverTimestamp,
  update,
  type Unsubscribe,
} from 'firebase/database'
import type { RoomEvent } from './state'

const app = initializeApp({ databaseURL: 'https://pokerbanker-35236-default-rtdb.firebaseio.com' })
const db = getDatabase(app)
// `npm run dev:local` points at the local emulator instead of the real database.
if (import.meta.env.VITE_DB_EMULATOR) connectDatabaseEmulator(db, '127.0.0.1', 9000)

export const ROOM_TTL_MS = 24 * 60 * 60 * 1000
/** Alphabet for generated codes, minus look-alikes (0/O, 1/I/L). Joining accepts any A–Z0–9. */
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

interface Meta {
  createdAt: number
  lastActivity: number
}

let serverOffset = 0
onValue(ref(db, '.info/serverTimeOffset'), (s) => (serverOffset = s.val() ?? 0))
const serverNow = () => Date.now() + serverOffset

const isLive = (meta: Meta | null): meta is Meta => !!meta && serverNow() - meta.lastActivity < ROOM_TTL_MS

export function normalizeCode(text: string): string | null {
  const code = text.trim().toUpperCase()
  return /^[A-Z0-9]{2}$/.test(code) ? code : null
}

export async function roomExists(code: string): Promise<boolean> {
  return isLive((await get(ref(db, `rooms/${code}/meta`))).val())
}

/** Claims a random unused (or expired) code and returns it. */
export async function createRoom(): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const code = Array.from({ length: 2 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('')
    const metaRef = ref(db, `rooms/${code}/meta`)
    const existing: Meta | null = (await get(metaRef)).val()
    if (isLive(existing)) continue
    if (existing) await remove(ref(db, `rooms/${code}`))
    const result = await runTransaction(metaRef, (current: Meta | null) => {
      if (current) return // someone else just took it
      return { createdAt: serverTimestamp(), lastActivity: serverTimestamp() }
    })
    if (result.committed) return code
  }
  throw new Error('Could not find a free room code. Try again.')
}

export type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never
export type NewEvent = DistributiveOmit<RoomEvent, 'by' | 'ts'>

let onWriteError: (e: Error) => void = (e) => console.error(e)
export function setWriteErrorHandler(handler: (e: Error) => void) {
  onWriteError = handler
}

/**
 * Appends an event and bumps the room's lastActivity in one atomic write. The
 * write applies locally at once (and is queued while offline); a rejection from
 * the server is reported through the write-error handler.
 */
export function sendEvent(code: string, by: string, event: NewEvent): string {
  const key = push(ref(db, `rooms/${code}/events`)).key!
  update(ref(db, `rooms/${code}`), {
    [`events/${key}`]: { ...event, by, ts: serverTimestamp() },
    'meta/lastActivity': serverTimestamp(),
  }).catch(onWriteError)
  return key
}

export function newPlayerId(): string {
  return push(ref(db, 'ids')).key!.slice(-10)
}

export interface RoomSnapshot {
  exists: boolean
  events: [string, RoomEvent][]
}

export function watchRoom(
  code: string,
  callback: (room: RoomSnapshot) => void,
  onError: (e: Error) => void,
): Unsubscribe {
  return onValue(
    ref(db, `rooms/${code}`),
    (snap) => {
      const val = snap.val() as { meta?: Meta; events?: Record<string, RoomEvent> } | null
      const events = Object.entries(val?.events ?? {}).sort(([a], [b]) => (a < b ? -1 : 1))
      callback({ exists: isLive(val?.meta ?? null), events })
    },
    onError,
  )
}

/** Deletes rooms idle for over 24h. Best effort; failures are ignored. */
export async function cleanupExpiredRooms(): Promise<void> {
  try {
    const cutoff = serverNow() - ROOM_TTL_MS
    const stale = await get(query(ref(db, 'rooms'), orderByChild('meta/lastActivity'), endAt(cutoff)))
    const updates: Record<string, null> = {}
    stale.forEach((child) => {
      updates[child.key!] = null
    })
    if (Object.keys(updates).length) await update(ref(db, 'rooms'), updates)
  } catch {
    // Expired rooms are already hidden by isLive; deletion can wait for the next visitor.
  }
}

const PLAYER_KEY = (code: string) => `pokerbanker:${code}:player`

export function savedPlayer(code: string): string | null {
  try {
    return localStorage.getItem(PLAYER_KEY(code))
  } catch {
    return null
  }
}

export function savePlayer(code: string, id: string | null) {
  try {
    if (id) localStorage.setItem(PLAYER_KEY(code), id)
    else localStorage.removeItem(PLAYER_KEY(code))
  } catch {
    // Private mode etc.: the player just has to pick their name again on reload.
  }
}
