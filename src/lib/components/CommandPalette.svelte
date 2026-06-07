<script lang="ts">
  interface PaletteItem {
    id: string;
    label: string;
    hint?: string;
    keywords?: string[];
    onRun: () => void | Promise<void>;
  }

  interface Props {
    open: boolean;
    items: PaletteItem[];
    placeholder?: string;
    onClose: () => void;
  }

  let { open, items, placeholder = "Type a command…", onClose }: Props = $props();

  let query = $state("");
  let selectedIdx = $state(0);
  let inputEl: HTMLInputElement | undefined = $state();

  function fuzzyScore(label: string, q: string): number {
    if (!q) return 1;
    const L = label.toLowerCase();
    const Q = q.toLowerCase();
    if (L.startsWith(Q)) return 1000 - L.length;
    if (L.includes(Q)) return 500 - L.length;
    // Subsequence match: every char of Q found in order in L.
    let li = 0;
    for (let qi = 0; qi < Q.length; qi++) {
      const c = Q[qi];
      while (li < L.length && L[li] !== c) li++;
      if (li >= L.length) return -1;
      li++;
    }
    return 100 - L.length;
  }

  let filtered = $derived.by(() => {
    if (!query.trim()) return items.slice(0, 50);
    const scored = items
      .map((it) => {
        const haystack = [it.label, ...(it.keywords ?? [])].join(" ");
        return { it, score: fuzzyScore(haystack, query) };
      })
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 50)
      .map((r) => r.it);
    return scored;
  });

  $effect(() => {
    void query;
    selectedIdx = 0;
  });

  $effect(() => {
    if (open) {
      queueMicrotask(() => inputEl?.focus());
    } else {
      query = "";
    }
  });

  function pick(it: PaletteItem) {
    onClose();
    queueMicrotask(() => void it.onRun());
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      selectedIdx = Math.min(filtered.length - 1, selectedIdx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      selectedIdx = Math.max(0, selectedIdx - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const target = filtered[selectedIdx];
      if (target) pick(target);
    }
  }
</script>

{#if open}
  <div
    class="palette-overlay"
    onclick={onClose}
    onkeydown={(e) => {
      if (e.key === "Escape") onClose();
    }}
    role="presentation"
  >
    <div
      class="palette"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      role="dialog"
      tabindex="-1"
      aria-modal="true"
      aria-label="Command palette"
    >
      <input
        bind:this={inputEl}
        bind:value={query}
        onkeydown={onKey}
        {placeholder}
        spellcheck="false"
        autocapitalize="off"
      />
      <ul class="results">
        {#each filtered as item, i (item.id)}
          <li
            class:selected={i === selectedIdx}
            onclick={() => pick(item)}
            onkeydown={(e) => {
              if (e.key === "Enter") pick(item);
            }}
            onmouseenter={() => (selectedIdx = i)}
            role="option"
            aria-selected={i === selectedIdx}
          >
            <span class="label">{item.label}</span>
            {#if item.hint}<span class="hint">{item.hint}</span>{/if}
          </li>
        {/each}
        {#if filtered.length === 0}
          <li class="empty">No matches</li>
        {/if}
      </ul>
    </div>
  </div>
{/if}

<style>
  .palette-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.18);
    z-index: 9999;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding-top: 12vh;
  }
  .palette {
    width: 560px;
    max-width: calc(100vw - 48px);
    background: var(--md-paper);
    color: var(--md-ink);
    border: 1px solid var(--md-rule);
    border-radius: 10px;
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    max-height: 60vh;
  }
  input {
    width: 100%;
    border: none;
    border-bottom: 1px solid var(--md-rule);
    padding: 14px 18px;
    font:
      inherit,
      ui-serif,
      Charter,
      Georgia,
      serif;
    font-size: 15px;
    background: transparent;
    color: var(--md-ink);
    outline: none;
  }
  ul.results {
    list-style: none;
    margin: 0;
    padding: 6px 0;
    overflow-y: auto;
  }
  li {
    padding: 8px 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
  }
  li.selected {
    background: rgba(61, 106, 94, 0.16);
    color: var(--md-accent);
  }
  li.empty {
    color: var(--md-muted);
    cursor: default;
    padding-top: 12px;
    padding-bottom: 12px;
  }
  .label {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .hint {
    color: var(--md-muted);
    font-size: 11px;
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      sans-serif;
    flex-shrink: 0;
  }
</style>
