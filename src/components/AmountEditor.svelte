<script lang="ts">
  import { centsToInput, parseCents } from '../lib/money'

  interface Props {
    /** Starting value; null means empty. */
    initial: number | null
    /** Positive step sizes in cents; buttons are shown for − and + each. */
    steps: number[]
    label: string
    saveLabel?: string
    /** Allow saving an empty value (e.g. "stack not counted"). */
    allowEmpty?: boolean
    allowNegative?: boolean
    onsave: (cents: number | null) => void
    oncancel: () => void
    /** Optional live note under the input, e.g. "Change: +$5.00". */
    note?: (cents: number | null) => string
  }
  let { initial, steps, label, saveLabel = 'Save', allowEmpty = false, allowNegative = false, onsave, oncancel, note }: Props = $props()

  // svelte-ignore state_referenced_locally
  let text = $state(centsToInput(initial))
  const value = $derived(text.trim() === '' ? null : parseCents(text))
  const invalid = $derived(
    (text.trim() !== '' && value === null) || (value === null && !allowEmpty) || (value !== null && value < 0 && !allowNegative),
  )

  const stepLabel = (c: number) => (c >= 100 ? `$${c / 100}` : `${c}¢`)

  function bump(delta: number) {
    const next = (value ?? 0) + delta
    text = centsToInput(allowNegative ? next : Math.max(0, next))
  }

  function save(event: SubmitEvent) {
    event.preventDefault()
    if (!invalid) onsave(value)
  }
</script>

<form class="editor" onsubmit={save}>
  <label class="editor-label">
    <span>{label}</span>
    <span class="dollar-input">
      <span class="muted">$</span>
      <input bind:value={text} inputmode="decimal" autocomplete="off" placeholder={allowEmpty ? 'not counted' : '0.00'} />
    </span>
  </label>
  {#if note}<div class="muted small">{note(value)}</div>{/if}
  <div class="steps" style:--cols={steps.length}>
    <!-- Same order in both rows so each − sits directly under its +. -->
    {#each steps as s (s)}
      <button type="button" class="add" onclick={() => bump(s)}>+{stepLabel(s)}</button>
    {/each}
    {#each steps as s (s)}
      <button type="button" class="sub" onclick={() => bump(-s)}>−{stepLabel(s)}</button>
    {/each}
  </div>
  <div class="row">
    <button type="button" onclick={oncancel}>Cancel</button>
    {#if allowEmpty}<button type="button" onclick={() => (text = '')}>Clear</button>{/if}
    <button type="submit" class="primary" disabled={invalid}>{saveLabel}</button>
  </div>
  {#if invalid && text.trim() !== ''}<div class="error small">Enter an amount like 20 or 20.35</div>{/if}
</form>

<style>
  .steps {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 6px;
  }
  .steps button {
    padding: 10px 0;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .steps .add {
    color: var(--pos);
    background: color-mix(in srgb, var(--pos) 12%, var(--card));
    border-color: color-mix(in srgb, var(--pos) 35%, var(--card));
  }
  .steps .sub {
    color: var(--neg);
    background: color-mix(in srgb, var(--neg) 12%, var(--card));
    border-color: color-mix(in srgb, var(--neg) 35%, var(--card));
  }
</style>
