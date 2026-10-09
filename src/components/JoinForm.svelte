<script lang="ts">
  import type { Player } from '../lib/state'

  interface Props {
    players: Player[]
    onjoin: (name: string, pay: string) => void
    onclaim: (id: string) => void
  }
  let { players, onjoin, onclaim }: Props = $props()

  let name = $state('')
  let pay = $state('')
  let error = $state('')

  // Names must be unique among players still in the game.
  const inGame = $derived(players.filter((p) => p.status === 'active' || p.status === 'left'))
  const taken = $derived(inGame.find((p) => p.name.toLowerCase() === name.trim().toLowerCase()))

  function submit(event: SubmitEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) error = 'Enter your name.'
    else if (taken) error = `${taken.name} is already in this room. If that's you, tap your name below.`
    else onjoin(trimmed, pay.trim())
  }
</script>

<section class="card join-form">
  <h2>Join this room</h2>
  <form onsubmit={submit}>
    <input bind:value={name} placeholder="Your name" maxlength="20" autocomplete="nickname" />
    <input bind:value={pay} placeholder="Venmo / Zelle (optional)" maxlength="60" />
    <button type="submit" class="primary wide">Join</button>
  </form>
  {#if error}<p class="error small">{error}</p>{/if}
  {#if inGame.length}
    <p class="muted small">Already joined on another device? Tap your name:</p>
    <div class="row wrap">
      {#each inGame as p (p.id)}
        <button onclick={() => onclaim(p.id)}>{p.name}</button>
      {/each}
    </div>
  {/if}
</section>
