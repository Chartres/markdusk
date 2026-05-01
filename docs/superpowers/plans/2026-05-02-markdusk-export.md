# Markdusk Export Implementation Plan (Plan 5 of 6, slimmed for overnight run)

> Skips the Swift Quick Look bundle from the original spec — that wants user supervision (signing, code review, separate Xcode target). Covers the export trio: HTML, PDF, copy-as-rich-text.

**Goal:** Three export paths exposed from File → Export.

---

## Task 1 — `markdusk-core::export::html`

**Files:**
- Modify: `crates/markdusk-core/src/lib.rs` (add `pub mod export`)
- Create: `crates/markdusk-core/src/export.rs`

```rust
// crates/markdusk-core/src/export.rs

/// Render markdown source to standalone HTML with the given theme palette inlined.
pub fn render_html(source: &str, theme: HtmlTheme) -> String {
    use pulldown_cmark::{html, Options, Parser};

    let mut html_out = String::new();
    let parser = Parser::new_ext(
        source,
        Options::ENABLE_TABLES
            | Options::ENABLE_TASKLISTS
            | Options::ENABLE_STRIKETHROUGH
            | Options::ENABLE_FOOTNOTES
            | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS,
    );
    html::push_html(&mut html_out, parser);

    let css = theme.embedded_css();
    format!(
        "<!doctype html>\n<html><head><meta charset=\"utf-8\"><style>{css}</style></head><body class=\"markdusk\">{html_out}</body></html>",
    )
}

/// A single self-contained CSS block per theme. Keep this in sync with smoke.css/amber.css
/// at the level needed for offline rendering — body, headings, code, tables, blockquote, links.
pub enum HtmlTheme { Smoke, Amber }

impl HtmlTheme {
    fn embedded_css(&self) -> &'static str {
        match self {
            HtmlTheme::Smoke => SMOKE_CSS,
            HtmlTheme::Amber => AMBER_CSS,
        }
    }
}

const SMOKE_CSS: &str = r#"
body.markdusk {
  font-family: ui-serif, Charter, "Iowan Old Style", Georgia, serif;
  background: #eee9de; color: #2a2c2c;
  max-width: 720px; margin: 32px auto; padding: 0 24px;
  line-height: 1.65; font-size: 16px;
}
.markdusk h1, .markdusk h2, .markdusk h3, .markdusk h4, .markdusk h5, .markdusk h6 { color: #3d6a5e; font-weight: 700; }
.markdusk h1 { font-size: 1.7em; }
.markdusk h2 { font-size: 1.4em; }
.markdusk h3 { font-size: 1.2em; }
.markdusk a { color: #3d6a5e; }
.markdusk blockquote { border-left: 3px solid #5d8a7e; color: #5d8a7e; padding-left: 12px; font-style: italic; }
.markdusk code { font-family: "JetBrains Mono", ui-monospace, monospace; background: #1d2222; color: #dfd8c6; padding: 1px 4px; border-radius: 3px; }
.markdusk pre { background: #1d2222; color: #dfd8c6; padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdusk pre code { background: transparent; padding: 0; }
.markdusk table { border-collapse: collapse; }
.markdusk th, .markdusk td { border: 1px solid #d2cbb8; padding: 6px 10px; }
.markdusk th { background: rgba(61,106,94,0.06); }
@media (prefers-color-scheme: dark) {
  body.markdusk { background: #1d2222; color: #dcd6c4; }
  .markdusk h1, .markdusk h2, .markdusk h3, .markdusk h4, .markdusk h5, .markdusk h6 { color: #88b3a4; }
  .markdusk a { color: #88b3a4; }
  .markdusk th, .markdusk td { border-color: #262b2b; }
}
"#;

const AMBER_CSS: &str = r#"
body.markdusk {
  font-family: ui-serif, Charter, "Iowan Old Style", Georgia, serif;
  background: #f4ecdb; color: #28323e;
  max-width: 720px; margin: 32px auto; padding: 0 24px;
  line-height: 1.65; font-size: 16px;
}
.markdusk h1, .markdusk h2, .markdusk h3, .markdusk h4, .markdusk h5, .markdusk h6 { color: #b85c2a; font-weight: 700; }
.markdusk a { color: #b85c2a; }
.markdusk blockquote { border-left: 3px solid #b85c2a; color: #5a4a32; padding-left: 12px; font-style: italic; }
.markdusk code { font-family: "JetBrains Mono", ui-monospace, monospace; background: #28323e; color: #e7dec5; padding: 1px 4px; border-radius: 3px; }
.markdusk pre { background: #28323e; color: #e7dec5; padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdusk pre code { background: transparent; padding: 0; }
.markdusk table { border-collapse: collapse; }
.markdusk th, .markdusk td { border: 1px solid #dbd1b3; padding: 6px 10px; }
.markdusk th { background: rgba(184,92,42,0.06); }
@media (prefers-color-scheme: dark) {
  body.markdusk { background: #1a2230; color: #e0d8c0; }
  .markdusk h1, .markdusk h2, .markdusk h3, .markdusk h4, .markdusk h5, .markdusk h6 { color: #e08a4a; }
  .markdusk a { color: #e08a4a; }
  .markdusk th, .markdusk td { border-color: #22293a; }
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_basic_markdown_to_html() {
        let html = render_html("# Hello\n\n**bold** *italic*", HtmlTheme::Smoke);
        assert!(html.starts_with("<!doctype html>"));
        assert!(html.contains("<h1>Hello</h1>"));
        assert!(html.contains("<strong>bold</strong>"));
        assert!(html.contains("<em>italic</em>"));
        assert!(html.contains("body.markdusk"));
    }

    #[test]
    fn switches_palette_with_theme() {
        let smoke = render_html("# t", HtmlTheme::Smoke);
        let amber = render_html("# t", HtmlTheme::Amber);
        assert!(smoke.contains("#3d6a5e"));
        assert!(amber.contains("#b85c2a"));
        assert!(!smoke.contains("#b85c2a"));
        assert!(!amber.contains("#3d6a5e"));
    }

    #[test]
    fn renders_tables_and_code() {
        let html = render_html(
            "| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncode\n```",
            HtmlTheme::Smoke,
        );
        assert!(html.contains("<table>"));
        assert!(html.contains("<th>a</th>"));
        assert!(html.contains("<pre><code>code\n</code></pre>") || html.contains("<pre><code>"));
    }
}
```

`cargo test -p markdusk-core export::tests` → 3 passed. Commit `feat(core): export — markdown to standalone themed HTML`.

---

## Task 2 — Tauri commands `export_html` and `copy_as_rich_text`

**Files:**
- Modify: `crates/markdusk-app/src/commands.rs`
- Modify: `crates/markdusk-app/src/lib.rs`

```rust
use markdusk_core::export::{render_html, HtmlTheme};

#[tauri::command]
pub async fn export_html(target_path: String, source: String, theme: String) -> Result<(), String> {
    let theme = match theme.as_str() {
        "amber" => HtmlTheme::Amber,
        _ => HtmlTheme::Smoke,
    };
    let html = render_html(&source, theme);
    tokio::fs::write(target_path, html.as_bytes()).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn render_html_for_clipboard(source: String, theme: String) -> String {
    let theme = match theme.as_str() {
        "amber" => HtmlTheme::Amber,
        _ => HtmlTheme::Smoke,
    };
    render_html(&source, theme)
}
```

Register both in the `invoke_handler`. Add a Rust test that round-trips a save and reads back:

```rust
#[tokio::test]
async fn export_html_writes_file() {
    let tmp = TempDir::new().unwrap();
    let p = tmp.path().join("out.html");
    export_html(p.to_string_lossy().into_owned(), "# x".into(), "smoke".into())
        .await
        .unwrap();
    let read = tokio::fs::read_to_string(&p).await.unwrap();
    assert!(read.contains("<h1>x</h1>"));
}
```

Commit: `feat(app): export_html and render_html_for_clipboard commands`

---

## Task 3 — Frontend: File → Export submenu + handlers

**Files:**
- Modify: `crates/markdusk-app/src/menu.rs`
- Modify: `src/routes/App.svelte`
- Modify: `src/lib/ipc/commands.ts`

### Step 1: Menu

Add a File → Export submenu with three items:
- `export:html` — Export as HTML…
- `export:pdf` — Export as PDF…
- `export:copy-rich` — Copy as Rich Text (`CmdOrCtrl+Shift+C`)

Inserted between Save and the close-window separator in the existing File submenu.

### Step 2: TS wrappers

```ts
export async function exportHtml(targetPath: string, source: string, theme: "smoke" | "amber"): Promise<void> {
  await invoke<void>("export_html", { targetPath, source, theme });
}

export async function renderHtmlForClipboard(source: string, theme: "smoke" | "amber"): Promise<string> {
  return await invoke<string>("render_html_for_clipboard", { source, theme });
}
```

### Step 3: App.svelte handlers

Track current theme in a `currentTheme = $state<"smoke" | "amber">("smoke")` and update it when theme menu actions fire (or just read it from `document.documentElement.dataset.theme`).

```ts
case "export:html": {
  const { save } = await import("@tauri-apps/plugin-dialog");
  const target = await save({ defaultPath: "export.html", filters: [{ name: "HTML", extensions: ["html"] }] });
  if (typeof target === "string") {
    await exportHtml(target, tabs.active.contents, currentTheme);
  }
  break;
}

case "export:pdf": {
  // Use the WebView's print dialog. Tauri 2 has a window.print API or we open
  // a hidden window with the HTML and call its print(). Simplest: build the HTML
  // and write it to a temp file, then use macOS's `open -a Preview` or similar.
  // Actual implementation: use the in-app print() since the WebView already
  // hosts the rendered preview. Pop a fresh window with the rendered HTML and
  // trigger window.print() on it.
  const html = await renderHtmlForClipboard(tabs.active.contents, currentTheme);
  const w = window.open("", "_blank");
  if (w) {
    w.document.write(html);
    w.document.close();
    w.print();
  }
  break;
}

case "export:copy-rich": {
  const html = await renderHtmlForClipboard(tabs.active.contents, currentTheme);
  // Copy HTML to clipboard using the Clipboard API. Set both text/html and text/plain
  // so paste targets that don't accept HTML still get the markdown source.
  const blob = new Blob([html], { type: "text/html" });
  const plain = new Blob([tabs.active.contents], { type: "text/plain" });
  await navigator.clipboard.write([new ClipboardItem({ "text/html": blob, "text/plain": plain })]);
  break;
}
```

Note: `window.open` may be blocked by the Tauri WebView config. If so, fall back to: write the HTML to a temp file, open it in the default browser via `tauri-plugin-shell`, and instruct the user to print from there. For overnight purposes, attempt window.open first and if it errors at runtime, log a graceful message and fall back to writing the HTML to a temp file via export_html using a tempdir path.

Also: `theme:smoke` / `theme:amber` menu cases should now ALSO update `currentTheme` so export uses the right one:

```ts
case "theme:smoke":
  applyTheme("smoke");
  currentTheme = "smoke";
  break;
case "theme:amber":
  applyTheme("amber");
  currentTheme = "amber";
  break;
```

Commit: `feat: File → Export (HTML / PDF / Copy as Rich Text)`

---

## Verification (after each task)

- `cargo test --workspace` — 33 → 36 → 37 (after each export task)
- `pnpm test` — still 22
- fmt + clippy + svelte-check + build all clean

## Closing checklist

- [ ] Three export menu items work
- [ ] HTML export produces a styled, standalone file
- [ ] PDF export opens print dialog with rendered preview
- [ ] Rich-text copy puts HTML on clipboard

When done, append a Completion summary. Plans 5 (Quick Look bundle) and 6 (full personas + perf) deferred to user supervision.
