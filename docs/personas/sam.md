# Sam the Switcher — first-launch persona

Sam is a Bear/Obsidian user evaluating Markdusk. They're judging "feels good in the first 5 minutes." Sam will not read documentation; they will open the app, type a few sentences, click around the menus, and decide. They expect sensible defaults and nothing to ask them to configure anything.

## Goal

Validate first-launch UX, default behaviors, and the writing experience without configuration.

## Procedure

1. Quit and uninstall any prior Markdusk install, then launch Markdusk for the first time. **Expected:** an Untitled tab opens; the cursor is in the editor; the Smoke theme is applied (smoke-grey/sage palette); no setup wizard is shown.
2. Type "Hello world" in the editor. **Expected:** text appears immediately; serif font; no markdown markup overlay obscuring what was typed; cursor is a thin amber bar.
3. Press Return twice and type `# A heading`. **Expected:** the line styles up as a heading (larger, bolder, accent-colored) once the leading `#` is recognised; no live-preview "page break" jump.
4. Type a paragraph below the heading containing `**bold**` and `*italic*`. **Expected:** the words inside the markers render as bold/italic in place; markers themselves dim or hide on the cursor's current line vs other lines.
5. Press ⌘N. **Expected:** a new Untitled tab opens to the right of the current one and becomes active; the previous tab is preserved.
6. Switch back to the first tab by clicking its tab strip entry. **Expected:** the editor restores the previous content and cursor position; tab strip indicates which tab is active.
7. Press ⌘S without a save path. **Expected:** a native save panel opens, defaulted to a sensible directory (Documents or last-used); the file extension defaults to `.md`.
8. Save as `sam-test.md`. **Expected:** the tab title updates to `sam-test`; the dirty indicator (•) clears; the file appears on disk.
9. Open the View menu. **Expected:** entries for Theme (Smoke / Amber), Editor Mode (Normal / Vim), Focus Mode, Find & Replace are all visible and not greyed out for a saved file.
10. Switch theme to Amber. **Expected:** background warms to a paper-cream tone; accent shifts to sienna/burnt-orange; the change is instant; reopening the app preserves the choice.
11. Toggle Focus Mode. **Expected:** chrome dims; the current paragraph stays centered (typewriter scroll); other paragraphs fade slightly.
12. Press ⌘F and search for "Hello". **Expected:** find overlay slides in at the top; matches are highlighted in the document; pressing Return cycles matches; Esc dismisses the overlay.

## Friction notes

- (fill in)
