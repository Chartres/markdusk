# Diego the Engineer — technical-docs persona

Diego is a backend engineer who maintains README.md files, internal architecture docs, and runbooks. He uses vim bindings everywhere, lives in a terminal, and expects keyboard-first navigation. He wants code blocks to look right, mermaid diagrams to render, and tables to be readable. He often has 5+ docs open at once.

## Goal

Validate technical-document workflows: vim bindings, multi-tab editing, code block / table / mermaid rendering, HTML export.

## Procedure

1. Open `tests/persona/fixtures/diego-readme.md`. **Expected:** the README opens; code fences highlight (Rust, JSON, bash); the GFM table renders with aligned columns; the mermaid block renders as a flowchart, not as raw text.
2. Open View → Editor Mode and switch to Vim. **Expected:** a mode indicator appears (NORMAL); typing letters does not insert characters; `i` enters insert mode; `Esc` returns to NORMAL.
3. From NORMAL mode, press `gg` then `G`. **Expected:** cursor jumps to the top of the document, then to the bottom; viewport follows.
4. From NORMAL mode, type `/widgets` and press Return. **Expected:** the find overlay shows the search; matches are highlighted; `n` jumps to the next match.
5. Press ⌘O four times, opening four additional `.md` files (any). **Expected:** each opens as a new tab to the right; the tab strip shows 5 tabs; the active tab is the most recently opened.
6. Use ⌘1 through ⌘5 (or click) to cycle tabs. **Expected:** switching is instant; cursor position and scroll within each tab are preserved.
7. Use ⌘W to close a tab. **Expected:** the tab disappears; an adjacent tab becomes active; if any tab has unsaved changes, a confirm prompt appears for that tab specifically.
8. Click into a code block and edit one line. **Expected:** syntax highlighting updates as you type; surrounding fence markers are preserved.
9. File → Export → HTML. Choose a destination. **Expected:** an `.html` file is written; opening it in a browser shows the document with embedded CSS, code blocks with monospace font, the table laid out, and the mermaid diagram either rendered or visible as a labeled placeholder.
10. Open the exported HTML on disk and inspect: there is no `<link>` to external stylesheets; CSS is inline. **Expected:** the file is portable; sending it to a colleague will render identically with no missing assets (other than the linked image).
11. Switch back to the original `diego-readme.md` tab and verify the file on disk has not been modified by export. **Expected:** mtime is unchanged; contents byte-for-byte the same.
12. Exit vim mode (View → Editor Mode → Normal). **Expected:** mode indicator disappears; standard macOS text editing resumes; cursor stays where it was.

## Friction notes

- (fill in)
