<script lang="ts">
  import { formatCents } from '../lib/money'
  import type { NewEvent } from '../lib/room'
  import { suggestCounterparty, type Player } from '../lib/state'
  import AmountEditor from './AmountEditor.svelte'

  interface Props {
    player: Player
    players: Player[]
    steps: number[]
    send: (event: NewEvent) => void
    onclose: () => void
  }
  let { player, players, steps, send, onclose }: Props = $props()

  let stack = $state<number | null>(null)
  let when = $state<'now' | 'later'>('now')
  let withId = $state('')

  const net = $derived(stack === null ? 0 : stack - player.buyIn)
  const others = $derived(players.filter((p) => p.status === 'active' && p.id !== player.id))
  const counterparty = $derived(others.find((p) => p.id === withId))

  function chooseStack(v: number | null) {
    stack = v
    const n = (v ?? 0) - player.buyIn
    withId = suggestCounterparty(players, player.id, n)?.id ?? ''
    if (n !== 0 && !others.length) when = 'later'
  }

  function confirm() {
    if (stack === null) return
    if (when === 'later') send({ t: 'cashout', p: player.id, stack })
    else if (net === 0) send({ t: 'cashout', p: player.id, stack, with: player.id, net: 0 })
    else if (counterparty) send({ t: 'cashout', p: player.id, stack, with: counterparty.id, net })
    onclose()
  }
</script>

{#if stack === null}
  <AmountEditor
    label="{player.name} is leaving with"
    initial={player.stack}
    {steps}
    saveLabel="Next"
    note={(v) => {
      if (v === null) return 'Enter their final stack'
      const n = v - player.buyIn
      return n === 0 ? 'Even' : n > 0 ? `Up ${formatCents(n)}` : `Down ${formatCents(-n)}`
    }}
    onsave={chooseStack}
    oncancel={onclose}
  />
{:else}
  <div class="editor">
    <p>
      {player.name} leaves with {formatCents(stack)} on a {formatCents(player.buyIn)} buy-in:
      <strong>{net === 0 ? 'even' : net > 0 ? `up ${formatCents(net)}` : `down ${formatCents(-net)}`}</strong>.
    </p>
    {#if net !== 0}
      <label class="radio">
        <input type="radio" bind:group={when} value="now" disabled={!others.length} />
        <span>Settle now</span>
      </label>
      {#if when === 'now'}
        <label class="field indent">
          <span>{net > 0 ? 'Paid by' : 'Pays'}</span>
          <select bind:value={withId}>
            {#each others as o (o.id)}<option value={o.id}>{o.name}</option>{/each}
          </select>
        </label>
        {#if counterparty}
          {@const payee = net > 0 ? player : counterparty}
          <p class="indent">
            <strong>
              {net > 0 ? counterparty.name : player.name} pays {payee.name} {formatCents(Math.abs(net))}
            </strong>
            {#if payee.pay}<br /><span class="small muted">{payee.name}: {payee.pay}</span>{/if}
          </p>
          <p class="indent small muted">
            {counterparty.name}'s buy-in will {net > 0 ? 'drop' : 'rise'} by {formatCents(Math.abs(net))} to account for it.
          </p>
        {/if}
      {/if}
      <label class="radio">
        <input type="radio" bind:group={when} value="later" />
        <span>Settle at the end of the night</span>
      </label>
    {/if}
    <div class="row">
      <button onclick={() => (stack = null)}>Back</button>
      <button class="primary" onclick={confirm} disabled={when === 'now' && net !== 0 && !counterparty}>Cash out</button>
    </div>
  </div>
{/if}
