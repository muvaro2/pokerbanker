<script lang="ts">
  /** `floating`: fixed in the bottom-right corner. `inline`: sits inside another bar (the room's log bar). */
  let { variant = 'floating' }: { variant?: 'floating' | 'inline' } = $props()

  let dialog: HTMLDialogElement

  function open() {
    dialog.showModal()
    dialog.querySelector('.help-body')?.scrollTo(0, 0)
  }

  // Tapping the dimmed backdrop (outside the panel) closes it.
  function onBackdrop(event: MouseEvent) {
    if (event.target === dialog) dialog.close()
  }
</script>

<button class="help-button {variant}" onclick={open}>Instructions</button>

<dialog bind:this={dialog} class="help" onclick={onBackdrop} aria-labelledby="help-title">
  <div class="help-panel">
    <header class="help-header">
      <h2 id="help-title">How PokerBanker works</h2>
      <button class="link" onclick={() => dialog.close()} aria-label="Close instructions">Close</button>
    </header>

    <div class="help-body">
      <p>
        PokerBanker replaces the one person who usually acts as the bank in a home cash game. Everyone tracks their
        own buy-ins on their own phone, and at the end it works out who pays whom using as few payments as possible.
      </p>

      <h3>What it doesn't do</h3>
      <ul>
        <li><strong>It never moves money.</strong> It only does the math. You pay each other yourselves with Venmo, Zelle, cash, etc.</li>
        <li>It doesn't count chips or check that anyone's count is honest.</li>
        <li>It doesn't send payment requests or reminders.</li>
        <li>It has no accounts or passwords. <strong>Anyone with the room code can see and edit everything</strong>, so don't enter anything you wouldn't say out loud at the table.</li>
        <li>It doesn't keep history. A room is deleted 24 hours after its last activity.</li>
        <li>It's built for cash games in dollars. It doesn't handle tournaments, rake or tips.</li>
      </ul>

      <h3>1. Start or join a room</h3>
      <ul>
        <li>One person taps <strong>Create a new room</strong> and gets a 2-character code like <strong>A5</strong>.</li>
        <li>Everyone else types the code on the home page and taps <strong>Join room</strong>, or opens the link from the room's <strong>Share</strong> button. Codes aren't case-sensitive.</li>
        <li>Enter your name (each name can only be used once per room) and, optionally, how people should pay you (Venmo handle, Zelle number). The whole room can see this.</li>
        <li>Your phone remembers who you are. If you switch phones, open the room and tap your name under <strong>Already joined on another device?</strong></li>
      </ul>

      <h3>2. During the game</h3>
      <p>Tap any player's card to see their actions. Anyone can edit anyone, which helps when someone's phone is dead or they're busy playing.</p>
      <ul>
        <li><strong>Edit Buy-in:</strong> the total you've put in. Type an amount, or use the green <strong>+</strong> and red <strong>−</strong> buttons ($5, $10, $20), then tap <strong>Save</strong>. For a rebuy, add to your total.</li>
        <li><strong>Take chips from…:</strong> use this when the bank runs out of chips and you take chips straight from another player instead. Your buy-in goes up by that amount and theirs goes down. No money changes hands at that point; it all comes out in the settle-up. This can push someone's buy-in below zero. A buy-in of <strong>−$20</strong> means they're owed $20 plus whatever their stack is worth.</li>
        <li><strong>Payment info:</strong> change how people pay you.</li>
        <li><strong>Log</strong> (bar at the bottom): every action by everyone, newest first. Tap <strong>Undo</strong> to reverse a mistake. Joining can't be undone; use <strong>Remove</strong> instead.</li>
      </ul>

      <h3>3. Leaving early</h3>
      <p>Tap your card, then <strong>Cash out</strong>. Enter the chips you're leaving with, tap <strong>Next</strong>, and choose:</p>
      <ul>
        <li>
          <strong>Settle now</strong> (the default): the app suggests one player still at the table to pay you, or for you to pay. You can pick someone else. Make that one payment and you're done. That player's buy-in adjusts automatically, so the final settle-up still comes out right. The rest of the table may need one more payment than they otherwise would.
        </li>
        <li><strong>Settle at the end of the night:</strong> your stack is locked in and you're included in the final settle-up. Someone will pay you, or you'll pay someone, later.</li>
      </ul>
      <p>
        <strong>Remove</strong> is only for players who come out even (stack equals buy-in) or who never entered a
        stack, like someone who joined by accident. Anyone else has to cash out instead.
      </p>

      <h3>4. Settling up at the end</h3>
      <ol>
        <li>Everyone counts their chips and enters them with <strong>Input Stack Size</strong> (buttons from 10¢ to $10, or type it).</li>
        <li>Anyone taps <strong>Settle up the table</strong>. The app waits until every stack is entered.</li>
        <li>It lists each payment, like <em>Bob pays Alice $5.30</em>, along with the receiver's payment info.</li>
        <li>Everyone makes their payments. Every phone shows the same list.</li>
      </ol>
      <p>
        <strong>If the chips don't add up</strong> to the total buy-ins, the app says by how much and asks everyone to
        recount. If it's still off, tap <strong>Settle anyway</strong> and choose how to absorb the difference: in
        proportion to each stack, evenly across everyone, or by one chosen player. Any leftover cent goes in favor of
        the biggest losers. A table shows exactly how each person was adjusted.
      </p>

      <h3>How it picks the payments</h3>
      <ol>
        <li>Fewest payments possible.</li>
        <li>If there's a tie, spread the payments so no one person has to make or receive lots of them.</li>
        <li>Then keep the largest single payment as small as possible.</li>
        <li>Then prefer round amounts, avoid tiny payments, and give the same answer every time.</li>
      </ol>

      <h3>Good to know</h3>
      <ul>
        <li>Changes show up on everyone's phone right away. If your connection drops, your changes are sent when it comes back.</li>
        <li>Rooms disappear 24 hours after the last activity. Take a screenshot of the settle-up if you want a record.</li>
        <li>If something goes badly wrong, you can always settle up the old way. The log shows everything that happened.</li>
      </ul>
    </div>
  </div>
</dialog>

<style>
  .help-button {
    font-size: 0.9rem;
    min-height: 40px;
    padding: 8px 14px;
    border-radius: 999px;
    background: var(--card);
    color: var(--accent);
    font-weight: 600;
  }
  .help-button.floating {
    position: fixed;
    right: 16px;
    bottom: calc(16px + env(safe-area-inset-bottom));
    z-index: 4;
    box-shadow: 0 2px 8px rgb(0 0 0 / 0.12);
  }
  .help-button.inline {
    flex: 0 0 auto;
    margin: 6px 12px 6px 0;
  }

  .help {
    width: min(560px, 100vw - 24px);
    max-height: calc(100dvh - 24px);
    padding: 0;
    border: 1px solid var(--line);
    border-radius: 14px;
    background: var(--card);
    color: var(--text);
  }
  .help::backdrop {
    background: rgb(0 0 0 / 0.5);
  }
  .help-panel {
    display: flex;
    flex-direction: column;
    max-height: calc(100dvh - 26px);
  }
  .help-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--line);
  }
  .help-header h2 {
    margin: 0;
  }
  .help-body {
    overflow-y: auto;
    padding: 4px 16px 20px;
    line-height: 1.5;
  }
  .help-body h3 {
    font-size: 1rem;
    margin: 18px 0 4px;
  }
  .help-body ul,
  .help-body ol {
    margin: 4px 0;
    padding-left: 20px;
  }
  .help-body li {
    margin: 4px 0;
  }
</style>
