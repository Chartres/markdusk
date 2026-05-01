<script lang="ts">
  import { onMount } from "svelte";
  import { createEditor } from "$lib/editor/editor";
  import { openFile, saveFile } from "$lib/ipc/commands";
  import { createDocumentStore } from "$lib/stores/document.svelte";
  import { listen } from "@tauri-apps/api/event";

  let container: HTMLDivElement;
  const store = createDocumentStore({ saver: saveFile });

  async function loadPath(path: string) {
    const doc = await openFile(path);
    store.loadInitial(doc.path ?? null, doc.contents);
  }

  onMount(() => {
    const view = createEditor(container, store.contents, (next) => store.update(next));

    const unlisten = listen<string[]>("markdusk://open-files", (e) => {
      if (e.payload?.[0]) {
        void loadPath(e.payload[0]).then(() => {
          view.dispatch({
            changes: { from: 0, to: view.state.doc.length, insert: store.contents },
          });
        });
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === "s") {
        e.preventDefault();
        void store.saveNow();
      }
    };
    document.addEventListener("keydown", onKey);

    return () => {
      void unlisten.then((u) => u());
      document.removeEventListener("keydown", onKey);
      view.destroy();
    };
  });
</script>

<main>
  <div bind:this={container} class="editor"></div>
  <footer>
    <span>{store.path ?? "Untitled"}</span>
    <span>{store.dirty ? "•" : ""}</span>
  </footer>
</main>

<style>
  main { height: 100vh; display: flex; flex-direction: column; }
  .editor { flex: 1; overflow: auto; }
  footer { display: flex; justify-content: space-between; padding: 6px 14px; font-size: 11px; color: var(--md-muted); border-top: 1px solid var(--md-rule); font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
  :global(.cm-editor) { height: 100%; font-family: ui-serif, Charter, "Iowan Old Style", Georgia, serif; font-size: 16px; }
</style>
