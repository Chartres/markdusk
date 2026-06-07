# Maya the Writer — long-form essay persona

Maya is an essayist and Substack writer. She drafts in markdown, cares deeply about typography and how the page looks while she's writing, and exports to PDF for editor friends. She wants distractions gone and serif text on a calm page. She does not write code.

## Goal

Validate the long-form writing flow: drafting, formatting, theme aesthetics, focus mode, image paste, and export.

## Procedure

1. Open `tests/persona/fixtures/maya-essay.md` (double-click in Finder or via File → Open). **Expected:** the essay renders in a single editor pane; first heading is large and accent-colored; body is serif; line length feels readable (not full-width).
2. Scroll to the bottom of the document. **Expected:** scrolling is smooth; no jank as headings, blockquote, and bullets pass under the cursor.
3. Click into the first paragraph and select a phrase. Press ⌘B. **Expected:** the selection is wrapped in `**...**` and renders bold immediately.
4. Select another phrase and press ⌘I. **Expected:** the selection is wrapped in `*...*` and renders italic immediately.
5. Take a screenshot to the clipboard (⌃⌘⇧4) of any window, then paste with ⌘V into the document. **Expected:** the image is saved next to the document (or in an `images/` sibling) and an `![](path)` reference is inserted at the cursor.
6. Press ⌘S. **Expected:** the save indicator clears; the file's mtime on disk advances.
7. Open the View menu and select Theme → Amber. **Expected:** background warms to paper-cream; the accent shifts to sienna; the document remains exactly where it was, no scroll jump.
8. Toggle Focus Mode (View → Focus Mode or its keyboard shortcut). **Expected:** sidebar and outline dim or hide; the current paragraph stays vertically centered as Maya types; other paragraphs are softly de-emphasised.
9. Type one new paragraph at the end of the essay. **Expected:** as the paragraph grows, the typewriter scroll keeps the cursor near the screen's vertical center.
10. Exit focus mode. **Expected:** chrome returns to full opacity in one smooth transition.
11. File → Export → PDF…. Choose a destination. **Expected:** a PDF is written; opening it in Preview shows serif body, accent-colored headings, the embedded screenshot, and reasonable margins; no editor chrome leaks into the PDF.
12. Quit Markdusk with ⌘Q. **Expected:** the app exits cleanly within a second; no "save changes?" prompt because the document was saved.

## Friction notes

- (fill in)
