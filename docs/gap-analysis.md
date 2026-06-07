# Markdusk — Competitive Gap Analysis

Inventory of what Markdusk does today, what its rivals do, and what we must add to make Markdusk a credible default markdown editor on macOS.

Last reviewed: 2026-06-07.

## 1. Markdusk today

What is implemented, sourced from code:

- **Tauri 2 / Rust / Svelte 5 shell**, mac-native window (transparent title bar, hidden title), min macOS 12.0 (`crates/markdusk-app/tauri.conf.json`).
- **CodeMirror 6 editor** with markdown grammar + GFM (tables, tasklists, strikethrough), serif column capped at 720px (`src/lib/editor/editor.ts`).
- **Live-preview decoration** that hides `#`, `*`, `_`, `>`, `` ` ``, link, footnote marks on inactive lines (`src/lib/editor/live-preview.ts`).
- **KaTeX inline + block math** decorations (`src/lib/editor/katex-deco.ts`).
- **Mermaid block decorations** (`src/lib/editor/mermaid-deco.ts`).
- **Code-block syntax highlighting** for JS/TS, HTML, CSS, Rust, Python, JSON, C/C++ (`src/lib/editor/code-langs.ts`).
- **Tabs** with debounced autosave (`src/lib/stores/tabs.svelte.ts`); Cmd+1..9 jump.
- **Workspace sidebar** — open folder, file tree (`src/lib/stores/workspace.svelte.ts`, `crates/markdusk-core/src/workspace.rs`).
- **Outline panel** — headings with click-to-jump (`crates/markdusk-core/src/outline.rs`).
- **Image paste/drop** — saves next to doc, inserts relative `![](filename)` (`src/lib/editor/image-paste.ts`).
- **Find** via CodeMirror search panel; Find&Replace menu binding points at the same panel (`src/lib/editor/editor.ts`).
- **Vim mode** toggle via `@replit/codemirror-vim`.
- **Focus Mode** — typewriter scroll + hides chrome (`editor.ts` typewriter plugin, `App.svelte`).
- **Themes** — Smoke and Amber; appearance System/Light/Dark (`src/lib/theme/theme.ts`, `menu.rs`).
- **Export HTML** with embedded theme CSS, **Export PDF** via WebView print, **Copy as Rich Text** to clipboard as `text/html` + `text/plain` (`crates/markdusk-core/src/export.rs`, `App.svelte`).
- **Finder integration** — file associations for `md`/`markdown`/`mdown`/`mdwn`/`mkd`; cold-launch path drain + warm `RunEvent::Opened` (`lib.rs`).
- **Quick Look extension** scaffold (`qlextension/`, `docs/quicklook.md`).
- **Tauri updater** wired (`tauri.conf.json` plugins.updater).
- **Spell check** compartment exists but is not wired to a menu toggle (`editor.ts:setSpellCheck`).

What is explicitly out of scope per principles: plugins, cloud sync, login.

## 2. Per-rival comparison

Priority key: **P0** = must have for default editor, **P1** = strong-want, **P2** = nice, **skip** = explicitly not pursuing.

### 2.1 CotEditor (free, native, the bar to clear)

Source: [coteditor.com](https://coteditor.com/), [features in release notes](https://coteditor.com/releasenotes/4.8.0.en).

| Feature | Markdusk | Priority |
|---|---|---|
| Native macOS feel, Liquid Glass, VoiceOver, Versions, iCloud integration | partial (no Versions, no VoiceOver pass) | P1 |
| Find/Replace with ICU regex | basic CM6 search only | **P0** |
| Multi-cursor editing | no | P1 |
| Split editor (multiple panes on one doc) | no | P2 |
| Automatic backup while editing | debounced autosave only | P1 |
| Line numbers, invisibles, soft-wrap toggle | no | P1 |
| 60+ language syntax highlighting | 7 languages | P2 |
| Incremental search | search panel only | P2 |
| Open very large files quickly | not measured | P1 |

### 2.2 Bear (paid, lovely UX)

Source: [bear.app](https://bear.app/), [Bear markdown guide](https://www.markdownguide.org/tools/bear/), [FAQ](https://bear.app/faq/how-to-use-markdown-in-bear/).

| Feature | Markdusk | Priority |
|---|---|---|
| Hybrid live editor (hide syntax in place) | yes | done |
| Hashtags + nested tags for organization | no | P2 |
| Wikilinks + backlinks | no | P1 |
| Export PDF/HTML/DOCX/JPG | HTML, PDF (print), rich-copy | P1 (add DOCX) |
| Focus Mode | yes | done |
| iCloud sync across devices | no — principle: no cloud lock-in | skip |
| OCR on images | no | skip |
| Themes | 2 themes | P2 (3-4 more) |

### 2.3 iA Writer (paid, focus-mode benchmark)

Source: [ia.net/writer](https://ia.net/writer), [Focus Mode](https://ia.net/writer/support/editor/focus-mode?tab=mac), [Content Blocks](https://ia.net/writer/support/library/content-blocks), [Wikilinks](https://ia.net/writer/support/library/wikilinks), [features](https://ia.net/writer/support/basics/features).

| Feature | Markdusk | Priority |
|---|---|---|
| Focus Mode (sentence + paragraph highlight, dim rest) | typewriter only, no dim | **P0** |
| Style Check (cliches, redundancies, filler) | no | P1 |
| Syntax Highlight by part-of-speech | no | P2 |
| Authorship tracking (flag AI-pasted text) | no | P2 |
| Content Blocks (embed file with `/`) | no | P1 |
| Library (folder browser with favourites + tags) | folder browser only | P1 |
| Wikilinks `[[file]]` | no | P1 |
| Preview with templates | export only | P2 |
| Night Mode / Duo themes | Smoke/Amber + appearance | done |

### 2.4 Typora (paid, WYSIWYG benchmark)

Source: [typora.io](https://typora.io/), [markdown reference](https://support.typora.io/Markdown-Reference/).

| Feature | Markdusk | Priority |
|---|---|---|
| Pure WYSIWYG — markers vanish entirely | inactive-line hide only | P1 (already a deliberate trade-off) |
| Outline panel with click-jump | yes | done |
| Math (MathJax + mhchem, AMSmath, autonumber) | KaTeX inline+block | P1 (autonumber) |
| Mermaid + flowchart + sequence + gantt | Mermaid yes | done |
| ~100 code-block languages | 7 | P1 (expand to ~30) |
| Export DOCX, LaTeX, EPUB, OpenOffice, MediaWiki | HTML+PDF | P1 (DOCX, LaTeX) |
| Image management (copy to folder, resize) | paste/drop saves alongside | P1 (resize, move) |
| Auto-pair brackets, smart list continuation | no | **P0** |
| Custom CSS themes from community | 2 fixed themes | P2 |
| Word count, reading time, char count | word count only | P2 |

### 2.5 Obsidian (free for personal, heavyweight)

Source: [obsidian.md](https://obsidian.md/), [report card](https://practicalpkm.com/2026-obsidian-report-card/), [pricing](https://aiproductivity.ai/blog/obsidian-pricing/).

| Feature | Markdusk | Priority |
|---|---|---|
| Local-first plain-md vault | yes | done |
| Wikilinks + backlinks + graph view | no | P1 (links), skip (graph) |
| Plugin ecosystem | none — owner's principle | skip |
| Canvas / whiteboard | no | skip |
| Daily notes / templates | no | P2 |
| Tags, tag pane | no | P2 |
| Quick switcher (Cmd+O fuzzy file open) | folder click only | **P0** |
| Command palette (Cmd+Shift+P) | no | **P0** |
| Sync (paid) | no | skip |
| Markdown highlight `==text==` | no | P2 |
| Visual table editor | no | P1 |

### 2.6 MacDown (free, simple)

Source: [macdown.uranusjr.com](https://macdown.uranusjr.com/), [features](https://macdown.uranusjr.com/features/).

| Feature | Markdusk | Priority |
|---|---|---|
| Two-pane source + live preview | single hybrid pane | done (different choice) |
| Custom render themes (CSS) | 2 themes | P2 |
| Jekyll front-matter awareness | YAML metadata parsed in core, not surfaced | P2 |
| TeX math | yes | done |
| Fenced code, GFM tasks, tables | yes | done |
| Smart punctuation | no | P1 |

## 3. Critical gaps (P0 — block default-editor adoption)

The features Markdusk must have before its owner can credibly use it daily and ship it broadly:

1. **Command palette** (Cmd+Shift+P). Discoverability for everything. Citizen devs expect it from VS Code.
2. **Quick switcher / fuzzy file open** (Cmd+O within open workspace). Faster than clicking the file tree.
3. **Find & Replace that actually replaces.** Today the menu item just opens the find panel. Wire CM6's replace UI with regex toggle.
4. **iA-style Focus Mode dim.** Typewriter scroll without the sentence/paragraph dim is a half-feature. Match [iA's two-mode dim](https://ia.net/writer/support/editor/focus-mode?tab=mac).
5. **Smart list continuation + bracket auto-pair.** Pressing Enter inside `- ` continues the list; typing `[` inserts `[]`. Standard everywhere, missing here.
6. **DOCX export.** Citizen devs and writers send `.docx`. HTML+PDF alone fails the "send to non-technical collaborator" test. Pandoc sidecar or `docx-rs`.
7. **Word/char/reading-time count surfaced.** Status bar word count exists; add char count and reading time on hover/click. Writers expect this.
8. **Spell-check menu toggle.** The compartment exists in code but no menu item. One line to expose.
9. **Recent files menu** (`File → Open Recent`). Mac convention; absent today.
10. **Auto-restore tabs on launch.** Today every launch starts with one empty tab — work-in-progress vanishes from view.
11. **Cmd+O at empty state opens a file, not just a folder.** Today the open-file flow is fine via menu; verify Finder drag-to-dock also works on cold launch.
12. **Cold-open speed under 200ms verified and tracked.** Principle says <200ms; no benchmark in repo. Add a `bench` test and CI gate before claiming it.

## 4. Differentiators (lean in)

What Markdusk already does that rivals don't, or could uniquely own:

- **Free, no login, no cloud, no plugins** — Obsidian charges for sync, Bear/iA/Typora are paid, MacDown is dormant, CotEditor isn't markdown-first. Markdusk is the only fast, free, native, *opinionated* markdown editor.
- **Rust core + Tauri shell** — small binary, fast cold start, no Electron. Lead with measured open-speed numbers once gap #12 is closed.
- **Smoke/Amber paired themes** — most rivals ship grey-on-white. Markdusk's palette is recognizable. Add 2 more (e.g. high-contrast and a "night" variant) and keep the count small.
- **Inline KaTeX + Mermaid live in the editor** — Typora has it but is paid and closed; iA Writer renders only in preview. We render inline in the editing buffer.
- **Tauri updater + signed/notarized + Quick Look** — a polished install/update story most free editors lack. MacDown is the cautionary tale; Markdusk's release runway (`docs/runway.md`) is real.

## 5. Skip list (explicit non-goals)

Features rivals have that Markdusk will not pursue, with reasoning:

- **Plugin system** — owner's explicit principle. Avoids Obsidian's plugin-ecosystem tax and security surface.
- **Cloud sync, login, accounts** — principle: no lock-in. Users can use iCloud Drive/Dropbox on the workspace folder.
- **Graph view / canvas / whiteboard** — Obsidian-style PKM features. Out of scope for "default markdown editor."
- **OCR on images** — Bear Pro feature. Off-mission.
- **AI-authorship tracking** — iA's new feature. Politically interesting but not core to writing; revisit only if it becomes a default user expectation.
- **Vim power-user keymaps beyond `vim()` toggle** — Vim mode stays as a one-switch convenience. No EVIL-style ecosystem.
- **60+ language code highlighting** — citizen devs need ~15 popular langs, not the long tail. Expand selectively, don't chase CotEditor's count.
- **Custom CSS theming from a marketplace** — invites plugin-like surface. We curate 4-6 themes and keep them tight.
- **Split editor on the same document** — CotEditor has it; rare in practice for prose writers. Re-evaluate if requested.
- **Mobile / Windows / Linux ports** — Mac-native is the principle. Tauri makes ports possible but each platform is a maintenance tax.

---

## Appendix — Sources

- CotEditor: [coteditor.com](https://coteditor.com/), [4.8.0 notes](http://coteditor.com/releasenotes/4.8.0.en).
- Bear: [bear.app](https://bear.app/), [markdown guide](https://www.markdownguide.org/tools/bear/), [FAQ](https://bear.app/faq/how-to-use-markdown-in-bear/).
- iA Writer: [ia.net/writer](https://ia.net/writer), [Focus Mode](https://ia.net/writer/support/editor/focus-mode?tab=mac), [features](https://ia.net/writer/support/basics/features), [Content Blocks](https://ia.net/writer/support/library/content-blocks), [Wikilinks](https://ia.net/writer/support/library/wikilinks).
- Typora: [typora.io](https://typora.io/), [reference](https://support.typora.io/Markdown-Reference/).
- Obsidian: [obsidian.md](https://obsidian.md/), [pricing](https://aiproductivity.ai/blog/obsidian-pricing/), [report card](https://practicalpkm.com/2026-obsidian-report-card/).
- MacDown: [macdown.uranusjr.com](https://macdown.uranusjr.com/), [features](https://macdown.uranusjr.com/features/).
