<script lang="ts">
  import { onMount, untrack } from "svelte";
  import { createEditor } from "$lib/editor/editor";
  import { openFile, saveFile } from "$lib/ipc/commands";
  import { createTabsStore } from "$lib/stores/tabs.svelte";
  import { createWorkspaceStore } from "$lib/stores/workspace.svelte";
  import { createOutlineStore } from "$lib/stores/outline.svelte";
  import { listen } from "@tauri-apps/api/event";
  import LeftRail from "$lib/components/LeftRail.svelte";
  import OutlinePanel from "$lib/components/OutlinePanel.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import { EditorSelection } from "@codemirror/state";
  import type { EditorView } from "@codemirror/view";
  import { applyTheme, applyAppearance } from "$lib/theme/theme";

  let container: HTMLDivElement;
  const tabs = createTabsStore({ saver: saveFile });
  const workspace = createWorkspaceStore();
  const outline = createOutlineStore();

  let leftOpen = $state(false);
  let rightOpen = $state(false);
  let focusMode = $state(false);

  let view: EditorView | undefined;
  let lastTabId: string | undefined;

  async function loadPath(path: string) {
    const doc = await openFile(path);
    tabs.loadFile(path, doc.contents);
  }

  async function openFolderDialog() {
    const { open } = await import("@tauri-apps/plugin-dialog");
    const picked = await open({ directory: true, multiple: false });
    if (typeof picked === "string") {
      await workspace.open(picked);
      leftOpen = true;
    }
  }

  function syncEditor(text: string) {
    if (!view) return;
    if (view.state.doc.toString() === text) return;
    view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
  }

  function wordCountOf(text: string): number {
    if (!text) return 0;
    const m = text.trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  let activeWordCount = $derived(wordCountOf(tabs.active.contents));

  $effect(() => {
    const id = tabs.activeId;
    if (id === lastTabId) return;
    lastTabId = id;
    untrack(() => {
      syncEditor(tabs.active.contents);
    });
  });

  $effect(() => {
    const text = tabs.active.contents;
    void outline.refresh(text);
  });

  function jumpTo(byteOffset: number) {
    if (!view) return;
    view.dispatch({
      selection: EditorSelection.single(byteOffset),
      scrollIntoView: true,
    });
    view.focus();
  }

  onMount(() => {
    view = createEditor(
      container,
      tabs.active.contents,
      (next) => tabs.update(next),
      () => tabs.active.path,
    );

    const unlistenOpen = listen<string[]>("markdusk://open-files", (e) => {
      if (e.payload?.[0]) void loadPath(e.payload[0]);
    });

    const unlistenMenu = listen<string>("markdusk://menu", async (e) => {
      switch (e.payload) {
        case "file:save":
          await tabs.saveActiveNow();
          break;
        case "file:open": {
          const { open } = await import("@tauri-apps/plugin-dialog");
          const picked = await open({
            multiple: false,
            filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
          });
          if (typeof picked === "string") await loadPath(picked);
          break;
        }
        case "file:new":
          tabs.openNew();
          syncEditor("");
          break;
        case "file:open-folder":
          await openFolderDialog();
          break;
        case "view:toggle-left":
          leftOpen = !leftOpen;
          break;
        case "view:toggle-right":
          rightOpen = !rightOpen;
          break;
        case "view:focus":
          focusMode = !focusMode;
          break;
        case "theme:smoke":
          applyTheme("smoke");
          break;
        case "theme:amber":
          applyTheme("amber");
          break;
        case "appearance:system":
          applyAppearance("system");
          break;
        case "appearance:light":
          applyAppearance("light");
          break;
        case "appearance:dark":
          applyAppearance("dark");
          break;
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return;
      if (e.key === "s") {
        e.preventDefault();
        void tabs.saveActiveNow();
      } else if (e.key === "F" && e.shiftKey) {
        e.preventDefault();
        focusMode = !focusMode;
      } else if (e.key === "\\" && e.shiftKey) {
        e.preventDefault();
        rightOpen = !rightOpen;
      } else if (e.key === "\\") {
        e.preventDefault();
        leftOpen = !leftOpen;
      } else if (e.key >= "1" && e.key <= "9") {
        const idx = Number(e.key) - 1;
        const t = tabs.list[idx];
        if (t) {
          e.preventDefault();
          tabs.setActive(t.id);
        }
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      void unlistenOpen.then((u) => u());
      void unlistenMenu.then((u) => u());
      document.removeEventListener("keydown", onKey);
      view?.destroy();
    };
  });
</script>

<div class="layout" class:focus={focusMode} class:left-open={leftOpen} class:right-open={rightOpen}>
  {#if leftOpen && !focusMode}
    <LeftRail
      tabs={tabs.list}
      activeId={tabs.activeId}
      onSelectTab={(id) => tabs.setActive(id)}
      onCloseTab={(id) => tabs.close(id)}
      onNewTab={() => {
        tabs.openNew();
        syncEditor("");
      }}
      workspaceRoot={workspace.root}
      onOpenFile={(p) => void loadPath(p)}
      onOpenFolder={openFolderDialog}
    />
  {/if}

  <main>
    <div bind:this={container} class="editor"></div>
    {#if !focusMode}
      <StatusBar path={tabs.active.path} dirty={tabs.active.dirty} wordCount={activeWordCount} />
    {/if}
  </main>

  {#if rightOpen && !focusMode}
    <aside class="right-rail">
      <OutlinePanel entries={outline.entries} onJump={jumpTo} />
    </aside>
  {/if}
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: auto 1fr auto;
    height: 100vh;
    overflow: hidden;
  }
  .layout.left-open {
    grid-template-columns: 240px 1fr auto;
  }
  .layout.right-open {
    grid-template-columns: auto 1fr 240px;
  }
  .layout.left-open.right-open {
    grid-template-columns: 240px 1fr 240px;
  }
  .layout.focus {
    grid-template-columns: 1fr;
  }
  main {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
  .editor {
    flex: 1;
    overflow: auto;
  }
  :global(.cm-editor) {
    height: 100%;
  }
  .right-rail {
    border-left: 1px solid var(--md-rule);
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.04);
  }
  :global(:root[data-appearance="dark"]) .right-rail {
    background: rgba(0, 0, 0, 0.18);
  }
</style>
