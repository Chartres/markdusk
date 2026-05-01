<script lang="ts">
  import VerticalTabs from "./VerticalTabs.svelte";
  import FileTree from "./FileTree.svelte";
  import type { Tab } from "$lib/stores/tabs.svelte";
  import type { FileNode } from "$lib/ipc/types.gen";

  interface Props {
    tabs: Tab[];
    activeId: string;
    onSelectTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onNewTab: () => void;
    workspaceRoot: FileNode | null;
    onOpenFile: (path: string) => void;
    onOpenFolder: () => void;
  }

  let {
    tabs,
    activeId,
    onSelectTab,
    onCloseTab,
    onNewTab,
    workspaceRoot,
    onOpenFile,
    onOpenFolder,
  }: Props = $props();
</script>

<aside class="left-rail">
  <VerticalTabs {tabs} {activeId} onSelect={onSelectTab} onClose={onCloseTab} onNew={onNewTab} />
  <div class="separator"></div>
  <div class="ws-header">
    <span class="label">WORKSPACE</span>
    <button class="open-folder" onclick={onOpenFolder}>Open folder…</button>
  </div>
  {#if workspaceRoot}
    <FileTree node={workspaceRoot} onOpen={onOpenFile} />
  {:else}
    <div class="empty">No folder open</div>
  {/if}
</aside>

<style>
  .left-rail {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
    padding: 8px 4px;
    background: rgba(0, 0, 0, 0.04);
    border-right: 1px solid var(--md-rule);
    height: 100%;
  }
  :global(:root[data-appearance="dark"]) .left-rail,
  :global(:root:not([data-appearance])) .left-rail {
    background: rgba(0, 0, 0, 0.18);
  }
  .separator {
    height: 1px;
    background: var(--md-rule);
    margin: 8px 6px;
    opacity: 0.4;
  }
  .ws-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 4px 8px;
  }
  .label {
    font-size: 10px;
    letter-spacing: 0.1em;
    opacity: 0.45;
    text-transform: uppercase;
  }
  .open-folder {
    background: transparent;
    border: none;
    color: var(--md-accent);
    font: inherit;
    font-size: 11px;
    cursor: pointer;
    padding: 0;
  }
  .open-folder:hover {
    text-decoration: underline;
  }
  .empty {
    font-size: 12px;
    opacity: 0.5;
    padding: 8px;
  }
</style>
