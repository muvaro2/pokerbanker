<script lang="ts">
  import { onDestroy } from 'svelte'
  import { formatCents } from '../lib/money'
  import { newPlayerId, savePlayer, savedPlayer, sendEvent, setWriteErrorHandler, watchRoom, type NewEvent, type RoomSnapshot } from '../lib/room'
  import { atTable, replay } from '../lib/state'
  import JoinForm from './JoinForm.svelte'
  import LogPanel from './LogPanel.svelte'
  import PlayerCard from './PlayerCard.svelte'
  import SettlePanel from './SettlePanel.svelte'

  let { code }: { code: string } = $props()

  let snapshot = $state<RoomSnapshot | null>(null)
  let error = $state('')
  // svelte-ignore state_referenced_locally
  let me = $state(savedPlayer(code))

  // svelte-ignore state_referenced_locally
  const unsubscribe = watchRoom(code, (s) => (snapshot = s), (e) => (error = e.message))
  onDestroy(unsubscribe)
  setWriteErrorHandler((e) => (error = e.message))

  const room = $derived(replay(snapshot?.events ?? []))
  const players = $derived(room.players)
  const mePlayer = $derived(players.find((p) => p.id === me && p.status !== 'removed'))
  const visible = $derived(
    players
      .filter((p) => p.status !== 'removed')
      .sort((a, b) => Number(b.id === me) - Number(a.id === me) || statusRank(a) - statusRank(b)),
  )
  const table = $derived(atTable(players))
  const totalBuyIn = $derived(table.reduce((s, p) => s + p.buyIn, 0))
  const counted = $derived(table.filter((p) => p.stack !== null))
  const totalStack = $derived(counted.reduce((s, p) => s + p.stack!, 0))

  function statusRank(p: { status: string }) {
    return ['active', 'left', 'settled'].indexOf(p.status)
  }

  function send(event: NewEvent): string {
    return sendEvent(code, me ?? 'unknown', event)
  }

  function joinAs(name: string, pay: string) {
    const id = newPlayerId()
    me = id
    savePlayer(code, id)
    sendEvent(code, id, { t: 'join', p: id, name, ...(pay ? { pay } : {}) })
  }

  function claim(id: string) {
    me = id
    savePlayer(code, id)
  }

  function leaveRoom() {
    location.hash = ''
  }

  let copied = $state(false)
  async function share() {
    const url = location.href
    try {
      if (navigator.share) await navigator.share({ title: `PokerBanker room ${code}`, url })
      else {
        await navigator.clipboard.writeText(url)
        copied = true
        setTimeout(() => (copied = false), 1500)
      }
    } catch {
      // Share sheet dismissed.
    }
  }
</script>

<header class="room-header">
  <button class="link" onclick={leaveRoom} aria-label="Back to home">←</button>
  <div class="room-code">Room <strong>{code}</strong></div>
  <button class="link" onclick={share}>{copied ? 'Copied' : 'Share'}</button>
</header>

<main class="room">
  {#if error}
    <p class="error">Server error: {error}</p>
  {/if}
  {#if !snapshot}
    <p class="muted">Loading…</p>
  {:else if !snapshot.exists}
    <p>Room {code} doesn't exist or has expired.</p>
    <button onclick={leaveRoom}>Back</button>
  {:else}
    {#if !mePlayer}
      <JoinForm {players} onjoin={joinAs} onclaim={claim} />
    {/if}

    <div class="totals">
      <div><span class="muted small">Buy-ins</span><br />{formatCents(totalBuyIn)}</div>
      <div>
        <span class="muted small">Counted ({counted.length}/{table.length})</span><br />
        {counted.length ? formatCents(totalStack) : '—'}
      </div>
    </div>

    <ul class="players">
      {#each visible as player (player.id)}
        <li>
          <PlayerCard {player} {players} isMe={player.id === me} canAct={!!mePlayer} {send} />
        </li>
      {/each}
    </ul>

    {#if table.length}
      <SettlePanel {players} />
    {/if}
  {/if}
</main>

{#if snapshot?.exists}
  <LogPanel log={room.log} canAct={!!mePlayer} onundo={(target) => send({ t: 'undo', target })} />
{/if}
