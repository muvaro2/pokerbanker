<script lang="ts">
  import { createRoom, normalizeCode, roomExists } from '../lib/room'

  let joinText = $state('')
  let error = $state('')
  let busy = $state(false)

  async function create() {
    busy = true
    error = ''
    try {
      location.hash = `/${await createRoom()}`
    } catch (e) {
      error = e instanceof Error ? e.message : 'Could not create a room.'
    } finally {
      busy = false
    }
  }

  async function join(event: SubmitEvent) {
    event.preventDefault()
    const code = normalizeCode(joinText)
    if (!code) {
      error = 'Room codes are 2 letters or numbers, like A5.'
      return
    }
    busy = true
    error = ''
    try {
      if (await roomExists(code)) location.hash = `/${code}`
      else error = `Room ${code} doesn't exist or has expired.`
    } catch {
      error = 'Could not reach the server.'
    } finally {
      busy = false
    }
  }
</script>

<main class="home">
  <h1>PokerBanker</h1>
  <p class="muted">Track buy-ins and settle up a home game.</p>

  <form class="join" onsubmit={join}>
    <input
      class="code-input"
      bind:value={joinText}
      maxlength="2"
      placeholder="A5"
      autocapitalize="characters"
      autocomplete="off"
      spellcheck="false"
      aria-label="Room code"
    />
    <button type="submit" class="primary" disabled={busy}>Join room</button>
  </form>

  <div class="or muted">or</div>
  <button class="wide" onclick={create} disabled={busy}>Create a new room</button>

  {#if error}<p class="error">{error}</p>{/if}
  <p class="muted small">Rooms are deleted 24 hours after their last activity.</p>
</main>
