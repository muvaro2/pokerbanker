# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```sh
npm run dev          # dev server against the REAL Firebase database
npm run emulator     # local Firebase Realtime Database emulator (needs Java), port 9000
npm run dev:local    # dev server against the emulator (run `npm run emulator` first)
npm test             # vitest (all unit tests)
npx vitest run src/lib/settle.test.ts -t "spreads"   # a single file / test
npm run check        # svelte-check + tsc
npm run build        # production build to dist/
```

`.github/workflows/deploy.yml` runs check, tests and build, then deploys `dist/` to GitHub Pages on every push to main/master. In the repo settings, Pages must be set to "GitHub Actions". `vite.config.ts` uses `base: './'` and the app uses hash routes (`#/A5`), so it works from any Pages subpath without 404 handling.

## Architecture

- `src/lib/` is framework-free logic. Everything except `room.ts` is pure and unit tested.
  - `settle.ts`: the settlement algorithm (see below).
  - `adjust.ts`: spreads a chip-count mismatch across balances.
  - `state.ts`: event types, `replay()` (event log → players + log text), `suggestCounterparty()`.
  - `room.ts`: the only Firebase code: room creation, event writes, subscriptions, expiry cleanup, and the local-storage player ID.
  - `money.ts`: integer-cent formatting and parsing.
- `src/components/`: Svelte 5 (runes) UI. `Room.svelte` subscribes to the room, replays the events, and passes `send(event)` down. Settlement is computed client-side on demand and never stored.
- **Data model is an append-only event log** at `rooms/{CODE}/events/{pushId}`, plus `rooms/{CODE}/meta {createdAt, lastActivity}`. Current state is always derived by replaying the events. Never store derived totals.
  - Buy-in edits are stored as deltas, so concurrent edits add up. Stack edits store absolute values.
  - Undo is an `undo` event; `replay` skips the undone event. Joins and undos can't be undone.
  - Cash-out events store the computed `net`, so replay is stable.
  - `sendEvent` writes the event and bumps `lastActivity` in one atomic multi-path update.
- `database.rules.json` (deployed by hand in the Firebase console, or with the firebase CLI) is intentionally permissive: public read/write, code format validated, and `.indexOn meta/lastActivity` for the cleanup query.

## What PokerBanker is

A static website for tracking buy-ins in small home poker cash games and computing how players settle up. It only tracks and does math; no money moves through it. Personal use: performance, optimization and security are explicitly low priority. The site should be **quick and easy**, and **mobile-first** because it will mostly be used on phones.

## Core model

- **Rooms:** "Create" generates a random free 2-character alphanumeric code (case-insensitive). "Join" enters an existing code. Anyone with the code can see and edit everything. There are no accounts or PINs; a device remembers which player it is in local storage. Rooms auto-delete **24 hours after their last activity**.
- **Room size:** realistically up to about 9 players; larger groups split into separate rooms.
- **Players:** name (unique within the room, case-insensitive, not renamable), buy-in total, stack, and an optional free-text payment field (Venmo handle, Zelle number).
  - A stack can be **"not counted yet"**, which must be stored differently from $0.
  - Players can be removed (e.g. someone at $20.35 on a $20 buy-in antes the 35¢ and leaves at break-even). Removal rules:
    - Stack equals buy-in: remove freely.
    - Stack entered but different from buy-in: block with an error telling the user to cash the player out first.
    - No stack entered (e.g. an accidental join): show a soft warning, then allow removal.
- **Money:** whole cents everywhere. The smallest chip is 5¢ or 10¢; amounts never go below 5¢ resolution.
- **Activity log:** every action by everyone is appended to a minimizable log (joins, buy-ins, stack edits including edits to *other* players, transfers, cash-outs, removals). Undo/reversal of a log entry is a nice-to-have if it's easy.

## Settlement algorithm

`settle()` in `src/lib/settle.ts`. Objectives are in **strict priority order**:

1. Minimize the total number of transactions.
2. When counts tie, minimize the maximum number of transactions any single player is involved in.
3. When still tied, minimize the size of the largest transaction.
4. Further tie-breakers, in order:
   - Prefer round amounts (most important of the extras).
   - Avoid tiny payments.
   - Be deterministic, so the same input always gives the same output.

Finding the minimum transaction count is NP-hard: it means partitioning players into the most zero-sum groups, since a group of k players needs k−1 payments. The implementation does a subset DP for the maximum zero-sum partition, enumerates every such partition, enumerates every debtor→creditor spanning tree per group (the amounts on a tree are forced), then minimises the objectives lexicographically. Worst case is about 100 ms at 10 players. Above 14 non-zero players (or 11 in one group) it falls back to greedy matching.

## Decisions on features

- **Early cash-out:** when a player leaves, the default is to settle with them **immediately** so they leave with no further obligations. This can make the final table settlement worse than optimal, which is accepted.
  - The ledger change: if remaining player P pays the leaver d, P's buy-in decreases by d. If the leaver pays P, P's buy-in increases by d.
  - Suggest as the counterparty whoever is currently furthest in the opposite direction.
  - Option: instead lock the leaver's final balance and include it in the end-of-night settlement.
- **Player-to-player chip transfer:** the taker's buy-in goes up by N and the giver's goes down by N. A buy-in may go negative. When it does, display it clearly (e.g. "−$20: you are owed $20 plus your stack").
- **Chip-count mismatch** (total stacks ≠ total buy-ins): flag it and block settlement while players recount. After that, offer "settle anyway" with a choice of how to absorb the difference:
  - (b) proportionally to stacks,
  - (c) evenly across everyone,
  - (d) a chosen player absorbs it.

  There is **no default**: whoever settles must pick an option. Leftover cents always move in the losers' favour: each one reduces the biggest loser's loss, or comes out of the biggest winner's profit. Break ties deterministically (e.g. by name) so the result is always the same. The UI must state plainly which adjustment was applied.
- **Increment buttons** are hidden until the player taps "Edit Buy-in" or "Input Stack Size". Buy-in steps: ±$5, $10, $20. Stack steps: ±10¢, 50¢, $1, $5, $10. Text entry is always available.
- **Concurrency:** simultaneous edits are rare and errors can be caught manually, but use a scheme that doesn't lose concurrent increments if it's easy (e.g. an append-only event log that totals are computed from).
- **Visual style:** minimal; simple shapes and colors; form follows function.

## Hosting and data

- **Hosting:** GitHub Pages (static files only).
- **Data:** Firebase Realtime Database, used directly from the browser. That gives live updates on every phone and queues changes while offline.
  - The Firebase config being visible in the client is expected; rules are the only gate, and they are intentionally permissive.
  - **24h expiry is implemented in app code** because Firebase has no built-in expiry. Each room stores `lastActivity`, updated on every action. Clients treat rooms older than 24h as nonexistent, and whichever client opens the app next deletes them. Creating a room may reuse an expired code.

