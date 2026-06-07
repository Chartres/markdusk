<script lang="ts">
  import { onMount } from "svelte";
  import { invoke } from "@tauri-apps/api/core";
  import {
    createEditor,
    setVim,
    setTypewriter,
    setSpellCheck,
    setFocusDim,
    setSmartPunctuation,
    setLineNumbers,
    openFind,
    openReplace,
    type FocusDimMode,
  } from "$lib/editor/editor";
  import {
    openFile,
    saveFile,
    exportHtml,
    exportDocx,
    renderHtmlForClipboard,
  } from "$lib/ipc/commands";
  import { createTabsStore } from "$lib/stores/tabs.svelte";
  import { createWorkspaceStore } from "$lib/stores/workspace.svelte";
  import { createOutlineStore } from "$lib/stores/outline.svelte";
  import { createRecentsStore } from "$lib/stores/recents.svelte";
  import { loadSession, saveSession } from "$lib/stores/session.svelte";
  import { listen } from "@tauri-apps/api/event";
  import LeftRail from "$lib/components/LeftRail.svelte";
  import OutlinePanel from "$lib/components/OutlinePanel.svelte";
  import StatusBar from "$lib/components/StatusBar.svelte";
  import CommandPalette from "$lib/components/CommandPalette.svelte";
  import type { FileNode } from "$lib/ipc/types.gen";
  import { EditorSelection } from "@codemirror/state";
  import type { EditorView } from "@codemirror/view";
  import { applyTheme, applyAppearance } from "$lib/theme/theme";

  let container: HTMLDivElement;
  const tabs = createTabsStore({ saver: saveFile });
  const workspace = createWorkspaceStore();
  const outline = createOutlineStore();
  const recents = createRecentsStore();

  let leftOpen = $state(false);
  let rightOpen = $state(false);
  let focusMode = $state(false);
  let vimOn = $state(false);
  let spellOn = $state(true);
  let smartPunct = $state(false);
  let focusDimMode = $state<FocusDimMode>("paragraph");
  let lineNumsOn = $state(false);
  let currentTheme = $state<"smoke" | "amber">("smoke");
  let paletteMode = $state<"none" | "commands" | "files" | "headings">("none");

  let view: EditorView | undefined;

  function flattenWorkspace(node: FileNode | null): { path: string; name: string }[] {
    if (!node) return [];
    const out: { path: string; name: string }[] = [];
    function walk(n: FileNode) {
      if (!n.is_dir) {
        if (n.name.startsWith(".")) return;
        if (/\.(md|markdown|mdown|mdwn|mkd)$/i.test(n.name)) {
          out.push({ path: n.path, name: n.name });
        }
      } else {
        for (const child of n.children) walk(child);
      }
    }
    walk(node);
    return out;
  }

  let workspaceFiles = $derived(flattenWorkspace(workspace.root));

  async function loadPath(path: string) {
    try {
      const doc = await openFile(path);
      tabs.loadFile(path, doc.contents);
      syncEditor(doc.contents);
      recents.push(path);
      persistSession();
    } catch (e) {
      console.error("loadPath failed:", path, e);
      alert(`Couldn't open ${path}\n\n${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function persistSession() {
    const paths = tabs.list.map((t) => t.path).filter((p): p is string => p !== null);
    saveSession(paths, tabs.active.path);
  }

  function selectTab(id: string) {
    tabs.setActive(id);
    syncEditor(tabs.active.contents);
    persistSession();
  }

  function closeTab(id: string) {
    tabs.close(id);
    syncEditor(tabs.active.contents);
    persistSession();
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
  let activeCharCount = $derived(tabs.active.contents.length);
  let activeReadingMin = $derived(Math.max(1, Math.round(activeWordCount / 220)));

  $effect(() => {
    const text = tabs.active.contents;
    void outline.refresh(text);
  });

  function applyFocusMode() {
    if (!view) return;
    setTypewriter(view, focusMode);
    setFocusDim(view, focusMode ? focusDimMode : "off");
  }

  $effect(() => {
    void focusMode;
    void focusDimMode;
    applyFocusMode();
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

    void (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (update?.available) {
          // The dialog config in tauri.conf.json shows the native dialog; just trigger.
          await update.downloadAndInstall();
        }
      } catch {
        // Silent — no updater configured, or no network.
      }
    })();

    const unlistenOpen = listen<string[]>("markdusk://open-files", (e) => {
      if (e.payload?.[0]) void loadPath(e.payload[0]);
    });

    // Drain any paths that arrived before this listener registered (cold-launch
    // via Finder / `open file.md`). Without this, the RunEvent::Opened fires
    // into a webview that isn't ready yet and the path is lost. If nothing was
    // queued, restore last session's tabs instead.
    void (async () => {
      try {
        const pending = await invoke<string[]>("drain_pending_opens");
        if (pending && pending.length > 0) {
          for (const p of pending) await loadPath(p);
          return;
        }
        // No file-association open — restore previous session if any.
        const session = loadSession();
        if (session.paths.length > 0) {
          for (const p of session.paths) {
            try {
              const doc = await openFile(p);
              tabs.loadFile(p, doc.contents);
            } catch {
              // File moved/deleted since last session — silently skip.
            }
          }
          if (session.activePath) {
            const target = tabs.list.find((t) => t.path === session.activePath);
            if (target) {
              tabs.setActive(target.id);
              syncEditor(tabs.active.contents);
            }
          } else {
            syncEditor(tabs.active.contents);
          }
        }
      } catch (e) {
        console.error("session restore failed:", e);
      }
    })();

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
          currentTheme = "smoke";
          break;
        case "theme:amber":
          applyTheme("amber");
          currentTheme = "amber";
          break;
        case "export:html": {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const target = await save({
            defaultPath: "export.html",
            filters: [{ name: "HTML", extensions: ["html"] }],
          });
          if (typeof target === "string") {
            await exportHtml(target, tabs.active.contents, currentTheme);
          }
          break;
        }
        case "export:docx": {
          const { save } = await import("@tauri-apps/plugin-dialog");
          const target = await save({
            defaultPath: "export.docx",
            filters: [{ name: "Word document", extensions: ["docx"] }],
          });
          if (typeof target === "string") {
            try {
              await exportDocx(target, tabs.active.contents);
            } catch (e) {
              alert(
                `DOCX export failed:\n\n${e instanceof Error ? e.message : String(e)}\n\nIf this says "pandoc not found", install it with:\n  brew install pandoc`,
              );
            }
          }
          break;
        }
        case "export:pdf": {
          const html = await renderHtmlForClipboard(tabs.active.contents, currentTheme);
          const w = window.open("", "_blank");
          if (w) {
            w.document.open();
            w.document.write(html);
            w.document.close();
            w.print();
          } else {
            // Tauri's WebView blocked window.open; fall back to writing the
            // HTML to a temp file so the user can print from a browser.
            const path = await import("@tauri-apps/api/path");
            const dir = await path.tempDir();
            const target = `${dir}markdusk-print-${Date.now()}.html`;
            await exportHtml(target, tabs.active.contents, currentTheme);
            console.warn(
              "[markdusk] window.open blocked; wrote print HTML to:",
              target,
              "Open the file and print from your browser.",
            );
          }
          break;
        }
        case "export:copy-rich": {
          const html = await renderHtmlForClipboard(tabs.active.contents, currentTheme);
          const blob = new Blob([html], { type: "text/html" });
          const plain = new Blob([tabs.active.contents], { type: "text/plain" });
          await navigator.clipboard.write([
            new ClipboardItem({ "text/html": blob, "text/plain": plain }),
          ]);
          break;
        }
        case "appearance:system":
          applyAppearance("system");
          break;
        case "appearance:light":
          applyAppearance("light");
          break;
        case "appearance:dark":
          applyAppearance("dark");
          break;
        case "mode:default":
          if (vimOn) {
            vimOn = false;
            if (view) setVim(view, false);
          }
          break;
        case "mode:vim":
          if (!vimOn) {
            vimOn = true;
            if (view) setVim(view, true);
          }
          break;
        case "edit:find":
          if (view) openFind(view);
          break;
        case "edit:replace":
          if (view) openReplace(view);
          break;
        case "edit:spell-check":
          spellOn = !spellOn;
          if (view) setSpellCheck(view, spellOn);
          break;
        case "palette:commands":
          paletteMode = "commands";
          break;
        case "palette:files":
          paletteMode = "files";
          break;
        case "edit:smart-punct":
          smartPunct = !smartPunct;
          if (view) setSmartPunctuation(view, smartPunct);
          break;
        case "view:toggle-line-numbers":
          lineNumsOn = !lineNumsOn;
          if (view) setLineNumbers(view, lineNumsOn);
          break;
        case "view:focus-dim:paragraph":
          focusDimMode = "paragraph";
          if (!focusMode) focusMode = true;
          break;
        case "view:focus-dim:sentence":
          focusDimMode = "sentence";
          if (!focusMode) focusMode = true;
          break;
        case "view:focus-dim:off":
          focusDimMode = "off";
          break;
        case "view:jump-heading":
          paletteMode = "headings";
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
      } else if (e.key === "P" && e.shiftKey) {
        e.preventDefault();
        paletteMode = "commands";
      } else if (e.key === "p" && !e.shiftKey) {
        // Cmd+P → quick switcher (vs Cmd+Shift+P → command palette).
        // Matches the VS Code convention which Sam and Diego expect.
        e.preventDefault();
        paletteMode = "files";
      } else if (e.key === "G" && e.shiftKey) {
        // Cmd+Shift+G → jump to heading within the current document.
        e.preventDefault();
        paletteMode = "headings";
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
          selectTab(t.id);
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

  interface PaletteItem {
    id: string;
    label: string;
    hint?: string;
    keywords?: string[];
    onRun: () => void | Promise<void>;
  }

  let commandItems = $derived<PaletteItem[]>([
    {
      id: "file:new",
      label: "File: New",
      hint: "⌘N",
      keywords: ["create", "blank"],
      onRun: () => {
        tabs.openNew();
        syncEditor("");
      },
    },
    {
      id: "file:open",
      label: "File: Open…",
      hint: "⌘O",
      onRun: async () => {
        const { open } = await import("@tauri-apps/plugin-dialog");
        const picked = await open({
          multiple: false,
          filters: [{ name: "Markdown", extensions: ["md", "markdown"] }],
        });
        if (typeof picked === "string") await loadPath(picked);
      },
    },
    {
      id: "file:open-folder",
      label: "File: Open Folder…",
      hint: "⌘⇧O",
      onRun: openFolderDialog,
    },
    {
      id: "file:save",
      label: "File: Save",
      hint: "⌘S",
      onRun: () => void tabs.saveActiveNow(),
    },
    {
      id: "view:focus",
      label: focusMode ? "View: Exit Focus Mode" : "View: Focus Mode",
      hint: "⌘⇧F",
      onRun: () => {
        focusMode = !focusMode;
      },
    },
    {
      id: "view:focus-dim:paragraph",
      label: "View: Focus Dim — Paragraph",
      keywords: ["focus", "dim"],
      onRun: () => {
        focusDimMode = "paragraph";
        focusMode = true;
      },
    },
    {
      id: "view:focus-dim:sentence",
      label: "View: Focus Dim — Sentence",
      keywords: ["focus", "dim", "ia"],
      onRun: () => {
        focusDimMode = "sentence";
        focusMode = true;
      },
    },
    {
      id: "view:focus-dim:off",
      label: "View: Focus Dim — Off",
      keywords: ["focus", "dim", "disable"],
      onRun: () => {
        focusDimMode = "off";
      },
    },
    {
      id: "view:jump-heading",
      label: "View: Jump to Heading…",
      hint: "⌘⇧G",
      keywords: ["outline", "heading", "navigate"],
      onRun: () => {
        paletteMode = "headings";
      },
    },
    {
      id: "view:toggle-left",
      label: leftOpen ? "View: Hide Files Sidebar" : "View: Show Files Sidebar",
      hint: "⌘\\",
      onRun: () => {
        leftOpen = !leftOpen;
      },
    },
    {
      id: "view:toggle-right",
      label: rightOpen ? "View: Hide Outline" : "View: Show Outline",
      hint: "⌘⇧\\",
      onRun: () => {
        rightOpen = !rightOpen;
      },
    },
    {
      id: "theme:smoke",
      label: "Theme: Smoke",
      keywords: ["sage", "dark"],
      onRun: () => {
        applyTheme("smoke");
        currentTheme = "smoke";
      },
    },
    {
      id: "theme:amber",
      label: "Theme: Amber",
      keywords: ["paper", "warm"],
      onRun: () => {
        applyTheme("amber");
        currentTheme = "amber";
      },
    },
    {
      id: "appearance:system",
      label: "Appearance: Follow System",
      onRun: () => applyAppearance("system"),
    },
    { id: "appearance:light", label: "Appearance: Light", onRun: () => applyAppearance("light") },
    { id: "appearance:dark", label: "Appearance: Dark", onRun: () => applyAppearance("dark") },
    {
      id: "edit:find",
      label: "Edit: Find…",
      hint: "⌘F",
      onRun: () => view && openFind(view),
    },
    {
      id: "edit:replace",
      label: "Edit: Find & Replace…",
      hint: "⌘⌥F",
      onRun: () => view && openReplace(view),
    },
    {
      id: "edit:spell-check",
      label: spellOn ? "Edit: Disable Spell Check" : "Edit: Enable Spell Check",
      onRun: () => {
        spellOn = !spellOn;
        if (view) setSpellCheck(view, spellOn);
      },
    },
    {
      id: "edit:smart-punct",
      label: smartPunct
        ? "Edit: Disable Smart Punctuation"
        : "Edit: Enable Smart Punctuation",
      keywords: ["curly", "quotes", "em", "dash"],
      onRun: () => {
        smartPunct = !smartPunct;
        if (view) setSmartPunctuation(view, smartPunct);
      },
    },
    {
      id: "view:toggle-line-numbers",
      label: lineNumsOn ? "View: Hide Line Numbers" : "View: Show Line Numbers",
      keywords: ["gutter", "numbers"],
      onRun: () => {
        lineNumsOn = !lineNumsOn;
        if (view) setLineNumbers(view, lineNumsOn);
      },
    },
    {
      id: "mode:vim",
      label: vimOn ? "Editor Mode: Default" : "Editor Mode: Vim",
      onRun: () => {
        vimOn = !vimOn;
        if (view) setVim(view, vimOn);
      },
    },
    {
      id: "export:html",
      label: "Export: HTML…",
      onRun: async () => {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const target = await save({
          defaultPath: "export.html",
          filters: [{ name: "HTML", extensions: ["html"] }],
        });
        if (typeof target === "string") {
          await exportHtml(target, tabs.active.contents, currentTheme);
        }
      },
    },
    {
      id: "export:docx",
      label: "Export: DOCX… (Word)",
      keywords: ["word", "office", "pandoc"],
      onRun: async () => {
        const { save } = await import("@tauri-apps/plugin-dialog");
        const target = await save({
          defaultPath: "export.docx",
          filters: [{ name: "Word document", extensions: ["docx"] }],
        });
        if (typeof target === "string") {
          try {
            await exportDocx(target, tabs.active.contents);
          } catch (e) {
            alert(
              `DOCX export failed:\n\n${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
      },
    },
    {
      id: "export:copy-rich",
      label: "Export: Copy as Rich Text",
      hint: "⌘⇧C",
      onRun: async () => {
        const html = await renderHtmlForClipboard(tabs.active.contents, currentTheme);
        const blob = new Blob([html], { type: "text/html" });
        const plain = new Blob([tabs.active.contents], { type: "text/plain" });
        await navigator.clipboard.write([
          new ClipboardItem({ "text/html": blob, "text/plain": plain }),
        ]);
      },
    },
    ...recents.list.map((p) => ({
      id: `recent:${p}`,
      label: `Recent: ${p.split("/").pop() ?? p}`,
      hint: p,
      keywords: ["open", "recent"],
      onRun: () => void loadPath(p),
    })),
  ]);

  let fileItems = $derived<PaletteItem[]>(
    workspaceFiles.map((f) => ({
      id: `file:${f.path}`,
      label: f.name,
      hint: f.path,
      keywords: [f.path],
      onRun: () => void loadPath(f.path),
    })),
  );

  let headingItems = $derived<PaletteItem[]>(
    outline.entries.map((h, i) => ({
      id: `heading:${i}:${h.byte_offset}`,
      label: `${"  ".repeat(Math.max(0, h.level - 1))}${h.text}`,
      hint: `H${h.level}`,
      keywords: [h.text],
      onRun: () => jumpTo(h.byte_offset),
    })),
  );
</script>

<div class="layout" class:focus={focusMode} class:left-open={leftOpen} class:right-open={rightOpen}>
  {#if leftOpen && !focusMode}
    <LeftRail
      tabs={tabs.list}
      activeId={tabs.activeId}
      onSelectTab={selectTab}
      onCloseTab={closeTab}
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
    <div class="editor-wrap">
      <div bind:this={container} class="editor"></div>
    </div>
    {#if !focusMode}
      <StatusBar
        path={tabs.active.path}
        dirty={tabs.active.dirty}
        wordCount={activeWordCount}
        charCount={activeCharCount}
        readingMin={activeReadingMin}
      />
    {/if}
  </main>

  {#if rightOpen && !focusMode}
    <aside class="right-rail">
      <OutlinePanel entries={outline.entries} onJump={jumpTo} />
    </aside>
  {/if}
</div>

<CommandPalette
  open={paletteMode !== "none"}
  items={paletteMode === "files"
    ? fileItems
    : paletteMode === "headings"
      ? headingItems
      : commandItems}
  placeholder={paletteMode === "files"
    ? "Go to file…"
    : paletteMode === "headings"
      ? "Jump to heading…"
      : "Type a command…"}
  onClose={() => (paletteMode = "none")}
/>

<style>
  .layout {
    display: grid;
    grid-template-columns: 0 1fr 0;
    height: 100vh;
    overflow: hidden;
  }
  .layout.left-open {
    grid-template-columns: 240px 1fr 0;
  }
  .layout.right-open {
    grid-template-columns: 0 1fr 240px;
  }
  .layout.left-open.right-open {
    grid-template-columns: 240px 1fr 240px;
  }
  .layout.focus {
    grid-template-columns: 1fr;
  }
  main {
    grid-column: 2;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    min-width: 0;
  }
  /* editor-wrap stretches across main and centers the editor column. */
  .editor-wrap {
    flex: 1;
    overflow: hidden;
    display: flex;
    justify-content: center;
    min-height: 0;
  }
  .editor {
    width: 100%;
    max-width: 720px;
    overflow: hidden;
  }
  :global(.cm-editor) {
    height: 100%;
  }
  .right-rail {
    grid-column: 3;
    border-left: 1px solid var(--md-rule);
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.04);
  }
  :global(:root[data-appearance="dark"]) .right-rail {
    background: rgba(0, 0, 0, 0.18);
  }
</style>
