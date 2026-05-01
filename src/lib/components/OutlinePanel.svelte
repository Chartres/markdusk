<script lang="ts">
  import type { OutlineEntry } from "$lib/ipc/types.gen";

  interface Props {
    entries: OutlineEntry[];
    onJump: (byteOffset: number) => void;
    activeOffset?: number;
  }

  let { entries, onJump, activeOffset }: Props = $props();
</script>

<div class="outline">
  <div class="label">OUTLINE</div>
  {#if entries.length === 0}
    <div class="empty">No headings yet</div>
  {/if}
  {#each entries as entry (entry.byte_offset)}
    <button
      class="row level-{entry.level}"
      class:active={activeOffset !== undefined && activeOffset >= entry.byte_offset}
      onclick={() => onJump(entry.byte_offset)}
    >
      {entry.text}
    </button>
  {/each}
</div>

<style>
  .outline {
    display: flex;
    flex-direction: column;
    padding: 12px;
    gap: 1px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.1em;
    opacity: 0.45;
    padding: 0 0 6px;
    text-transform: uppercase;
  }
  .empty {
    font-size: 12px;
    opacity: 0.5;
    padding: 6px 0;
  }
  .row {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--md-muted);
    font: inherit;
    font-size: 12.5px;
    padding: 4px 8px;
    border-radius: 4px;
    text-align: left;
  }
  .row:hover {
    background: rgba(127, 127, 127, 0.06);
    color: var(--md-ink);
  }
  .row.active {
    color: var(--md-accent);
  }
  .level-2 { padding-left: 18px; opacity: 0.85; }
  .level-3 { padding-left: 30px; opacity: 0.75; }
  .level-4 { padding-left: 42px; opacity: 0.7; }
  .level-5 { padding-left: 54px; opacity: 0.65; }
  .level-6 { padding-left: 66px; opacity: 0.6; }
</style>
