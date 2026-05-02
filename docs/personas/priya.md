# Priya the Researcher — academic-paper persona

Priya is a graduate-school researcher writing physics papers. Her documents have YAML frontmatter, math both inline (`$E=mc^2$`) and display (`$$...$$`), footnotes, citations, and section numbering. She organises her work as a folder of markdown files and uses the file tree to navigate between sections, plus the outline to jump within a section.

## Goal

Validate the structured-research flow: frontmatter handling, math rendering, footnotes, file tree, outline navigation, and many-tabs management.

## Procedure

1. Open the folder containing `tests/persona/fixtures/priya-paper.md` via File → Open Folder. **Expected:** a file tree appears in the sidebar listing markdown files in the folder; non-markdown files and dotfiles are hidden.
2. Click `priya-paper.md` in the file tree. **Expected:** the file opens in the editor; the YAML frontmatter is dimmed or rendered as a metadata block (not as plain text in the body).
3. Look at the inline `$E = mc^2$` in the abstract. **Expected:** it renders as a typeset math expression in place when the cursor is not on that line; the source is visible when the cursor is on the line.
4. Look at the display equation `$$E = mc^2$$`. **Expected:** it renders centered, in display style, larger than inline math.
5. Look at the Lagrangian `$$\mathcal{L} = ...$$`. **Expected:** symbols (`\mathcal{L}`, partial derivatives, Greek letters) render correctly with KaTeX; no fallback to raw TeX.
6. Click on a footnote marker like `[^1]`. **Expected:** either the footnote text appears as a tooltip/popover or the cursor jumps to the matching definition at the bottom of the document.
7. Open the outline panel (sidebar or View menu). **Expected:** outline lists Abstract, Introduction, Method, Discussion, Acknowledgements with the right nesting (each is `##`).
8. Click "Method" in the outline. **Expected:** editor scrolls to that heading; the heading line is highlighted briefly.
9. Create 9 additional small markdown files in the same folder (via the file tree's New File or in Finder), then open each. **Expected:** each opens as a new tab; the tab strip overflows gracefully (scroll or chevron, not a broken layout); switching between any two tabs is fast (no perceptible lag).
10. Edit the abstract slightly, then ⌘S. **Expected:** dirty indicator clears; mtime on disk advances; frontmatter is preserved byte-for-byte.
11. Hover the file tree over `priya-paper.md`. **Expected:** the full path is visible in a tooltip; the row indicates "active".
12. Switch the theme to Amber from View → Theme. **Expected:** math expressions remain legible (KaTeX SVGs/glyphs adapt color); code blocks remain readable; no element becomes invisible.
13. Quit with ⌘Q. **Expected:** the app exits cleanly; on next launch, the recently-used folder is offered or restored.

## Friction notes

- (fill in)
