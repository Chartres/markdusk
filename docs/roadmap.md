# Markdusk Roadmap — from where we are to "default editor on every Mac"

This doc is the bridge from research → ship. It pulls the P0 list from
[gap-analysis.md](./gap-analysis.md), maps each item to the persona/JTBD it
serves (from [personas.md](./personas.md)), and orders the work into
milestones that minimize wasted churn.

Last updated: 2026-06-07.

## North-star and quality bar

- Open in <1s from Finder double-click. Type within 5s of cold launch.
- Every shipped feature is verified by a persona test that exercises the
  actual editor surface, not just the underlying API. See `tests/persona/`.
- No new dependency unless it pulls weight worth the install-size delta.
- Owner can use Markdusk as his default editor at the end of each milestone.

## Sequencing principles

1. **Discoverability before features.** Command palette + quick switcher
   unlock everything that follows — every later feature becomes searchable
   instead of menu-dive-only.
2. **Repair half-features before adding new ones.** Find&Replace already
   pretends to exist; finish it before adding DOCX export.
3. **One persona at a time.** Sam first (he's the most fragile; bad first
   impressions lose him), then Maya (deepest engagement), then Diego/Priya.
4. **Bench, then claim.** Don't put "<200ms cold start" in marketing until
   it's a CI-gated benchmark.

---

## Milestone M1 — "Default editor for Sam" (Switcher Adoption)

**Goal:** A Sam-class switcher launches Markdusk, opens a file, and within
five minutes thinks "this is finished." No setup wizard, no broken menus,
no confusing chrome.

| # | Feature | Persona / JTBD | Effort | Status |
|---|---|---|---|---|
| 1.1 | **Command palette** (Cmd+Shift+P) — fuzzy search every menu item | Sam JTBD #3 ("feel 'finished' in 5 min"); also Priya #2 | M | todo |
| 1.2 | **Quick switcher** (Cmd+O within workspace) — fuzzy open by filename | Sam #1, Diego #2 | S | todo |
| 1.3 | **Find & Replace UI that actually replaces** — wire CM6 replace + regex toggle | Diego #1 (typo hunting), Maya secondarily | S | todo |
| 1.4 | **Smart list continuation + bracket auto-pair** — Enter inside `- ` continues; `[` inserts `[]` | Maya #2, Diego — universal table stakes | S | todo |
| 1.5 | **Spell-check menu toggle** — expose the compartment already in `editor.ts:setSpellCheck` | Maya #1 | XS | todo |
| 1.6 | **Recent files menu** (File → Open Recent, last 10) | Sam #1, Priya #1 | S | todo |
| 1.7 | **Auto-restore tabs on launch** — remember last session's open tabs | Sam #1, Diego — work-in-progress shouldn't vanish | M | todo |
| 1.8 | **Cold-open benchmark + CI gate** — measure, then claim. Add `crates/markdusk-bench` case if missing | Cross-persona principle #1 | M | todo |

**M1 acceptance test (manual + automated):**
- New macOS user installs the .dmg, double-clicks a .md from Finder → editor renders contents in <1.5s (today) and <1s (target).
- Cmd+Shift+P → types "theme amber" → palette finds it → enter switches.
- Cmd+O → types partial filename → switches tabs without touching trackpad.
- Open + edit + quit + relaunch → same tabs return.
- `pnpm test:persona` includes a new "Sam-uses-command-palette" scenario that fails today.

---

## Milestone M2 — "Writer-grade Maya" (Focus + Export depth)

**Goal:** Maya can draft a 3000-word essay, send the PDF to her editor, and
not miss iA Writer.

| # | Feature | Persona / JTBD | Effort | Status |
|---|---|---|---|---|
| 2.1 | **iA-style Focus dim** — Sentence and Paragraph modes (the line/paragraph at the caret stays full opacity, everything else dims to ~40%) | Maya #1, Maya #2 | M | todo |
| 2.2 | **DOCX export** via Pandoc sidecar or `docx-rs` — opens in Pages and Word | Maya #3, Priya #3 | L | todo |
| 2.3 | **Word + char + reading-time** in status bar (click to expand) | Maya — universal writer expectation | XS | todo |
| 2.4 | **Smart-punctuation toggle, off by default** — curly quotes, em-dashes; explicit on/off so we don't silently rewrite files | Maya wants it, Diego/Priya principle #4 forbids defaults | S | todo |
| 2.5 | **Outline-driven jump from keyboard** — Cmd+\\ already toggles outline; add Cmd+Shift+G for fuzzy heading nav | Maya #1, Diego #2 | S | todo |

**M2 acceptance test:**
- Maya opens a 3000-word essay → Focus Mode (Sentence) shows only the current sentence at full opacity → Cmd+E exports DOCX → opens cleanly in Pages with serif body + bold/italic preserved → status bar shows word count + reading time.

---

## Milestone M3 — "Built for Diego" (Engineer ergonomics)

**Goal:** Diego runs Markdusk on a folder of 80 markdown files (README, ADRs,
runbooks) and doesn't feel friction.

| # | Feature | Persona / JTBD | Effort | Status |
|---|---|---|---|---|
| 3.1 | **Expand code-fence highlighting to ~25 languages** — current 7 → add Go, Bash, Kotlin, Swift, Ruby, YAML, TOML, Markdown, SQL, Java, PHP, Lua, Dockerfile, Nix, Zig, Elixir, Dart, Scala | Diego #1 | M | todo |
| 3.2 | **Line numbers + soft-wrap toggle in View menu** — CotEditor parity | Diego (CotEditor expectation) | XS | todo |
| 3.3 | **Multi-cursor editing** — already in CM6, just expose Alt-click | Diego, citizen devs from VS Code | XS | todo |
| 3.4 | **Sticky-scroll heading** — current section's heading pinned at top of scroller | Diego — long READMEs | M | todo |
| 3.5 | **Large-file mode** — open >1MB md without virtualizer panic; bench it | Diego — long-form docs | M | todo |
| 3.6 | **Visual table editor** (insert-row / insert-col / align via keyboard or floating toolbar) | Diego (markdown tables), Priya (data tables) | L | todo |

**M3 acceptance test:**
- `git clone <a-real-repo-with-many-md>` → `Markdusk <folder>` → fuzzy-open jumps between any of 80 files in <100ms → multi-cursor refactors a section → table edit doesn't reflow pipes.

---

## Milestone M4 — "Quick Look + Finder polish" (Priya unlock)

**Goal:** Priya double-clicks a .md from anywhere — Slack download, GitHub
clone, AI export — and Markdusk Just Works. Quick Look preview also Just
Works. Finder integration feels first-class.

| # | Feature | Persona / JTBD | Effort | Status |
|---|---|---|---|---|
| 4.1 | **Quick Look extension wired in Xcode** (release runway step) — rendered preview in Finder spacebar | Priya #1 — "I don't want to open the app to peek" | L (Xcode + Apple Dev) | partial (qlextension scaffold exists) |
| 4.2 | **Drag-onto-dock to open** — verify, fix if broken | Priya — multi-entry-point reality | XS | todo |
| 4.3 | **Wikilinks `[[file]]` resolution within workspace** — click jumps, autocompletion on `[[` | Diego, Priya — local linking without Obsidian | M | todo |
| 4.4 | **Front-matter awareness** — YAML at top is shown as a collapsed pill, never silently mangled | Diego principle #4, Priya pain | M | todo |
| 4.5 | **Frontmatter-safe save guarantee + test** — round-trip test asserts byte-for-byte preservation when the user makes zero edits | Diego, Priya principle #4 | S | todo |

**M4 acceptance test:**
- Finder spacebar on a .md shows rendered preview (not raw source).
- Open a Jekyll post (with `---` frontmatter), edit one body word, save, diff → only the body word changed.
- Open a vault-style folder of cross-linked notes → `[[note]]` autocompletes and clicks navigate.

---

## Milestone M5 — "Polish, share, ship" (Public release)

**Goal:** Markdusk leaves the owner's mini and lands on other Macs without
hand-holding. The portfolio piece is genuinely portfolio-grade.

| # | Item | Why | Effort |
|---|---|---|---|
| 5.1 | Apple Developer Program signup + signing identity in CI | Without it, every download hits Gatekeeper warnings | external |
| 5.2 | Notarized DMG via GitHub Actions on tag push | Already drafted; finish + dogfood | M |
| 5.3 | Update manifest hosted (GitHub Pages or Cloudflare R2) | Wired in `tauri.conf.json`; needs URL | S |
| 5.4 | Landing page at markdusk.app (or similar) — one screenshot, install button, "why we built it" | Show-off portfolio requirement | M |
| 5.5 | Write the "release post" — link gap-analysis + personas, lead with the principles | The honesty is the marketing | S |
| 5.6 | First public 0.1.0 release | The whole point | — |

---

## Skip list (explicit) — kept here so we don't drift

From [gap-analysis.md](./gap-analysis.md) §5; restated for the roadmap so
PRs that re-introduce these can be closed quickly:

- Plugin system / marketplace.
- Cloud sync, login, accounts.
- Graph view, canvas, daily-notes ritual, PKM features.
- OCR on images.
- AI authorship tracking; AI-first features generally.
- Real-time collaboration / presence.
- LSP, code completion, debugger, test runner (it's not an IDE).
- 60+ language highlighting (we stop at ~25).
- Custom CSS theme marketplace.
- Split-editor on the same document.
- Windows/Linux ports before Mac is loved.

## How this doc evolves

When a milestone item lands, change its **Status** to `done` and add the
commit SHA. When research shifts (a forum thread reveals a new pain), update
[personas.md](./personas.md) and re-derive the affected item here.

If we keep ourselves honest, the roadmap shortens every week. If items keep
appearing, the principles aren't biting.
