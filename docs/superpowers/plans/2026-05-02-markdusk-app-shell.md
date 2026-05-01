# Markdusk App Shell Implementation Plan (Plan 2 of 6)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task.

**Goal:** Vertical tabs, file tree from an open folder, outline (TOC) panel from the active document, toggle keybindings, File → Open Folder menu wiring. Multi-window and session restore are deferred to Plan 2.5 (or absorbed into Plan 4 Polish if minor).

**Architecture:** Pure Svelte 5 runes-based stores for tab/workspace/outline state. New Rust IPC command `list_workspace` walks a directory and returns a tree. The existing single-document store becomes one tab inside a tabs store. Layout grid expands from `[editor]` to `[left rail | editor | right rail]`.

**Tech Stack:** Existing — Svelte 5, CodeMirror 6, Tauri 2, pulldown-cmark.

---

## File Structure (delta from Plan 1)

```
src/
├── lib/
│   ├── stores/
│   │   ├── document.svelte.ts          (existing)
│   │   ├── tabs.svelte.ts              (NEW — multi-tab store)
│   │   ├── tabs.svelte.test.ts         (NEW)
│   │   ├── workspace.svelte.ts         (NEW — open folder, files)
│   │   └── outline.svelte.ts           (NEW — TOC of active doc)
│   ├── components/
│   │   ├── LeftRail.svelte             (NEW — vertical tabs + file tree)
│   │   ├── VerticalTabs.svelte         (NEW)
│   │   ├── FileTree.svelte             (NEW — recursive)
│   │   ├── OutlinePanel.svelte         (NEW — right rail)
│   │   └── StatusBar.svelte            (NEW — extracted from App.svelte footer)
│   └── ipc/
│       └── commands.ts                 (extended)

crates/markdusk-core/src/
├── workspace.rs                        (NEW — list_workspace)
└── outline.rs                          (NEW — heading extraction from ParsedDoc)

crates/markdusk-app/src/
└── commands.rs                         (extended)
```

---

## Task 1: `markdusk-core::outline` — extract heading TOC from parsed doc

**Files:**
- Modify: `crates/markdusk-core/src/lib.rs` (add `pub mod outline`)
- Create: `crates/markdusk-core/src/outline.rs`

- [ ] **Step 1: Implement + tests**

```rust
// crates/markdusk-core/src/outline.rs
use crate::parser::parse;
use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
pub struct OutlineEntry {
    pub level: u8,
    pub text: String,
    pub byte_offset: usize,
}

pub fn outline(source: &str) -> Vec<OutlineEntry> {
    use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag};
    let parser = Parser::new_ext(
        source,
        Options::ENABLE_TABLES
            | Options::ENABLE_TASKLISTS
            | Options::ENABLE_FOOTNOTES
            | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS,
    )
    .into_offset_iter();

    let mut entries = Vec::new();
    let mut current: Option<(u8, String, usize)> = None;

    for (event, range) in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                let lvl = match level {
                    HeadingLevel::H1 => 1,
                    HeadingLevel::H2 => 2,
                    HeadingLevel::H3 => 3,
                    HeadingLevel::H4 => 4,
                    HeadingLevel::H5 => 5,
                    HeadingLevel::H6 => 6,
                };
                current = Some((lvl, String::new(), range.start));
            }
            Event::Text(t) => {
                if let Some((_, ref mut text, _)) = current {
                    text.push_str(&t);
                }
            }
            Event::End(pulldown_cmark::TagEnd::Heading(_)) => {
                if let Some((level, text, byte_offset)) = current.take() {
                    entries.push(OutlineEntry { level, text, byte_offset });
                }
            }
            _ => {}
        }
    }

    // Suppress unused-import on parse if reorganized later
    let _ = parse;
    entries
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_doc_has_no_outline() {
        assert_eq!(outline(""), vec![]);
    }

    #[test]
    fn extracts_atx_headings_with_levels() {
        let src = "# A\n\n## B\n\nbody\n\n### C";
        let o = outline(src);
        assert_eq!(o.len(), 3);
        assert_eq!(o[0], OutlineEntry { level: 1, text: "A".into(), byte_offset: 0 });
        assert_eq!(o[1].level, 2);
        assert_eq!(o[1].text, "B");
        assert_eq!(o[2].level, 3);
        assert_eq!(o[2].text, "C");
    }

    #[test]
    fn ignores_paragraphs_and_lists() {
        let src = "para\n\n- item\n\n# only this";
        let o = outline(src);
        assert_eq!(o.len(), 1);
        assert_eq!(o[0].text, "only this");
    }
}
```

- [ ] **Step 2:** `cargo test -p markdusk-core outline::tests` — 3 passed.
- [ ] **Step 3:** Commit `feat(core): outline — extract heading TOC from markdown source`

---

## Task 2: `markdusk-core::workspace` — list files in a folder

**Files:**
- Modify: `crates/markdusk-core/src/lib.rs` (add `pub mod workspace`)
- Create: `crates/markdusk-core/src/workspace.rs`

- [ ] **Step 1: Implement**

```rust
// crates/markdusk-core/src/workspace.rs
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
pub struct FileNode {
    pub name: String,
    pub path: PathBuf,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

const MAX_DEPTH: usize = 8;
const MAX_ENTRIES_PER_DIR: usize = 500;

pub async fn list_workspace(root: &Path) -> std::io::Result<FileNode> {
    walk(root, 0).await
}

fn walk(path: &Path, depth: usize) -> std::pin::Pin<Box<dyn Future<Output = std::io::Result<FileNode>> + Send + '_>> {
    use std::future::Future;
    Box::pin(async move {
        let metadata = tokio::fs::metadata(path).await?;
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string_lossy().into_owned());

        if !metadata.is_dir() {
            return Ok(FileNode {
                name,
                path: path.to_path_buf(),
                is_dir: false,
                children: vec![],
            });
        }

        let mut children = Vec::new();
        if depth < MAX_DEPTH {
            let mut entries = tokio::fs::read_dir(path).await?;
            let mut count = 0;
            while let Some(entry) = entries.next_entry().await? {
                if count >= MAX_ENTRIES_PER_DIR {
                    break;
                }
                count += 1;
                let entry_path = entry.path();
                let file_name = entry.file_name().to_string_lossy().into_owned();
                // Skip dotfiles and common build/git directories.
                if file_name.starts_with('.')
                    || file_name == "node_modules"
                    || file_name == "target"
                    || file_name == "dist"
                {
                    continue;
                }
                let entry_metadata = entry.metadata().await?;
                if entry_metadata.is_dir() {
                    children.push(walk(&entry_path, depth + 1).await?);
                } else {
                    let lower = file_name.to_lowercase();
                    if lower.ends_with(".md")
                        || lower.ends_with(".markdown")
                        || lower.ends_with(".mdown")
                    {
                        children.push(FileNode {
                            name: file_name,
                            path: entry_path,
                            is_dir: false,
                            children: vec![],
                        });
                    }
                }
            }
            children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            });
        }

        Ok(FileNode {
            name,
            path: path.to_path_buf(),
            is_dir: true,
            children,
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn lists_markdown_files_only() {
        let tmp = TempDir::new().unwrap();
        tokio::fs::write(tmp.path().join("a.md"), "x").await.unwrap();
        tokio::fs::write(tmp.path().join("b.txt"), "y").await.unwrap();
        tokio::fs::write(tmp.path().join("c.markdown"), "z").await.unwrap();
        let tree = list_workspace(tmp.path()).await.unwrap();
        assert!(tree.is_dir);
        assert_eq!(tree.children.len(), 2);
        let names: Vec<_> = tree.children.iter().map(|c| c.name.clone()).collect();
        assert!(names.contains(&"a.md".to_string()));
        assert!(names.contains(&"c.markdown".to_string()));
    }

    #[tokio::test]
    async fn recurses_into_subdirs() {
        let tmp = TempDir::new().unwrap();
        tokio::fs::create_dir(tmp.path().join("nested")).await.unwrap();
        tokio::fs::write(tmp.path().join("nested").join("a.md"), "x").await.unwrap();
        let tree = list_workspace(tmp.path()).await.unwrap();
        assert_eq!(tree.children.len(), 1);
        assert!(tree.children[0].is_dir);
        assert_eq!(tree.children[0].children.len(), 1);
        assert_eq!(tree.children[0].children[0].name, "a.md");
    }

    #[tokio::test]
    async fn dirs_sort_before_files() {
        let tmp = TempDir::new().unwrap();
        tokio::fs::write(tmp.path().join("a.md"), "x").await.unwrap();
        tokio::fs::create_dir(tmp.path().join("zfolder")).await.unwrap();
        tokio::fs::write(tmp.path().join("zfolder").join("z.md"), "z").await.unwrap();
        let tree = list_workspace(tmp.path()).await.unwrap();
        assert!(tree.children[0].is_dir, "dir should be first even with later name");
        assert_eq!(tree.children[0].name, "zfolder");
    }

    #[tokio::test]
    async fn skips_dotfiles_and_common_build_dirs() {
        let tmp = TempDir::new().unwrap();
        tokio::fs::create_dir(tmp.path().join("node_modules")).await.unwrap();
        tokio::fs::create_dir(tmp.path().join(".hidden")).await.unwrap();
        tokio::fs::write(tmp.path().join("real.md"), "x").await.unwrap();
        let tree = list_workspace(tmp.path()).await.unwrap();
        assert_eq!(tree.children.len(), 1);
        assert_eq!(tree.children[0].name, "real.md");
    }
}
```

- [ ] **Step 2:** `cargo test -p markdusk-core workspace::tests` — 4 passed.
- [ ] **Step 3:** Commit `feat(core): workspace — recursive markdown file tree with depth/count limits`

---

## Task 3: Tauri commands `list_workspace` + `outline_for`

**Files:**
- Modify: `crates/markdusk-app/src/commands.rs`
- Modify: `crates/markdusk-app/src/lib.rs` (register new commands)

- [ ] **Step 1: Append commands**

```rust
// at top of commands.rs (existing imports stay)
use markdusk_core::outline::{outline, OutlineEntry};
use markdusk_core::workspace::{list_workspace, FileNode};

#[tauri::command]
pub async fn list_workspace_cmd(root: String) -> Result<FileNode, String> {
    list_workspace(std::path::Path::new(&root))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn outline_cmd(source: String) -> Vec<OutlineEntry> {
    outline(&source)
}
```

- [ ] **Step 2:** Register in `lib.rs`'s `invoke_handler`:

```rust
.invoke_handler(tauri::generate_handler![
    commands::open_file,
    commands::save_file,
    commands::list_workspace_cmd,
    commands::outline_cmd,
])
```

- [ ] **Step 3:** Add to `src/lib/ipc/commands.ts`:

```ts
import { invoke } from "@tauri-apps/api/core";
import type { Document, FileNode, OutlineEntry } from "./types.gen";

export async function openFile(path: string): Promise<Document> {
  return await invoke<Document>("open_file", { path });
}

export async function saveFile(path: string, contents: string): Promise<void> {
  await invoke<void>("save_file", { path, contents });
}

export async function listWorkspace(root: string): Promise<FileNode> {
  return await invoke<FileNode>("list_workspace_cmd", { root });
}

export async function outlineFor(source: string): Promise<OutlineEntry[]> {
  return await invoke<OutlineEntry[]>("outline_cmd", { source });
}
```

- [ ] **Step 4:** `cargo test --workspace` + `cargo fmt --check` + `cargo clippy --workspace --all-targets -- -D warnings` + `pnpm exec svelte-check` all green.
- [ ] **Step 5:** Commit `feat(app): IPC commands list_workspace_cmd and outline_cmd`

---

## Task 4: Tabs store

**Files:**
- Create: `src/lib/stores/tabs.svelte.ts`
- Create: `src/lib/stores/tabs.svelte.test.ts`

- [ ] **Step 1: Test**

```ts
// src/lib/stores/tabs.svelte.test.ts
import { describe, it, expect, vi } from "vitest";
import { createTabsStore } from "./tabs.svelte";

const noopSaver = vi.fn(async () => {});

describe("tabsStore", () => {
  it("starts with one untitled tab as active", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    expect(tabs.list.length).toBe(1);
    expect(tabs.activeId).toBe(tabs.list[0].id);
    expect(tabs.active.path).toBeNull();
  });

  it("opens a new tab and makes it active", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    const id = tabs.openNew();
    expect(tabs.list.length).toBe(2);
    expect(tabs.activeId).toBe(id);
  });

  it("closing the last tab leaves one untitled tab", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    tabs.close(tabs.activeId);
    expect(tabs.list.length).toBe(1);
    expect(tabs.active.path).toBeNull();
  });

  it("loadFile reuses an open tab if the path matches", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    tabs.loadFile("/tmp/a.md", "alpha");
    const idA = tabs.activeId;
    tabs.openNew();
    tabs.loadFile("/tmp/b.md", "beta");
    tabs.loadFile("/tmp/a.md", "alpha-again");
    expect(tabs.activeId).toBe(idA);
    expect(tabs.list.length).toBe(2);
  });

  it("update marks the active tab dirty", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    tabs.loadFile("/tmp/x.md", "");
    tabs.update("hi");
    expect(tabs.active.dirty).toBe(true);
    expect(tabs.active.contents).toBe("hi");
  });
});
```

- [ ] **Step 2: Implement**

```ts
// src/lib/stores/tabs.svelte.ts
type Saver = (path: string, contents: string) => Promise<void>;

export interface Tab {
  id: string;
  path: string | null;
  contents: string;
  dirty: boolean;
}

export interface TabsStore {
  readonly list: Tab[];
  readonly activeId: string;
  readonly active: Tab;
  openNew(): string;
  loadFile(path: string, contents: string): string;
  setActive(id: string): void;
  close(id: string): void;
  update(next: string): void;
  saveActiveNow(): Promise<void>;
}

interface Deps {
  saver: Saver;
  debounceMs?: number;
}

let nextId = 1;
const newId = () => `tab-${nextId++}`;

export function createTabsStore(deps: Deps): TabsStore {
  const debounceMs = deps.debounceMs ?? 800;
  let list = $state<Tab[]>([{ id: newId(), path: null, contents: "", dirty: false }]);
  let activeId = $state(list[0].id);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const indexOf = (id: string) => list.findIndex((t) => t.id === id);

  const flush = async (id: string) => {
    const t = timers.get(id);
    if (t) {
      clearTimeout(t);
      timers.delete(id);
    }
    const i = indexOf(id);
    if (i < 0) return;
    const tab = list[i];
    if (!tab.path || !tab.dirty) return;
    await deps.saver(tab.path, tab.contents);
    list[i] = { ...tab, dirty: false };
  };

  const scheduleFlush = (id: string) => {
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    timers.set(
      id,
      setTimeout(() => {
        void flush(id);
      }, debounceMs),
    );
  };

  return {
    get list() {
      return list;
    },
    get activeId() {
      return activeId;
    },
    get active() {
      return list[indexOf(activeId)] ?? list[0];
    },
    openNew() {
      const tab: Tab = { id: newId(), path: null, contents: "", dirty: false };
      list = [...list, tab];
      activeId = tab.id;
      return tab.id;
    },
    loadFile(path, contents) {
      const existing = list.findIndex((t) => t.path === path);
      if (existing >= 0) {
        list[existing] = { ...list[existing], contents, dirty: false };
        activeId = list[existing].id;
        return list[existing].id;
      }
      const tab: Tab = { id: newId(), path, contents, dirty: false };
      // If the only tab is an untouched untitled, replace it.
      if (
        list.length === 1 &&
        list[0].path === null &&
        list[0].contents === "" &&
        !list[0].dirty
      ) {
        list = [tab];
      } else {
        list = [...list, tab];
      }
      activeId = tab.id;
      return tab.id;
    },
    setActive(id) {
      if (indexOf(id) >= 0) activeId = id;
    },
    close(id) {
      const i = indexOf(id);
      if (i < 0) return;
      list = list.filter((t) => t.id !== id);
      timers.get(id)?.[Symbol.toPrimitive]
        ? clearTimeout(timers.get(id)!)
        : timers.delete(id);
      if (list.length === 0) {
        list = [{ id: newId(), path: null, contents: "", dirty: false }];
      }
      if (activeId === id) {
        activeId = list[Math.min(i, list.length - 1)].id;
      }
    },
    update(next) {
      const i = indexOf(activeId);
      if (i < 0) return;
      const tab = list[i];
      if (next === tab.contents) return;
      list[i] = { ...tab, contents: next, dirty: true };
      scheduleFlush(tab.id);
    },
    saveActiveNow() {
      return flush(activeId);
    },
  };
}
```

- [ ] **Step 3:** `pnpm test src/lib/stores/tabs.svelte.test.ts` — 5 passed.
- [ ] **Step 4:** Commit `feat(stores): tabs store with multi-document state and per-tab debounced save`

---

## Task 5: Workspace + outline stores

**Files:**
- Create: `src/lib/stores/workspace.svelte.ts`
- Create: `src/lib/stores/outline.svelte.ts`

- [ ] **Step 1: Workspace store**

```ts
// src/lib/stores/workspace.svelte.ts
import { listWorkspace } from "$lib/ipc/commands";
import type { FileNode } from "$lib/ipc/types.gen";

export interface WorkspaceStore {
  readonly root: FileNode | null;
  open(path: string): Promise<void>;
  refresh(): Promise<void>;
  clear(): void;
}

export function createWorkspaceStore(): WorkspaceStore {
  let root = $state<FileNode | null>(null);
  let rootPath = $state<string | null>(null);

  return {
    get root() {
      return root;
    },
    async open(path) {
      rootPath = path;
      root = await listWorkspace(path);
    },
    async refresh() {
      if (rootPath) root = await listWorkspace(rootPath);
    },
    clear() {
      root = null;
      rootPath = null;
    },
  };
}
```

- [ ] **Step 2: Outline store**

```ts
// src/lib/stores/outline.svelte.ts
import { outlineFor } from "$lib/ipc/commands";
import type { OutlineEntry } from "$lib/ipc/types.gen";

export interface OutlineStore {
  readonly entries: OutlineEntry[];
  refresh(source: string): Promise<void>;
}

export function createOutlineStore(): OutlineStore {
  let entries = $state<OutlineEntry[]>([]);
  let pending: Promise<void> | null = null;

  return {
    get entries() {
      return entries;
    },
    refresh(source) {
      // Coalesce in-flight requests.
      const p = (async () => {
        const next = await outlineFor(source);
        entries = next;
      })();
      pending = p;
      return p;
    },
  };
}
```

- [ ] **Step 3:** Commit `feat(stores): workspace and outline stores`

(No tests for workspace/outline yet — they're thin IPC wrappers; behavior is covered by the Rust tests in Tasks 1-2 and the integration test in Task 9.)

---

## Task 6: Components

**Files:**
- Create: `src/lib/components/VerticalTabs.svelte`
- Create: `src/lib/components/FileTree.svelte`
- Create: `src/lib/components/OutlinePanel.svelte`
- Create: `src/lib/components/StatusBar.svelte`
- Create: `src/lib/components/LeftRail.svelte`

- [ ] **Step 1: VerticalTabs.svelte**

```svelte
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
```

- [ ] **Step 2: FileTree.svelte**

```svelte
<script lang="ts">
  import type { FileNode } from "$lib/ipc/types.gen";

  interface Props {
    node: FileNode;
    onOpen: (path: string) => void;
    depth?: number;
  }

  let { node, onOpen, depth = 0 }: Props = $props();
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
      <svelte:self node={child} {onOpen} depth={depth + 1} />
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
```

- [ ] **Step 3: OutlinePanel.svelte**

```svelte
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
```

- [ ] **Step 4: StatusBar.svelte**

```svelte
<script lang="ts">
  interface Props {
    path: string | null;
    dirty: boolean;
    wordCount: number;
  }

  let { path, dirty, wordCount }: Props = $props();
  let readMin = $derived(Math.max(1, Math.round(wordCount / 220)));
</script>

<footer class="status">
  <span>{dirty ? "● " : ""}{path ?? "Untitled"}</span>
  <span>{wordCount} words · {readMin} min · ⌘\\ files · ⌘⇧\\ outline · ⌘⇧F focus</span>
</footer>

<style>
  .status {
    display: flex;
    justify-content: space-between;
    padding: 6px 14px;
    font-size: 11px;
    color: var(--md-muted);
    border-top: 1px solid var(--md-rule);
    font-family:
      -apple-system,
      BlinkMacSystemFont,
      "Segoe UI",
      sans-serif;
  }
</style>
```

- [ ] **Step 5: LeftRail.svelte**

```svelte
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
```

- [ ] **Step 6:** `pnpm exec svelte-check` — 0 errors. (No unit tests for these — they're thin presentational components; exercised by App.svelte integration in Task 7.)
- [ ] **Step 7:** Commit `feat(ui): VerticalTabs / FileTree / OutlinePanel / StatusBar / LeftRail components`

---

## Task 7: Wire it all together in App.svelte

**Files:**
- Modify: `src/routes/App.svelte`

- [ ] **Step 1: Replace App.svelte with the multi-tab + sidebars layout**

```svelte
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

  // When the active tab changes, swap the editor's contents.
  $effect(() => {
    const id = tabs.activeId;
    if (id === lastTabId) return;
    lastTabId = id;
    untrack(() => {
      syncEditor(tabs.active.contents);
    });
  });

  // Refresh outline whenever active doc contents change.
  $effect(() => {
    const text = tabs.active.contents;
    void outline.refresh(text);
  });

  onMount(() => {
    view = createEditor(container, tabs.active.contents, (next) => tabs.update(next));

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
        case "view:toggle-left":
          leftOpen = !leftOpen;
          break;
        case "view:toggle-right":
          rightOpen = !rightOpen;
          break;
        case "view:focus":
          focusMode = !focusMode;
          break;
      }
    });

    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey) return;
      if (e.key === "s") {
        e.preventDefault();
        void tabs.saveActiveNow();
      } else if (e.key === "\\" && e.shiftKey && e.altKey === false) {
        // CmdOrCtrl+Shift+\\ → toggle outline. Browser-level shortcut handler in case
        // the native menu accelerator hasn't propagated.
        e.preventDefault();
        rightOpen = !rightOpen;
      } else if (e.key === "\\") {
        e.preventDefault();
        leftOpen = !leftOpen;
      } else if (e.key === "F" && e.shiftKey) {
        e.preventDefault();
        focusMode = !focusMode;
      } else if (e.key === "n") {
        // Already handled by the menu via Cmd+N — let macOS dispatch.
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

  function jumpTo(byteOffset: number) {
    if (!view) return;
    view.dispatch({
      selection: EditorSelection.single(byteOffset),
      effects: [],
      scrollIntoView: true,
    });
    view.focus();
  }
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
  :global(:root[data-appearance="dark"]) .right-rail,
  :global(:root:not([data-appearance])) .right-rail {
    background: rgba(0, 0, 0, 0.18);
  }
</style>
```

- [ ] **Step 2:** `pnpm exec svelte-check` — 0 errors. `pnpm test` — all green. `pnpm build` — succeeds.
- [ ] **Step 3:** Commit `feat: multi-tab editor with file tree, outline panel, and toggle keybindings`

---

## Task 8: File → Open Folder menu item

**Files:**
- Modify: `crates/markdusk-app/src/menu.rs`
- Modify: `src/routes/App.svelte` (handle `file:open-folder`)

- [ ] **Step 1: Add `file:open-folder` menu item to the File submenu, accelerator `CmdOrCtrl+Shift+O`.**
- [ ] **Step 2: Handle in App.svelte's menu listener — call `openFolderDialog()`.**
- [ ] **Step 3:** Build + verify menu shows the item. Commit `feat(menu): File → Open Folder…`

---

## Closing checklist

- [ ] All Rust + frontend tests green
- [ ] `cargo fmt --check` + `cargo clippy --all-targets -- -D warnings` clean
- [ ] `pnpm exec svelte-check` clean
- [ ] `pnpm build` succeeds
- [ ] `pnpm tauri dev` opens an app where:
  - ⌘\\ toggles left rail (vertical tabs + workspace)
  - ⌘⇧\\ toggles right rail (outline)
  - ⌘⇧F enters/exits focus mode
  - ⌘1-9 switches tabs
  - File → Open Folder loads a folder; clicking a `.md` opens it in a tab
  - Editing one tab and switching to another preserves contents
  - Outline updates as you type and clicking jumps the cursor

When checked, append a Completion summary to this file and proceed to Plan 3.
