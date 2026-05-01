# Markdusk — Design Spec

**Status:** Draft for review
**Date:** 2026-05-01
**Author:** Pavol + Claude (brainstormed via superpowers)

## Summary

Markdusk is a beautiful, fast, native-feeling Mac markdown editor with **soft WYSIWYG / live preview** as its default writing surface. Tabs are vertical (Arc-style), the workspace tree lives in the same left rail, and an outline panel sits on the right. It ships with two distinctive built-in themes — **Smoke** (smoke greys + sage accent, default) and **Amber** (warm cream + ember accent) — and aims to be the user's default `.md` application on macOS.

The implementation is **Tauri 2 (Rust) + Svelte 5 + CodeMirror 6**. All non-UI logic lives in a pure-Rust core crate that is fully testable headlessly. A separate Swift companion target ships the Quick Look generator. Test discipline is strict TDD with persona-driven acceptance subagents.

A separate spec, `2026-05-01-all-rust-editor-spinoff.md`, captures the all-Rust (floem) version as a future independent project.

## Goals

1. **Default markdown editor on macOS** — claim `.md`, register UTI, support `open` from Finder, recents, "Open With".
2. **Beautiful and distinctive** — typography-first, two coherent themes, no derivative aesthetics.
3. **Soft WYSIWYG** — markdown syntax visible only on the active line; everywhere else, content is rendered.
4. **Fast** — cold start ≤ 500 ms; keystroke latency ≤ 6 ms p95 on 100 KB documents.
5. **Multi-document workflow** — vertical tabs, multiple windows, restore session on launch.
6. **Confident testing** — TDD throughout; four persona subagents validate flows that unit tests cannot.

## Non-goals (v1)

- Backlinks / wiki-link graph (a different product — that's Obsidian's territory).
- DOCX export (requires Pandoc; rich-text clipboard + HTML + PDF cover the share-this-doc need).
- Custom user themes / user CSS (two excellent built-in themes ship instead; user themes are a v2 feature once the engine stabilizes).
- Cross-platform — macOS only for v1. The architecture does not preclude later Windows/Linux but is not a constraint.
- Cloud sync — files live where they live; users handle iCloud / Dropbox / Git themselves.
- Plugins — defer until the core surface stabilizes.

## Visual design

**Default theme: Markdusk Smoke**
- Light: linen `#eee9de` paper, graphite `#2a2c2c` body, sage-teal `#3d6a5e` heading + accent.
- Dark: smoke `#1d2222` background, parchment `#dcd6c4` body, sage `#88b3a4` accent.
- Quote rule and active-line indicator use the sage accent.

**Alternate theme: Markdusk Amber**
- Light: warm cream `#f4ecdb` paper, slate `#28323e` body, ember-copper `#b85c2a` accent.
- Dark: deep slate `#1a2230` background, parchment body, ember `#e08a4a` accent.

**Typography**
- Body: bundled OFL serifs — **Source Serif 4** for Smoke, **Crimson Pro** for Amber. Bundled in `app/fonts/`; never relies on system fallback.
- UI chrome (tabs, menus, status bar, sidebar): **Inter** (bundled).
- Code: **JetBrains Mono** (bundled).
- Headings, body, code all share consistent vertical rhythm. Body line-height 1.65, max-width 720 px.

**Layout (one window)**
- Title bar with macOS traffic lights at the left; the active document filename appears in the title (native macOS behavior).
- Left rail (220 px, toggle `⌘\`): vertical tabs at top, workspace file tree below. Both have section labels.
- Center: editor pane, soft WYSIWYG via CodeMirror, content column capped at 720 px and centered within the pane.
- Right rail (220 px, toggle `⌘⇧\`): outline (TOC) of the active document, click-to-jump.
- Status bar: filename, word count, mode hints.
- Distraction-free / typewriter mode (`⌘⇧F`): hide both rails and status bar; centerline scroll.

## Architecture

```
┌─────────────────────── Markdusk.app ───────────────────────┐
│                                                            │
│  Tauri 2 backend (Rust)                                    │
│   • markdusk-core       — pure logic, headlessly testable  │
│   • markdusk-app        — Tauri shell, IPC, native menus   │
│                                                            │
│  Frontend (TypeScript / Svelte 5)                          │
│   • markdusk-ui         — CodeMirror 6 + theme + chrome    │
│                                                            │
│  Companion targets                                         │
│   • markdusk-quicklook  — Swift, .qlgenerator bundle       │
└────────────────────────────────────────────────────────────┘
```

The workspace has two Rust crates, a Svelte 5 frontend, and a Swift companion target:

- **`markdusk-core`** (Rust library) — parser wrapper, document, workspace, session, export, settings, persona harness. **No Tauri imports.** All file I/O, all parsing, all export logic. Fully unit/property/benchmark-tested.
- **`markdusk-app`** (Rust binary, Tauri shell) — wires `markdusk-core` to IPC commands, native menus, window/tab lifecycle. Thin.
- **`markdusk-ui`** (Svelte 5 frontend, not a Rust crate; lives in `src/`) — editor surface, theme CSS, layout chrome, stores. Communicates with backend only via Tauri IPC commands.
- **`markdusk-quicklook`** (Swift Xcode project under `qlgenerator/`) — `.qlgenerator` bundle for Finder Quick Look. Built by `cargo xtask build-quicklook`. Bundles `markdusk-core`'s HTML export via FFI.

## Components and data shapes

```
markdusk-core/
├── parser/         pulldown-cmark wrapper with byte-position spans
├── document/       Document {path, contents, dirty, encoding, frontmatter}
├── workspace/      Workspace {root, files, watcher}
├── session/        SessionStore — sqlite-backed restored tabs/windows
├── export/         html / pdf / rich_clipboard
├── settings/       theme, font, font_size, behavior toggles
└── persona_harness/ test driver — opens app, drives keystrokes, asserts

markdusk-app/src-tauri/
├── commands/       open_file, save_file, export_pdf, list_workspace, ...
├── menu/           native macOS menu (File, Edit, View, Format, Window, Help)
├── window/         tab/window manager
└── main.rs

markdusk-ui/src/
├── editor/         CodeMirror 6 setup + Markdusk live-preview extension
├── theme/          smoke.css, amber.css (CSS custom properties)
├── components/     LeftRail, VerticalTabs, FileTree, OutlinePanel, StatusBar
├── stores/         tabs, activeFile, settings (Svelte 5 runes)
└── routes/+page.svelte
```

TypeScript types are generated from Rust via `ts-rs`:

```typescript
type Document  = { path: string|null, contents: string, dirty: boolean,
                   encoding: 'utf-8', frontmatter?: Record<string, unknown> }
type Tab       = { id: string, doc: Document, scrollPos: number, cursor: Pos }
type Workspace = { root: string|null, files: FileNode[] }
type Session   = { windows: { tabs: Tab[], activeTabId: string }[] }
```

## Feature scope (v1)

**Markdown rendering**
- CommonMark + GitHub Flavored Markdown (tables, task lists, strikethrough, autolinks, fenced code).
- Code syntax highlighting via tree-sitter (~30 popular languages bundled).
- Math via KaTeX (inline `$...$` and block `$$...$$`).
- Footnotes; YAML frontmatter parsed and stylized.
- Mermaid diagrams (rendered to SVG, cached by content hash).

**Editing experience**
- Soft WYSIWYG / live preview — markdown syntax visible only on the active line.
- Find & Replace with regex (`⌘F`, `⌘⌥F`).
- Image paste & drag-drop — saves next to the `.md`, inserts relative link.
- Word count, character count, reading-time estimate (status bar).
- Auto-save: debounced 800 ms after last keystroke; `⌘S` forces flush.
- Spell-check via native macOS `NSSpellChecker` (exposed through WebView).
- Outline / TOC sidebar — click to jump to heading.
- Vim keybindings via `@codemirror/vim` (toggle in settings).
- Typewriter / focus mode — center-line scrolling, dim non-active paragraphs.

**App shell & macOS integration**
- Vertical tabs (Arc-style), drag-to-reorder, `⌘1-9` to switch.
- Multiple windows (`⌘N`).
- Default `.md` app association via `Info.plist` UTI claim.
- Recent files menu (macOS standard list).
- Restore session on launch (last tabs/windows where they were).
- Dark / light theme follows macOS system; manual override in settings.
- Workspace tree (open a folder to browse `.md` files in it). Toggleable.
- Quick Look preview generator (separate Swift target).

**Export**
- HTML — self-contained, theme-styled.
- PDF — via macOS WebKit print system.
- Copy as rich text — paste into Slack/Notion/email looking right.

**Out of scope for v1** — Mermaid live-preview while typing inside the fence (renders only when cursor leaves the block), wikilinks, DOCX export, custom user themes/CSS, plugins.

## Data flow

```
keystroke → CodeMirror state update → Svelte store → debounced 800 ms →
  invoke('save_file', { path, contents }) → Rust atomic write
                                         → session_store.snapshot()

file change on disk → notify watcher → emit('file_changed') →
  Svelte store reconciles → if not dirty: silent reload
                          → if dirty: diff-aware reload dialog

⌘O                  → native dialog → invoke('open_file') → Tab created
⌘T                  → new untitled doc → Tab created
⌘W                  → if dirty: prompt → close Tab → if last: new untitled
⌘E or File → Export → invoke('export_pdf', {html, target}) → WebKit print

launch              → SessionStore.restore() → emit windows/tabs to frontend
```

Single source of truth: **the Rust `Document` is canonical**. The frontend mirrors it. Conflicts are always resolved by re-fetching from Rust.

## Error handling

| Failure | Behavior |
|---|---|
| File doesn't exist on open | Error toast + remove from recents |
| Permission denied on save | Warn dialog + offer "Save As..." |
| File modified externally + dirty in editor | Dialog showing 3-way diff (disk vs editor vs last-saved); options: Reload from disk / Keep mine / Save mine elsewhere |
| Crash during save (power off mid-write) | Atomic-write pattern: write to `.path.tmp`, rename |
| Out-of-memory with huge file | 50 MB hard limit + friendly "use a real editor" message |
| Quick Look bundle fails to register | Silent — main editor still works |
| KaTeX/Mermaid render fails | Inline error block; document stays editable |
| Invalid UTF-8 file | Open as `latin-1` with warning + offer to re-encode |

No silent failures. Every error surfaces as a toast or dialog. Every recoverable error has a "what now?" action.

## Performance budgets (CI fails if exceeded)

- Cold start ≤ 500 ms (M-series Mac, release build).
- Keystroke p95 latency ≤ 6 ms on a 100 KB document.
- Switch tab ≤ 50 ms.
- Open 1 MB file ≤ 80 ms.
- Parse 1 MB markdown to AST ≤ 25 ms.
- Render preview update ≤ 5 ms after parser.

## Testing strategy

| Layer | Tool | Covers |
|---|---|---|
| Rust unit | `cargo test` | parser, document, session, export, settings |
| Rust property | `proptest` | markdown roundtrip invariants, AST stability |
| Rust benchmark | `criterion` | parse 1 MB ≤ 25 ms, render ≤ 5 ms |
| Frontend unit | `vitest` + `@testing-library/svelte` | stores, components, theme |
| Frontend integration | `vitest` | CodeMirror + extension wiring |
| End-to-end | `tauri-driver` + `webdriverio` | full app, real WebView, real keystrokes |
| Visual regression | `playwright` + `pixelmatch` | fixture corpus screenshots |
| Persona acceptance | subagent + e2e harness | four personas |

**TDD discipline** — every feature lands as failing test → implementation → green. Tests live with code (`#[cfg(test)] mod tests`).

**Personas (subagent-driven acceptance):**

1. **Maya the Writer** — drafts essays, pastes images, exports to PDF, cares about typography and focus mode.
2. **Diego the Engineer** — writes README/docs with code blocks, tables, mermaid; opens 5+ tabs; uses vim mode; exports to HTML.
3. **Priya the Researcher** — opens a folder of 50+ markdown files; uses outline + find; builds a long doc with footnotes and math.
4. **Sam the Switcher** — first-time user evaluating Markdusk vs. Bear/Obsidian; judges first-launch UX, default-app setup, theme switching, "feels good?".

Each persona runs as a Claude subagent with a script. The subagent drives the app via the e2e harness and returns a short report (completed steps, broken steps, friction notes). Features aren't "done" until at least one persona's flow exercises them without friction.

## Open questions

None blocking implementation. The following will be revisited as we ship:

- Mermaid live-preview while typing inside the fence — explicitly deferred to v1.1; renders only when the cursor leaves the fence.
- Quick Look bundle distribution — confirmed feasible (separate `.qlgenerator` shipped inside the app bundle, registered via `lsregister`). Implementation details deferred to the implementation plan.
- Notarization & signing strategy — Apple Developer Program required ($99/year). Out of design scope; the app will work unsigned for development.

## Acceptance — v1 ships when:

1. All four personas complete their full flows without friction notes.
2. All performance budgets are green in CI.
3. Default `.md` app association works on a fresh user account.
4. Restore-session-on-launch works across both quit and crash.
5. Both themes pass a visual-regression suite of 30 fixture documents.
6. Export-to-PDF round-trip on a 50-page document with code, tables, math, mermaid is visually correct.
