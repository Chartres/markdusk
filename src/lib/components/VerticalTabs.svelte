<script lang="ts">
  import type { Tab } from "$lib/stores/tabs.svelte";

  interface Props {
    tabs: Tab[];
    activeId: string;
    onSelect: (id: string) => void;
    onClose: (id: string) => void;
    onNew: () => void;
  }

  let { tabs, activeId, onSelect, onClose, onNew }: Props = $props();

  function displayName(t: Tab): string {
    if (!t.path) return "Untitled";
    return t.path.split("/").pop() ?? t.path;
  }
</script>

<div class="vt">
  <div class="label">OPEN</div>
  {#each tabs as tab (tab.id)}
    <button
      class="vtab"
      class:active={tab.id === activeId}
      onclick={() => onSelect(tab.id)}
      ondblclick={() => onClose(tab.id)}
    >
      <span class="icon">📄</span>
      <span class="name">{displayName(tab)}</span>
      {#if tab.dirty}<span class="dot">●</span>{/if}
      <span
        class="close"
        role="button"
        tabindex="-1"
        onclick={(e) => {
          e.stopPropagation();
          onClose(tab.id);
        }}
        onkeydown={(e) => {
          if (e.key === "Enter") {
            e.stopPropagation();
            onClose(tab.id);
          }
        }}
      >×</span>
    </button>
  {/each}
  <button class="vtab new" onclick={onNew}>＋ New</button>
</div>

<style>
  .vt {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.1em;
    opacity: 0.45;
    padding: 8px 8px 4px;
    text-transform: uppercase;
  }
  .vtab {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    background: transparent;
    border: none;
    color: var(--md-muted);
    font: inherit;
    font-size: 13px;
    text-align: left;
    width: 100%;
  }
  .vtab:hover {
    background: rgba(127, 127, 127, 0.08);
  }
  .vtab.active {
    background: var(--md-active-line);
    color: var(--md-ink);
    box-shadow: inset 2px 0 0 var(--md-accent);
  }
  .icon {
    width: 14px;
    flex: 0 0 auto;
    opacity: 0.7;
  }
  .name {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .dot {
    color: var(--md-accent);
    font-size: 8px;
  }
  .close {
    visibility: hidden;
    opacity: 0.6;
    padding: 0 4px;
  }
  .vtab:hover .close {
    visibility: visible;
  }
  .new {
    opacity: 0.7;
    margin-top: 4px;
  }
</style>
