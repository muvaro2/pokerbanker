<script lang="ts">
  import type { LogEntry } from '../lib/state'

  interface Props {
    log: LogEntry[]
    canAct: boolean
    onundo: (id: string) => void
  }
  let { log, canAct, onundo }: Props = $props()

  const KEY = 'pokerbanker:log-open'
  let open = $state(readOpen())
  function readOpen() {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  }
  function toggle() {
    open = !open
    try {
      localStorage.setItem(KEY, open ? '1' : '0')
    } catch {
      // Not remembered; fine.
    }
  }

  const newestFirst = $derived([...log].reverse())
  const time = (ts: number) => (ts ? new Date(ts).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : '')

  function undo(entry: LogEntry) {
    if (confirm(`Undo "${entry.text}"?`)) onundo(entry.id)
  }
</script>

<aside class="log" class:open>
  <button class="log-toggle" onclick={toggle} aria-expanded={open}>
    <span>Log ({log.length})</span>
    <span>{open ? '▾' : '▴'}</span>
  </button>
  {#if open}
    <ol class="log-list">
      {#each newestFirst as entry (entry.id)}
        <li class:undone={entry.undone}>
          <span class="muted small time">{time(entry.ts)}</span>
          <span class="text">{entry.text}</span>
          {#if canAct && entry.undoable && !entry.undone}
            <button class="link small" onclick={() => undo(entry)}>Undo</button>
          {/if}
        </li>
      {:else}
        <li class="muted">Nothing yet.</li>
      {/each}
    </ol>
  {/if}
</aside>
