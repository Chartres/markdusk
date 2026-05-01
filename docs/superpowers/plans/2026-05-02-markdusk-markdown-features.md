# Markdusk Markdown Features Implementation Plan (Plan 3 of 6)

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Make every markdown feature in the v1 spec render beautifully in the editor surface — GFM tables, syntax-highlighted fenced code, KaTeX math, Mermaid diagrams (rendered when cursor leaves the block), footnotes, YAML frontmatter, image paste from clipboard.

**Architecture:** All decoration/rendering done as CodeMirror extensions. Heavy assets (KaTeX, Mermaid) are dynamic-imported on first use to keep the cold-start budget. Image paste hits a new Rust IPC command that writes the image next to the active `.md` and returns the relative path.

**Tech Stack delta:**
- `katex` (frontend) — math rendering
- `mermaid` (frontend, dynamic import only) — diagram rendering
- `@codemirror/lang-html`, `@codemirror/lang-css`, `@codemirror/lang-javascript`, `@codemirror/lang-rust`, `@codemirror/lang-python` — code-block syntax highlighting via lang-markdown's `codeLanguages` option
- A new Rust command `save_pasted_image` that takes raw bytes + a hint extension and writes a unique file next to the doc

---

## File Structure (delta)

```
src/lib/editor/
├── code-langs.ts              (NEW — CodeMirror language registry for fenced blocks)
├── frontmatter-deco.ts        (NEW — dim YAML frontmatter)
├── katex-deco.ts              (NEW — replace $...$ and $$...$$ with rendered SVG when inactive)
├── mermaid-deco.ts            (NEW — replace fenced ```mermaid block with SVG when inactive)
├── image-paste.ts             (NEW — clipboard + drag-drop handler)
└── editor.ts                  (modified — wire the new extensions)

crates/markdusk-app/src/
└── commands.rs                (extended with save_pasted_image)

src/lib/ipc/commands.ts        (extended)

src/lib/theme/smoke.css        (modest additions: table, footnote, frontmatter styling)
```

---

## Task 1: Tables — enable + style

**Files:**
- Modify: `src/lib/editor/editor.ts` — `markdown()` already enables `Table` via the GFM extension. Verify and add visual styling via the EditorView.theme.

**Steps:**

- [ ] **Step 1:** Add the GFM extension explicitly. Replace the markdown call:

```ts
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { GFM } from "@lezer/markdown";

// ...

markdown({
  base: markdownLanguage,
  extensions: [GFM, { remove: ["SetextHeading"] }],
}),
```

`GFM` exports the table, task list, strikethrough, autolink, subscript, superscript extensions as a `MarkdownConfig[]`.

- [ ] **Step 2:** Add table styling to the EditorView.theme block in editor.ts:

```ts
".tok-tableHeader": { fontWeight: "700" },
"& .cm-line:has(.tok-tableDelimiter)": { color: "var(--md-muted)", opacity: 0.7 },
```

(Tag-based table styling is limited because lang-markdown doesn't tag table cells specifically — we lean on the visible pipes and dashes.)

Actually a better path: use the HighlightStyle to add a tag for `tags.tableDelimiter`. Add to `markduskHighlight`:

```ts
{ tag: t.tableDelimiter ?? t.processingInstruction, color: "var(--md-muted)" },
```

Note: `@lezer/highlight` may not export `tableDelimiter`. Use the lezer-markdown's `Type` exports for a node-name-based mark decoration if tag-based styling proves fragile.

- [ ] **Step 3:** Add a regression test in editor.test.ts:

```ts
it("parses GFM tables", () => {
  const view = createEditor(parent, "| a | b |\n|---|---|\n| 1 | 2 |");
  const found: string[] = [];
  syntaxTree(view.state).iterate({
    enter: (node) => found.push(node.name),
  });
  expect(found).toContain("Table");
});
```

- [ ] **Step 4:** Verify all tests pass, build succeeds. Commit `feat(editor): enable GFM (tables, task lists, strikethrough, autolinks)`.

---

## Task 2: Fenced code syntax highlighting

**Files:**
- Modify: `package.json` (new deps)
- Create: `src/lib/editor/code-langs.ts`
- Modify: `src/lib/editor/editor.ts`

**Steps:**

- [ ] **Step 1:** Install language packs:

```bash
pnpm add @codemirror/lang-javascript @codemirror/lang-html @codemirror/lang-css @codemirror/lang-rust @codemirror/lang-python @codemirror/lang-json @codemirror/lang-markdown @codemirror/lang-cpp
```

- [ ] **Step 2:** Create `src/lib/editor/code-langs.ts`:

```ts
import { LanguageDescription } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { rust } from "@codemirror/lang-rust";
import { python } from "@codemirror/lang-python";
import { json } from "@codemirror/lang-json";
import { cpp } from "@codemirror/lang-cpp";

// Compact registry — adding more languages later is one-line each.
export const codeLanguages: LanguageDescription[] = [
  LanguageDescription.of({ name: "javascript", alias: ["js", "ts", "tsx", "jsx", "typescript"], support: javascript({ jsx: true, typescript: true }) }),
  LanguageDescription.of({ name: "html", alias: ["xml", "svg"], support: html() }),
  LanguageDescription.of({ name: "css", alias: ["scss", "sass"], support: css() }),
  LanguageDescription.of({ name: "rust", alias: ["rs"], support: rust() }),
  LanguageDescription.of({ name: "python", alias: ["py"], support: python() }),
  LanguageDescription.of({ name: "json", support: json() }),
  LanguageDescription.of({ name: "cpp", alias: ["c", "c++"], support: cpp() }),
];
```

- [ ] **Step 3:** In `editor.ts` pass `codeLanguages` to `markdown(...)`:

```ts
import { codeLanguages } from "./code-langs";

// ...

markdown({
  base: markdownLanguage,
  codeLanguages,
  extensions: [GFM, { remove: ["SetextHeading"] }],
}),
```

- [ ] **Step 4:** Build + verify. Commit `feat(editor): syntax highlighting in fenced code blocks (js/ts/html/css/rust/py/json/cpp)`.

---

## Task 3: KaTeX math (replace decoration)

**Files:**
- Modify: `package.json`
- Create: `src/lib/editor/katex-deco.ts`
- Modify: `src/lib/editor/editor.ts`

**Approach:** A `ViewPlugin` walks visible ranges, finds `Math` and `BlockMath` nodes (provided by a custom lezer-markdown extension we add). For each match on an inactive line, replace with a `WidgetType` that renders the KaTeX HTML. On active lines, leave as plain text.

`@lezer/markdown` doesn't have a math extension built in — we use an inline rule via the `parseInline` API to detect `$...$` and a block parser for `$$...$$`. This is similar to what Obsidian/vscode do.

- [ ] **Step 1:** Install KaTeX:

```bash
pnpm add katex @types/katex
```

- [ ] **Step 2:** Create `src/lib/editor/katex-deco.ts` with:
- An inline parser that recognizes `$...$` (single-line, not adjacent to alphanumeric on the open) and emits a `Math` node.
- A block parser that recognizes `$$...$$` blocks and emits a `BlockMath` node.
- A `ViewPlugin` that decorates inactive lines containing these nodes by replacing them with `katex.renderToString(formula)` widgets.
- The block-active-line check uses the same logic as `live-preview.ts`.

(Detailed code: see plan author's reference implementation at https://codemirror.net/examples/decoration/ and https://github.com/davilima6/codemirror-md-table — adapt to KaTeX. Implementer should write this in 60-100 lines of TypeScript.)

- [ ] **Step 3:** Wire into editor.ts after `livePreview()`. Import KaTeX CSS in `theme.ts`:

```ts
import "katex/dist/katex.min.css";
```

- [ ] **Step 4:** Add a test that `$E=mc^2$` produces a `Math` node in the syntax tree.

- [ ] **Step 5:** Commit `feat(editor): KaTeX math — inline $...$ and block $$...$$`.

**Implementer judgment call:** if the inline parser conflicts with bash-style $-vars in code blocks or stomps on the `$1`, `$2` regex variables in fenced code, scope the inline math parser to only match outside code/fenced contexts. The `parseInline` API gives access to the surrounding context.

---

## Task 4: Mermaid diagrams (replace on cursor-leave only)

**Files:**
- Create: `src/lib/editor/mermaid-deco.ts`
- Modify: `src/lib/editor/editor.ts`
- Modify: `package.json`

**Approach:** When a fenced code block has language tag `mermaid` and the cursor is not inside it, replace the entire block with a rendered SVG widget. Inside the block, show the source so the user can edit. Mermaid is dynamically imported only when the first mermaid block is encountered.

- [ ] **Step 1:** Install:

```bash
pnpm add mermaid
```

- [ ] **Step 2:** Create `src/lib/editor/mermaid-deco.ts`:

A `ViewPlugin` that:
1. Walks `FencedCode` nodes
2. Finds the language info string (the part after the opening triple-backtick)
3. If lang is "mermaid" and the cursor's active line is NOT inside this code block:
   - Lazily `await import("mermaid")` once
   - Call `mermaid.render(uniqueId, source)` to get SVG
   - Replace the block with a widget containing that SVG
4. If render fails, replace with an error block containing the original source

Cache renders by source-hash so re-rendering the same block (e.g. when you scroll past it) is free. Use `WidgetType.eq` to allow reuse.

- [ ] **Step 3:** Add to editor.ts extensions array.

- [ ] **Step 4:** Add a basic test that a mermaid block produces no syntax errors and the extension doesn't throw on initial load.

- [ ] **Step 5:** Commit `feat(editor): Mermaid diagrams — render fenced ` + "```" + `mermaid blocks on cursor-leave`.

---

## Task 5: Footnotes — passive styling

**Files:**
- Modify: `src/lib/editor/editor.ts` — add tag styling for footnote markers

**Steps:**

- [ ] **Step 1:** Footnotes are already enabled in the parser (from Plan 1's `Options::ENABLE_FOOTNOTES`). The lezer-markdown spec emits `FootnoteMark` and `FootnoteReference` nodes. Add to `HIDABLE_NODES` in `live-preview.ts` (so `[^1]` markers hide on inactive lines), and add styling in HighlightStyle for the reference text.

```ts
// in HighlightStyle
{ tag: t.attributeName, color: "var(--md-accent)" }, // footnote refs use this tag
```

- [ ] **Step 2:** Test that `text[^1]\n\n[^1]: footnote` parses without errors and the references show as styled.

- [ ] **Step 3:** Commit `feat(editor): footnote marker styling`.

---

## Task 6: YAML frontmatter — dim styling

**Files:**
- Modify: `src/lib/editor/editor.ts`

**Steps:**

- [ ] **Step 1:** Frontmatter is already enabled (`Options::ENABLE_YAML_STYLE_METADATA_BLOCKS`). The lezer parser tags it with the `meta` tag. Add to HighlightStyle:

```ts
{ tag: t.meta, color: "var(--md-muted)", fontFamily: '"JetBrains Mono", ui-monospace, monospace', fontSize: "0.9em" },
```

- [ ] **Step 2:** Verify visually by running the app with a doc that has a `---\ntitle: Hello\n---` block.

- [ ] **Step 3:** Commit `feat(editor): YAML frontmatter visual treatment`.

---

## Task 7: Image paste + drag-drop

**Files:**
- Modify: `crates/markdusk-app/src/commands.rs` — new `save_pasted_image` command
- Modify: `src/lib/ipc/commands.ts`
- Create: `src/lib/editor/image-paste.ts`
- Modify: `src/lib/editor/editor.ts`

**Steps:**

- [ ] **Step 1: Rust command**

In commands.rs, add:

```rust
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};

#[tauri::command]
pub async fn save_pasted_image(
    doc_path: Option<String>,
    base64_data: String,
    extension: String,
) -> Result<String, String> {
    let bytes = BASE64.decode(&base64_data).map_err(|e| e.to_string())?;
    let parent_dir = match doc_path.as_deref() {
        Some(p) => std::path::Path::new(p)
            .parent()
            .ok_or("no parent directory")?
            .to_path_buf(),
        None => std::env::temp_dir().join("markdusk-images"),
    };
    tokio::fs::create_dir_all(&parent_dir).await.map_err(|e| e.to_string())?;
    let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S-%f");
    let filename = format!("paste-{}.{}", stamp, sanitize_ext(&extension));
    let target = parent_dir.join(&filename);
    tokio::fs::write(&target, &bytes).await.map_err(|e| e.to_string())?;
    // Return path relative to doc parent (or absolute if no doc_path).
    Ok(filename)
}

fn sanitize_ext(s: &str) -> String {
    s.chars().filter(|c| c.is_ascii_alphanumeric()).take(8).collect::<String>().to_lowercase()
}
```

Add deps to `crates/markdusk-app/Cargo.toml`:

```toml
base64 = "0.22"
chrono = "0.4"
```

Register the command in `lib.rs` invoke_handler.

- [ ] **Step 2: TS wrapper**

```ts
export async function savePastedImage(
  docPath: string | null,
  base64Data: string,
  extension: string,
): Promise<string> {
  return await invoke<string>("save_pasted_image", { docPath, base64Data, extension });
}
```

- [ ] **Step 3: Editor extension**

Create `src/lib/editor/image-paste.ts`:

```ts
import { EditorView } from "@codemirror/view";
import { savePastedImage } from "$lib/ipc/commands";

export interface ImagePasteDeps {
  getActiveDocPath: () => string | null;
}

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
};

async function blobToBase64(blob: Blob): Promise<string> {
  const reader = new FileReader();
  return await new Promise((resolve, reject) => {
    reader.onload = () => {
      const data = (reader.result as string).split(",", 2)[1] ?? "";
      resolve(data);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function handleFile(view: EditorView, file: File, deps: ImagePasteDeps): Promise<boolean> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return false;
  const base64 = await blobToBase64(file);
  const filename = await savePastedImage(deps.getActiveDocPath(), base64, ext);
  view.dispatch({
    changes: {
      from: view.state.selection.main.head,
      insert: `![](${filename})`,
    },
  });
  return true;
}

export function imagePaste(deps: ImagePasteDeps) {
  return EditorView.domEventHandlers({
    paste: (e, view) => {
      const items = e.clipboardData?.items;
      if (!items) return false;
      for (const item of Array.from(items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        if (!IMAGE_TYPES[file.type]) continue;
        e.preventDefault();
        void handleFile(view, file, deps);
        return true;
      }
      return false;
    },
    drop: (e, view) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return false;
      const file = files[0];
      if (!IMAGE_TYPES[file.type]) return false;
      e.preventDefault();
      void handleFile(view, file, deps);
      return true;
    },
  });
}
```

- [ ] **Step 4: Wire into editor.ts**

`createEditor` gains a third argument: `getActiveDocPath: () => string | null`. Pass `imagePaste({ getActiveDocPath })` into extensions. Update App.svelte to pass `() => tabs.active.path`.

- [ ] **Step 5: Test**

Add a test that pasting via `dispatchEvent(new ClipboardEvent("paste", ...))` produces a `![](filename)` insert. Use a stub for `savePastedImage` since it's an IPC call.

- [ ] **Step 6: Commit**

`feat(editor): image paste + drag-drop saves next to .md and inserts a relative link`

---

## Closing checklist

- [ ] All Rust + frontend tests green
- [ ] `cargo fmt` + `cargo clippy --workspace --all-targets -- -D warnings` clean
- [ ] `pnpm exec svelte-check` clean
- [ ] `pnpm build` succeeds
- [ ] Manual: code blocks are highlighted, tables look right, math renders on cursor-leave, mermaid renders on cursor-leave, frontmatter is dimmed, paste image into editor saves a file and inserts a link

When checked, append a Completion summary and consider Plan 4 (Polish: Amber theme, vim, typewriter, find/replace, spell-check).
