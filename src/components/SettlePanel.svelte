<script lang="ts">
  import { adjustBalances, type AdjustMode } from '../lib/adjust'
  import { formatCents } from '../lib/money'
  import { settle } from '../lib/settle'
  import { atTable, type Player } from '../lib/state'

  let { players }: { players: Player[] } = $props()

  let open = $state(false)
  let anyway = $state(false)
  let modeKind = $state<AdjustMode['kind'] | ''>('')
  let absorber = $state('')

  const table = $derived(atTable(players))
  const missing = $derived(table.filter((p) => p.stack === null))
  const totalBuyIn = $derived(table.reduce((s, p) => s + p.buyIn, 0))
  const totalStack = $derived(table.reduce((s, p) => s + (p.stack ?? 0), 0))
  const mismatch = $derived(totalStack - totalBuyIn)
  const settledEarly = $derived(players.filter((p) => p.status === 'settled'))

  const mode = $derived.by((): AdjustMode | null => {
    if (mismatch === 0) return { kind: 'even' } // no-op
    if (!anyway || !modeKind) return null
    if (modeKind === 'one') return absorber ? { kind: 'one', playerId: absorber } : null
    return { kind: modeKind }
  })

  const result = $derived.by(() => {
    if (missing.length || !mode) return null
    const balances = adjustBalances(
      table.map((p) => ({ id: p.id, name: p.name, buyIn: p.buyIn, stack: p.stack! })),
      mode,
    )
    return { balances, payments: settle(balances) }
  })

  const byId = $derived(new Map(players.map((p) => [p.id, p])))
  const modeLabel: Record<AdjustMode['kind'], string> = {
    proportional: 'in proportion to each stack',
    even: 'evenly across everyone',
    one: 'by one player',
  }
</script>

<section class="card settle">
  {#if !open}
    <button class="primary wide" onclick={() => (open = true)}>Settle up the table</button>
  {:else}
    <div class="row space">
      <h2>Settle up</h2>
      <button class="link" onclick={() => (open = false)}>Hide</button>
    </div>

    {#if missing.length}
      <p class="error">Waiting on stack counts from {missing.map((p) => p.name).join(', ')}.</p>
    {:else}
      {#if mismatch !== 0}
        <div class="warning">
          <p>
            <strong>Chips don't match buy-ins.</strong> Counted {formatCents(totalStack)} vs. {formatCents(totalBuyIn)} bought
            in ({mismatch > 0 ? 'over' : 'short'} by {formatCents(Math.abs(mismatch))}). Everyone should recount.
          </p>
          {#if !anyway}
            <button onclick={() => (anyway = true)}>Still off after recounting? Settle anyway</button>
          {:else}
            <p class="small">How should the {formatCents(Math.abs(mismatch))} be absorbed?</p>
            <label class="radio"><input type="radio" bind:group={modeKind} value="proportional" /> In proportion to each stack</label>
            <label class="radio"><input type="radio" bind:group={modeKind} value="even" /> Evenly across everyone</label>
            <label class="radio"><input type="radio" bind:group={modeKind} value="one" /> One player absorbs it</label>
            {#if modeKind === 'one'}
              <select class="indent" bind:value={absorber}>
                <option value="" disabled>Choose a player</option>
                {#each table as p (p.id)}<option value={p.id}>{p.name}</option>{/each}
              </select>
            {/if}
          {/if}
        </div>
      {/if}

      {#if result}
        {#if result.payments.length === 0}
          <p>Everyone is even. Nothing to pay.</p>
        {:else}
          <ol class="payments">
            {#each result.payments as pay, i (i)}
              {@const to = byId.get(pay.to)}
              <li>
                <div><strong>{byId.get(pay.from)?.name}</strong> pays <strong>{to?.name}</strong></div>
                <div class="amount">{formatCents(pay.cents)}</div>
                {#if to?.pay}<div class="small muted">{to.name}: {to.pay}</div>{/if}
              </li>
            {/each}
          </ol>
        {/if}

        {#if mismatch !== 0 && mode}
          <p class="small">
            The {formatCents(Math.abs(mismatch))} {mismatch > 0 ? 'extra' : 'missing'} was absorbed {modeLabel[mode.kind]}{mode.kind ===
            'one'
              ? ` (${byId.get(absorber)?.name})`
              : ''}. Leftover cents went to the biggest losers or came from the biggest winners.
          </p>
          <table class="adjustments small">
            <thead><tr><th>Player</th><th>Net</th><th>Adjust</th><th>Final</th></tr></thead>
            <tbody>
              {#each result.balances as b (b.id)}
                <tr>
                  <td>{b.name}</td>
                  <td>{formatCents(b.raw)}</td>
                  <td>{b.adjustment > 0 ? '+' : ''}{formatCents(b.adjustment)}</td>
                  <td>{formatCents(b.cents)}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        {/if}
      {/if}
    {/if}

    {#if settledEarly.length}
      <p class="small muted">Already settled and not included: {settledEarly.map((p) => p.name).join(', ')}.</p>
    {/if}
  {/if}
</section>
