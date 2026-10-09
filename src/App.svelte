<script lang="ts">
  import { onMount } from 'svelte'
  import Home from './components/Home.svelte'
  import Room from './components/Room.svelte'
  import { cleanupExpiredRooms, normalizeCode } from './lib/room'

  // Routes: "#/A5" is room A5; anything else is the home screen.
  const codeFromHash = () => normalizeCode(location.hash.replace(/^#\/?/, ''))
  let code = $state(codeFromHash())

  onMount(() => {
    const onHash = () => (code = codeFromHash())
    addEventListener('hashchange', onHash)
    void cleanupExpiredRooms()
    return () => removeEventListener('hashchange', onHash)
  })
</script>

{#if code}
  {#key code}
    <Room {code} />
  {/key}
{:else}
  <Home />
{/if}
