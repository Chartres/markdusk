# Markdusk Polish Implementation Plan (Plan 4 of 6)

> **For agentic workers:** Use superpowers:subagent-driven-development.

**Goal:** Round out the writing experience with the high-value polish features the spec promised but Plans 1-3 deferred: Amber theme, vim keybindings, typewriter / focus center scroll, find & replace overlay, native spell-check.

**Architecture:** All small additive extensions. No new IPC. No new Rust. Mostly edits to `editor.ts`, a new theme file, and a settings store for "which theme / which mode is active".

---

## Task 1: Amber theme + theme switcher

**Files:**
- Create: `src/lib/theme/amber.css`
- Modify: `src/lib/theme/theme.ts` (add Theme type + applyTheme)
- Modify: `src/main.ts` (default theme)

**Steps:**

- [ ] Create `src/lib/theme/amber.css` with the Amber palette from the design spec (warm cream/ember). Mirror the structure of `smoke.css`:

```css
:root[data-theme="amber"] {
  --md-paper: #f4ecdb;
  --md-ink: #28323e;
  --md-accent: #b85c2a;
  --md-quote: #b85c2a;
  --md-muted: #7a6e54;
  --md-rule: #dbd1b3;
  --md-code-bg: #28323e;
  --md-code-fg: #e7dec5;
  --md-active-line: rgba(184,92,42,0.06);
}

@media (prefers-color-scheme: dark) {
  :root[data-theme="amber"] {
    --md-paper: #1a2230;
    --md-ink: #e0d8c0;
    --md-accent: #e08a4a;
    --md-quote: #c87038;
    --md-muted: #8a9098;
    --md-rule: #22293a;
    --md-code-bg: #0e141d;
    --md-code-fg: #d4ccb4;
    --md-active-line: rgba(224,138,74,0.06);
  }
}

:root[data-theme="amber"][data-appearance="light"] {
  --md-paper: #f4ecdb;
  --md-ink: #28323e;
  --md-accent: #b85c2a;
  --md-quote: #b85c2a;
  --md-muted: #7a6e54;
  --md-rule: #dbd1b3;
  --md-code-bg: #28323e;
  --md-code-fg: #e7dec5;
  --md-active-line: rgba(184,92,42,0.06);
}

:root[data-theme="amber"][data-appearance="dark"] {
  --md-paper: #1a2230;
  --md-ink: #e0d8c0;
  --md-accent: #e08a4a;
  --md-quote: #c87038;
  --md-muted: #8a9098;
  --md-rule: #22293a;
  --md-code-bg: #0e141d;
  --md-code-fg: #d4ccb4;
  --md-active-line: rgba(224,138,74,0.06);
}
```

- [ ] Update `src/lib/theme/theme.ts`:

```ts
import "./smoke.css";
import "./amber.css";
import "katex/dist/katex.min.css";

export type Appearance = "system" | "light" | "dark";
export type Theme = "smoke" | "amber";

export function applyAppearance(mode: Appearance): void {
  if (mode === "system") {
    document.documentElement.removeAttribute("data-appearance");
  } else {
    document.documentElement.setAttribute("data-appearance", mode);
  }
}

export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute("data-theme", theme);
}
```

- [ ] In `src/main.ts`, call both:

```ts
applyTheme("smoke");
applyAppearance("system");
```

- [ ] Add a test in `theme.test.ts`:

```ts
it("sets data-theme when applyTheme is called", () => {
  applyTheme("amber");
  expect(document.documentElement.getAttribute("data-theme")).toBe("amber");
  applyTheme("smoke");
  expect(document.documentElement.getAttribute("data-theme")).toBe("smoke");
});
```

- [ ] Verify + commit `feat(theme): Amber theme — warm cream/ember alternative palette`.

---

## Task 2: Theme + appearance settings UI (View menu)

**Files:**
- Modify: `crates/markdusk-app/src/menu.rs` — add View → Theme → Smoke / Amber and View → Appearance → System / Light / Dark submenus
- Modify: `src/routes/App.svelte` — handle the menu events

**Steps:**

- [ ] In menu.rs, add to the View submenu:

```rust
let theme_smoke = MenuItemBuilder::with_id("theme:smoke", "Smoke").build(app)?;
let theme_amber = MenuItemBuilder::with_id("theme:amber", "Amber").build(app)?;
let theme_submenu = SubmenuBuilder::new(app, "Theme")
    .item(&theme_smoke)
    .item(&theme_amber)
    .build()?;

let app_system = MenuItemBuilder::with_id("appearance:system", "System").build(app)?;
let app_light = MenuItemBuilder::with_id("appearance:light", "Light").build(app)?;
let app_dark = MenuItemBuilder::with_id("appearance:dark", "Dark").build(app)?;
let appearance_submenu = SubmenuBuilder::new(app, "Appearance")
    .item(&app_system)
    .item(&app_light)
    .item(&app_dark)
    .build()?;

let view_submenu = SubmenuBuilder::new(app, "View")
    .item(&MenuItemBuilder::with_id("view:toggle-left", "Toggle Files Sidebar").accelerator("CmdOrCtrl+\\").build(app)?)
    .item(&MenuItemBuilder::with_id("view:toggle-right", "Toggle Outline").accelerator("CmdOrCtrl+Shift+\\").build(app)?)
    .item(&MenuItemBuilder::with_id("view:focus", "Focus Mode").accelerator("CmdOrCtrl+Shift+F").build(app)?)
    .separator()
    .item(&theme_submenu)
    .item(&appearance_submenu)
    .build()?;
```

- [ ] In App.svelte's menu listener add:

```ts
case "theme:smoke": applyTheme("smoke"); break;
case "theme:amber": applyTheme("amber"); break;
case "appearance:system": applyAppearance("system"); break;
case "appearance:light": applyAppearance("light"); break;
case "appearance:dark": applyAppearance("dark"); break;
```

(Import `applyTheme, applyAppearance` from `$lib/theme/theme`.)

- [ ] Verify menu items appear and switching works visually. Commit `feat(menu): View → Theme + Appearance submenus`.

---

## Task 3: Vim keybindings (toggle in settings)

**Files:**
- Modify: `package.json` (add `@replit/codemirror-vim`)
- Modify: `src/lib/editor/editor.ts`
- Modify: `crates/markdusk-app/src/menu.rs` (add View → Editor Mode → Default / Vim)
- Modify: `src/routes/App.svelte`

**Steps:**

- [ ] Install:
  ```bash
  pnpm add @replit/codemirror-vim
  ```

- [ ] Add to editor.ts a `vimMode` parameter and conditional extension. The cleanest approach is a `Compartment` so vim can be toggled at runtime without recreating the editor:

```ts
import { Compartment } from "@codemirror/state";
import { vim } from "@replit/codemirror-vim";

export const vimCompartment = new Compartment();

// In createEditor extensions:
vimCompartment.of([]),  // empty by default

// Export a helper:
export function setVim(view: EditorView, enabled: boolean) {
  view.dispatch({
    effects: vimCompartment.reconfigure(enabled ? vim() : []),
  });
}
```

- [ ] Add menu entries `mode:default` and `mode:vim` in a "Editor Mode" View submenu.

- [ ] In App.svelte, when those menu events fire, call `setVim(view!, …)`. Track a `vimOn` $state for the currently-active mode.

- [ ] Verify: build, tests, fmt, clippy. Commit `feat(editor): Vim keybindings (toggle via View → Editor Mode → Vim)`.

---

## Task 4: Typewriter / center-scroll mode

**Files:**
- Modify: `src/lib/editor/editor.ts` (typewriter compartment + extension)
- Modify: `src/routes/App.svelte` (toggle on `view:focus` already; bind typewriter to focus mode for now)

**Steps:**

- [ ] Add a typewriter extension that recenters the active line on caret movement:

```ts
import { ViewPlugin, type ViewUpdate } from "@codemirror/view";

export const typewriterCompartment = new Compartment();

const typewriter = ViewPlugin.fromClass(
  class {
    update(u: ViewUpdate) {
      if (u.selectionSet || u.docChanged) {
        const head = u.state.selection.main.head;
        const block = u.view.lineBlockAt(head);
        const target = u.view.scrollDOM.clientHeight / 2 - (block.top + block.height / 2 - u.view.scrollDOM.scrollTop);
        u.view.scrollDOM.scrollTop = u.view.scrollDOM.scrollTop - target;
      }
    }
  },
);
```

(Refine: only scroll if needed; throttle to avoid thrashing during normal typing. The simplest version smoothly recenters on every caret move.)

- [ ] Bind to `focusMode` in App.svelte: when entering focus mode, also enable typewriter; when leaving, disable.

- [ ] Add a soft fade for non-active paragraphs: a CSS class `.cm-md-typewriter-dim` that's applied via the same `livePreview`-style decoration to lines NOT in focus. Or skip dimming for now and just do center-scroll.

- [ ] Verify + commit `feat(editor): typewriter / center-scroll in focus mode`.

---

## Task 5: Find & Replace overlay

**Files:**
- Modify: `src/lib/editor/editor.ts`
- Modify: `crates/markdusk-app/src/menu.rs` (add Edit → Find / Replace)

**Steps:**

- [ ] Install:
  ```bash
  pnpm add @codemirror/search
  ```

- [ ] In editor.ts add to extensions:

```ts
import { search, searchKeymap } from "@codemirror/search";

// In createEditor extensions:
search({ top: true }),
keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap]),
```

(`searchKeymap` adds ⌘F → open search, ⌘G → next, ⌘⇧G → previous, ⌘⇧F currently bound to focus mode by us — bypass, since focus mode is on the document handler not the editor's keymap. Verify there's no conflict.)

- [ ] Add Edit submenu entries `edit:find` and `edit:replace` (with `CmdOrCtrl+F` and `CmdOrCtrl+Alt+F` accelerators).

- [ ] In App.svelte's menu listener, dispatch the corresponding CodeMirror commands:

```ts
import { openSearchPanel, replaceAll } from "@codemirror/search";

case "edit:find":
  if (view) openSearchPanel(view);
  break;
case "edit:replace":
  if (view) {
    openSearchPanel(view);
    // The search panel auto-shows the replace UI when ⌘⌥F is the trigger; passing
    // an effect to enable replace mode is also possible. Default behavior is fine.
  }
  break;
```

- [ ] Verify the search panel appears on ⌘F and is themed reasonably (CodeMirror's default works). Commit `feat(editor): find & replace overlay (⌘F / ⌘⌥F)`.

---

## Task 6: Spell check

**Files:**
- Modify: `src/lib/editor/editor.ts`
- Modify: `index.html`

**Steps:**

- [ ] WKWebView spell-checks `contenteditable` elements when the `spellcheck` attribute is true. CodeMirror's `cm-content` is a contenteditable. Add to the `EditorView.theme({...})`:

```ts
".cm-content": {
  // existing rules…
  // (spellcheck is not a CSS property; it's an HTML attribute. Add via contentAttributes instead.)
},
```

Actually use `EditorView.contentAttributes`:

```ts
import { EditorView } from "@codemirror/view";

// In createEditor extensions:
EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on", autocapitalize: "on" }),
```

(This adds the attributes to `.cm-content`. macOS's NSSpellChecker via WKWebView handles the rest — red underlines on misspellings, right-click for suggestions.)

- [ ] Add a menu toggle Edit → Spell Check (default on). Track via a Compartment so it can be turned off if it's noisy:

```ts
import { Compartment } from "@codemirror/state";
export const spellCheckCompartment = new Compartment();
spellCheckCompartment.of(EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on" }))

export function setSpellCheck(view: EditorView, enabled: boolean) {
  view.dispatch({
    effects: spellCheckCompartment.reconfigure(
      enabled
        ? EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on" })
        : EditorView.contentAttributes.of({ spellcheck: "false" }),
    ),
  });
}
```

- [ ] Verify visually that misspelled words get red underlines (manually). Commit `feat(editor): native macOS spell check via WKWebView`.

---

## Closing checklist

- [ ] All Rust + frontend tests green
- [ ] fmt / clippy / svelte-check / build clean
- [ ] Manual verification of each polish feature

When done, append a Completion summary and proceed to Plan 5 (Export + Quick Look) only if the user explicitly requests it.
