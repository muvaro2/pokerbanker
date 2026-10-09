<script lang="ts">
  import { formatCents } from '../lib/money'
  import type { NewEvent } from '../lib/room'
  import type { Player } from '../lib/state'
  import AmountEditor from './AmountEditor.svelte'
  import CashOut from './CashOut.svelte'

  interface Props {
    player: Player
    players: Player[]
    isMe: boolean
    canAct: boolean
    send: (event: NewEvent) => void
  }
  let { player, players, isMe, canAct, send }: Props = $props()

  const BUY_IN_STEPS = [500, 1000, 2000]
  const STACK_STEPS = [10, 50, 100, 500, 1000]

  type Mode = 'buyin' | 'stack' | 'xfer' | 'cashout' | 'pay' | 'remove' | null
  let expanded = $state(false)
  let mode = $state<Mode>(null)

  const name = (id: string) => players.find((p) => p.id === id)?.name ?? '?'
  const net = $derived(player.stack === null ? null : player.stack - player.buyIn)
  const others = $derived(players.filter((p) => p.status === 'active' && p.id !== player.id))

  function close() {
    mode = null
  }

  // Buy-in edits are sent as a change from the value when the editor opened, so
  // simultaneous edits from two phones add up instead of overwriting.
  let buyInAtOpen = 0
  function openBuyIn() {
    buyInAtOpen = player.buyIn
    mode = 'buyin'
  }
  function saveBuyIn(v: number | null) {
    const d = (v ?? 0) - buyInAtOpen
    if (d !== 0) send({ t: 'buyin', p: player.id, d })
    close()
  }

  function saveStack(v: number | null) {
    if (v !== player.stack) send({ t: 'stack', p: player.id, v })
    close()
  }

  // svelte-ignore state_referenced_locally
  let xferFrom = $state('')
  function saveXfer(v: number | null) {
    if (v && xferFrom) send({ t: 'xfer', from: xferFrom, to: player.id, d: v })
    close()
  }

  // svelte-ignore state_referenced_locally
  let payText = $state(player.pay)
  function savePay(event: SubmitEvent) {
    event.preventDefault()
    if (payText.trim() !== player.pay) send({ t: 'pay', p: player.id, pay: payText.trim() })
    close()
  }

  const removeCheck = $derived.by(() => {
    if (player.stack === null)
      return { ok: true, warn: `No stack has been entered for ${player.name}. Remove them as an accidental join?` }
    if (player.stack === player.buyIn)
      return { ok: true, warn: `Remove ${player.name}? Their stack matches their buy-in, so nothing is owed.` }
    return {
      ok: false,
      warn: `${player.name}'s stack (${formatCents(player.stack)}) doesn't match their buy-in (${formatCents(player.buyIn)}). Cash them out first.`,
    }
  })

  function toggle() {
    expanded = !expanded
    if (!expanded) close()
  }
</script>

<article class="card player" class:me={isMe} class:inactive={player.status !== 'active'}>
  <button class="player-summary" onclick={toggle} aria-expanded={expanded}>
    <div class="player-name">
      <strong>{player.name}</strong>
      {#if isMe}<span class="badge">you</span>{/if}
      {#if player.status === 'left'}<span class="badge">left · settles at end</span>{/if}
      {#if player.status === 'settled'}<span class="badge">settled</span>{/if}
    </div>
    <div class="stats">
      <div><span class="muted small">Buy-in</span><br />{formatCents(player.buyIn)}</div>
      <div><span class="muted small">Stack</span><br />{player.stack === null ? '—' : formatCents(player.stack)}</div>
      <div>
        <span class="muted small">Net</span><br />
        {#if net === null}—{:else}<span class:pos={net > 0} class:neg={net < 0}>{net > 0 ? '+' : ''}{formatCents(net)}</span>{/if}
      </div>
    </div>
  </button>

  {#if player.buyIn < 0 && player.status !== 'settled'}
    <p class="small note">
      Negative buy-in: {player.name} gave away more chips than they bought, so they're owed
      {formatCents(-player.buyIn)} plus whatever their stack is worth.
    </p>
  {/if}
  {#if player.status === 'settled' && player.settledWith}
    {@const s = player.settledWith}
    <p class="small muted">
      {#if s.net > 0}{name(s.id)} paid {player.name} {formatCents(s.net)}.
      {:else if s.net < 0}{player.name} paid {name(s.id)} {formatCents(-s.net)}.
      {:else}Left even; nothing owed.{/if}
    </p>
  {/if}
  {#if player.pay}<p class="small muted pay">Pay: {player.pay}</p>{/if}

  {#if expanded && canAct && player.status !== 'settled'}
    {#if mode === null}
      <div class="actions">
        <button onclick={openBuyIn}>Edit Buy-in</button>
        <button onclick={() => (mode = 'stack')}>Input Stack Size</button>
        {#if player.status === 'active'}
          <button onclick={() => ((xferFrom = others[0]?.id ?? ''), (mode = 'xfer'))} disabled={!others.length}>Take chips from…</button>
          <button onclick={() => (mode = 'cashout')}>Cash out</button>
        {/if}
        <button onclick={() => ((payText = player.pay), (mode = 'pay'))}>Payment info</button>
        <button class="danger" onclick={() => (mode = 'remove')}>Remove</button>
      </div>
    {:else if mode === 'buyin'}
      <AmountEditor
        label="Total buy-in"
        initial={player.buyIn}
        steps={BUY_IN_STEPS}
        allowNegative
        note={(v) => {
          const d = (v ?? 0) - buyInAtOpen
          return d === 0 ? 'No change' : `Change: ${d > 0 ? '+' : ''}${formatCents(d)}`
        }}
        onsave={saveBuyIn}
        oncancel={close}
      />
    {:else if mode === 'stack'}
      <AmountEditor label="Stack" initial={player.stack} steps={STACK_STEPS} allowEmpty onsave={saveStack} oncancel={close} />
    {:else if mode === 'xfer'}
      <label class="field">
        <span>{player.name} takes chips from</span>
        <select bind:value={xferFrom}>
          {#each others as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
        </select>
      </label>
      <AmountEditor
        label="Amount"
        initial={0}
        steps={BUY_IN_STEPS}
        saveLabel="Transfer"
        note={(v) =>
          v ? `${player.name}'s buy-in +${formatCents(v)}, ${name(xferFrom)}'s buy-in −${formatCents(v)}` : 'Enter an amount'}
        onsave={saveXfer}
        oncancel={close}
      />
    {:else if mode === 'cashout'}
      <CashOut {player} {players} {send} steps={STACK_STEPS} onclose={close} />
    {:else if mode === 'pay'}
      <form class="editor" onsubmit={savePay}>
        <input bind:value={payText} placeholder="Venmo / Zelle" maxlength="60" />
        <div class="row">
          <button type="button" onclick={close}>Cancel</button>
          <button type="submit" class="primary">Save</button>
        </div>
      </form>
    {:else if mode === 'remove'}
      <div class="editor">
        <p class:error={!removeCheck.ok} class="small">{removeCheck.warn}</p>
        <div class="row">
          <button onclick={close}>Cancel</button>
          {#if removeCheck.ok}
            <button class="danger" onclick={() => (send({ t: 'remove', p: player.id }), close())}>Remove</button>
          {:else if player.status === 'active'}
            <button class="primary" onclick={() => (mode = 'cashout')}>Cash out</button>
          {/if}
        </div>
      </div>
    {/if}
  {/if}
</article>
