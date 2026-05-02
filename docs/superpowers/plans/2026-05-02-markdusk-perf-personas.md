# Markdusk Perf + Persona Suite Plan (Plan 6 of 7)

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Validate v1 readiness with measurable perf budgets and four persona acceptance scripts.

**What "validation" can and cannot do here:**
- The Rust core (parse, render_html, outline, Document I/O) is fully testable — `criterion` benchmarks land in CI as compile-time gates, with budget assertions.
- UI-driven persona flows (clicking, typing, observing pixels) cannot be fully automated on macOS today because `tauri-driver` doesn't support WKWebView. We do what we can:
  - **Smoke harness** extended to cover four personas with `open -a` + process inspection + log assertions.
  - **Persona scripts as runnable mocha specs** — documented procedures the user runs, plus where the procedure can be checked against state on disk (file written, settings file changed).
- Frontend perf assertions go via `vitest` micro-benchmarks (CodeMirror dispatch, tab-store updates) running in jsdom. They aren't 1:1 with WKWebView reality but catch algorithmic regressions.

---

## Task 1 — Criterion benchmarks (`markdusk-bench`)

**Files:**
- Create: `crates/markdusk-bench/Cargo.toml`
- Create: `crates/markdusk-bench/benches/parser.rs`
- Create: `crates/markdusk-bench/benches/render.rs`
- Create: `crates/markdusk-bench/benches/outline.rs`
- Create: `crates/markdusk-bench/benches/document.rs`
- Modify: root `Cargo.toml` (add `crates/markdusk-bench` to members)

**Steps:**

- [ ] **Step 1: Crate skeleton**

`crates/markdusk-bench/Cargo.toml`:
```toml
[package]
name = "markdusk-bench"
version.workspace = true
edition.workspace = true
license.workspace = true
publish = false

[dependencies]
markdusk-core = { path = "../markdusk-core" }

[dev-dependencies]
criterion = { version = "0.5", features = ["html_reports"] }
tokio = { workspace = true, features = ["macros", "rt-multi-thread", "fs"] }
tempfile = "3"

[[bench]]
name = "parser"
harness = false

[[bench]]
name = "render"
harness = false

[[bench]]
name = "outline"
harness = false

[[bench]]
name = "document"
harness = false
```

Add `"crates/markdusk-bench"` to root `Cargo.toml` members.

- [ ] **Step 2: Generate corpus**

Each benchmark uses an in-memory string. Use a simple repeating template to hit ~1 MB:

```rust
fn corpus_kb(kb: usize) -> String {
    let chunk = "# Heading\n\nSome **bold** and *italic* text. `code` and a [link](https://example.com).\n\n```rust\nfn main() { println!(\"hi\"); }\n```\n\n| col | val |\n|---|---|\n| a | 1 |\n| b | 2 |\n\n> A quote\n\n";
    let bytes_target = kb * 1024;
    let mut s = String::with_capacity(bytes_target + chunk.len());
    while s.len() < bytes_target { s.push_str(chunk); }
    s
}
```

- [ ] **Step 3: Parser benchmark**

`crates/markdusk-bench/benches/parser.rs`:
```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};
use markdusk_core::parser;

fn corpus_kb(kb: usize) -> String {
    let chunk = "# Heading\n\nSome **bold** and *italic* text. `code` and a [link](https://example.com).\n\n```rust\nfn main() { println!(\"hi\"); }\n```\n\n| col | val |\n|---|---|\n| a | 1 |\n| b | 2 |\n\n> A quote\n\n";
    let bytes_target = kb * 1024;
    let mut s = String::with_capacity(bytes_target + chunk.len());
    while s.len() < bytes_target { s.push_str(chunk); }
    s
}

fn bench_parse(c: &mut Criterion) {
    let mut group = c.benchmark_group("parse");
    for &kb in &[10usize, 100, 1024] {
        let src = corpus_kb(kb);
        group.bench_function(format!("{}_kb", kb), |b| {
            b.iter(|| parser::parse(black_box(&src)));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_parse);
criterion_main!(benches);
```

- [ ] **Step 4: Render, outline, document benches** — same shape, calling `export::render_html`, `outline::outline`, and `document::Document::open` respectively. Document::open uses tempfile to materialize the corpus as a real file.

- [ ] **Step 5: CI smoke**

Add a `bench` job to `.github/workflows/ci.yml` that runs `cargo bench --workspace --bench parser -- --quick` and similar — `--quick` runs a fast subset suitable for CI signal. Don't gate merges on perf yet; just make sure the harness compiles and runs.

- [ ] **Step 6: Document expected ranges in `docs/perf-budgets.md`** with current measured values for the corpus sizes, captured from a release build on Apple Silicon.

- [ ] **Step 7: Commit `feat(bench): criterion benchmarks for parse/render/outline/document`.**

---

## Task 2 — Frontend microbenchmarks

**Files:**
- Create: `src/lib/editor/perf.test.ts`
- Create: `src/lib/stores/tabs.perf.test.ts`

**Steps:**

- [ ] **Editor keystroke perf** — drive a CodeMirror view with 100 KB seed and dispatch 200 single-character inserts. Assert p95 elapsed ≤ 6 ms (jsdom — softer than WebKit but catches O(n) regressions in the live preview / decorations).

- [ ] **Tab switch perf** — populate 9 tabs with 50 KB each, then `setActive` 100 times round-robin. Assert avg ≤ 1 ms (the store is in-memory, so this is mostly assertion-correctness).

- [ ] **Commit `test: frontend microbenchmarks (keystroke + tab switch)`.**

---

## Task 3 — Persona harness (extends `tests/persona/sam-first-launch.test.ts`)

**Files:**
- Modify: `tests/persona/sam-first-launch.test.ts`
- Create: `tests/persona/maya-writer.test.ts`
- Create: `tests/persona/diego-engineer.test.ts`
- Create: `tests/persona/priya-researcher.test.ts`
- Create: `tests/persona/fixtures/` (sample markdown files)

**What's automatable on macOS today:**
- Bundle launch + process count
- Settings file changes (theme switch)
- File saved (post-edit)
- Recents updated

**What's manual (procedures only):**
- UI rendering / layout
- Editor text content after typing
- Mermaid / KaTeX rendering visibility

**Steps:**

- [ ] **Sam — first launch (already done in Plan 1; keep)**

- [ ] **Maya the Writer**
  Automated:
  1. Spawn app with a fixture markdown file (`fixtures/maya-essay.md`)
  2. Wait 2s
  3. Use `defaults read app.markdusk` (settings) — verify theme not changed
  4. Quit cleanly

  Manual procedure documented in `docs/personas/maya.md`:
  - Open empty doc, type a paragraph, format bold/italic, paste an image from clipboard, export to PDF, switch theme to Amber, enter focus mode, save with ⌘S. Each step has an expected observable.

- [ ] **Diego the Engineer**
  Automated:
  1. Spawn app with `fixtures/diego-readme.md` (contains code blocks, tables, mermaid)
  2. Verify ≥1 process
  3. Quit, verify file unchanged on disk
  4. (Optionally: launch a second time, verify session restore — currently not implemented, so skip; note as future)

  Manual: vim mode, opens 5+ tabs via ⌘O, exports HTML.

- [ ] **Priya the Researcher**
  Automated:
  1. Create a tempdir of 50 small markdown files
  2. Spawn app
  3. (Cannot programmatically click Open Folder; document this gap)
  4. Quit

  Manual: open folder, use file tree, open 10 files in tabs, verify outline updates as each tab activates.

- [ ] **Commit `test(persona): Maya/Diego/Priya/Sam launch-and-quit smoke + manual procedure docs`.**

---

## Task 4 — Persona docs

**Files:**
- Create: `docs/personas/sam.md`, `docs/personas/maya.md`, `docs/personas/diego.md`, `docs/personas/priya.md`

Each file:
- Persona description (1 paragraph)
- Goal (what they're trying to do)
- Numbered procedure (12-15 steps)
- Each step has an "expected" line — what they should observe
- Closing checklist: friction notes, broken steps, suggestions

These are the artifacts for hand-running by the user (or by a Claude subagent driven via dictation/observation in the future).

- [ ] Commit `docs(personas): persona acceptance procedure docs (Sam/Maya/Diego/Priya)`.

---

## Closing checklist

- [ ] Criterion benchmarks compile and run (`cargo bench --workspace --bench parser -- --quick` ≤ 30 s)
- [ ] Frontend microbenchmarks pass with current budgets
- [ ] All 4 persona launch-smoke tests pass
- [ ] All 4 persona docs exist and are readable
- [ ] CI workflow runs the bench job

When done, append a Completion summary.
