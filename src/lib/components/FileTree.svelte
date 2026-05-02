<script lang="ts">
  import type { FileNode } from "$lib/ipc/types.gen";
  import FileTree from "./FileTree.svelte";

  interface Props {
    node: FileNode;
    onOpen: (path: string) => void;
    depth?: number;
  }

  let { node, onOpen, depth = 0 }: Props = $props();
  // svelte-ignore state_referenced_locally
  // Default-expand the top two levels. The initial-value capture is intentional —
  // expanding/collapsing should not reset when the parent re-renders.
  let expanded = $state(depth < 2);
</script>

{#if node.is_dir}
  <button
    class="row dir"
    style:padding-left="{depth * 12 + 8}px"
    onclick={() => (expanded = !expanded)}
  >
    <span class="caret">{expanded ? "▾" : "▸"}</span>
    <span class="name">{node.name}</span>
  </button>
  {#if expanded}
    {#each node.children as child (child.path)}
      <FileTree node={child} {onOpen} depth={depth + 1} />
    {/each}
  {/if}
{:else}
  <button
    class="row file"
    style:padding-left="{depth * 12 + 22}px"
    ondblclick={() => onOpen(String(node.path))}
    onclick={() => onOpen(String(node.path))}
  >
    <span class="name">{node.name}</span>
  </button>
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    width: 100%;
    padding: 4px 8px;
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--md-muted);
    font: inherit;
    font-size: 12.5px;
    text-align: left;
  }
  .row:hover {
    background: rgba(127, 127, 127, 0.06);
    color: var(--md-ink);
  }
  .caret {
    width: 10px;
    opacity: 0.6;
  }
  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
