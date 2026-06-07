<script lang="ts">
  import type { OutlineEntry } from "$lib/ipc/types.gen";

  interface Props {
    entries: OutlineEntry[];
    scrollTop: number;
    contentTopByteOffset: number | null;
    onJump: (byteOffset: number) => void;
  }

  let { entries, scrollTop, contentTopByteOffset, onJump }: Props = $props();

  // The current sticky heading is the LAST heading whose byte_offset is at or
  // before the byte offset of the line currently at the top of the viewport.
  let current = $derived.by(() => {
    if (entries.length === 0) return null;
    if (contentTopByteOffset === null) return null;
    let last: OutlineEntry | null = null;
    for (const e of entries) {
      if (e.byte_offset <= contentTopByteOffset) last = e;
      else break;
    }
    return last;
  });

  // Hide when there's nothing to show (no heading above the viewport) OR when
  // the user has scrolled all the way to the top (the heading is already visible).
  let visible = $derived(current !== null && scrollTop > 40);
</script>

{#if visible && current}
  <button
    class="sticky-heading"
    onclick={() => onJump(current.byte_offset)}
    aria-label="Jump to section: {current.text}"
  >
    <span class="level">H{current.level}</span>
    <span class="text">{current.text}</span>
  </button>
{/if}

<style>
  .sticky-heading {
    position: absolute;
    top: 0;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: 680px;
    background: var(--md-paper);
    color: var(--md-ink);
    border: 1px solid var(--md-rule);
    border-top: none;
    border-radius: 0 0 8px 8px;
    padding: 4px 14px;
    font:
      inherit,
      ui-sans-serif,
      sans-serif;
    font-size: 12.5px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    backdrop-filter: blur(8px);
  }
  .sticky-heading:hover {
    color: var(--md-accent);
  }
  .level {
    font-family: ui-monospace, monospace;
    font-size: 10px;
    color: var(--md-muted);
    background: rgba(127, 127, 127, 0.12);
    padding: 1px 5px;
    border-radius: 4px;
  }
  .text {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
