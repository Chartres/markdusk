import { Compartment, EditorState, type Extension } from "@codemirror/state";
import {
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  keymap,
  lineNumbers as cmLineNumbers,
} from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import {
  markdown,
  markdownLanguage,
  insertNewlineContinueMarkup,
  deleteMarkupBackward,
} from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { GFM } from "@lezer/markdown";
import { vim } from "@replit/codemirror-vim";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { codeLanguages } from "./code-langs";
import { livePreview } from "./live-preview";
import { katexDecorations } from "./katex-deco";
import { mermaidDecorations } from "./mermaid-deco";
import { imagePaste } from "./image-paste";
import { focusDim, setFocusDim, type FocusDimMode } from "./focus-dim";
import { smartPunctuation, setSmartPunctuation } from "./smart-punctuation";

export { setFocusDim, type FocusDimMode, setSmartPunctuation };

export type ChangeHandler = (newContents: string) => void;

const markduskHighlight = HighlightStyle.define([
  { tag: t.heading1, fontSize: "1.7em", fontWeight: "700", color: "var(--md-accent)", lineHeight: "1.25" },
  { tag: t.heading2, fontSize: "1.4em", fontWeight: "700", color: "var(--md-accent)", lineHeight: "1.3" },
  { tag: t.heading3, fontSize: "1.2em", fontWeight: "700", color: "var(--md-accent)" },
  { tag: t.heading4, fontSize: "1.1em", fontWeight: "700", color: "var(--md-accent)" },
  { tag: [t.heading5, t.heading6], fontWeight: "700", color: "var(--md-accent)" },
  { tag: t.strong, fontWeight: "700" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: [t.link, t.url], color: "var(--md-accent)", textDecoration: "underline" },
  { tag: t.monospace, fontFamily: '"JetBrains Mono", ui-monospace, monospace', color: "var(--md-code-fg)", background: "var(--md-code-bg)", padding: "1px 4px", borderRadius: "3px" },
  { tag: t.quote, color: "var(--md-quote)", fontStyle: "italic" },
  { tag: t.list, color: "var(--md-ink)" },
  { tag: t.processingInstruction, color: "var(--md-muted)" },
  { tag: t.attributeName, color: "var(--md-accent)", fontSize: "0.8em", verticalAlign: "super" },
  { tag: t.meta, color: "var(--md-muted)", fontFamily: '"JetBrains Mono", ui-monospace, monospace' },
]);

const markduskTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--md-ink)",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: 'ui-serif, Charter, "Iowan Old Style", Georgia, serif',
    fontSize: "16px",
    lineHeight: "1.65",
    caretColor: "var(--md-accent)",
    padding: "32px 12px",
  },
  ".cm-line": {
    padding: "2px 0",
  },
  ".cm-cursor": {
    borderLeftColor: "var(--md-accent)",
  },
  "&.cm-focused .cm-selectionBackground, ::selection": {
    backgroundColor: "rgba(61,106,94,0.18)",
  },
  ".cm-md-active": {
    backgroundColor: "var(--md-active-line)",
  },
});

export const vimCompartment = new Compartment();

export function setVim(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: vimCompartment.reconfigure(enabled ? vim() : []),
  });
}

const typewriter = ViewPlugin.fromClass(
  class {
    update(u: ViewUpdate) {
      if (!u.selectionSet && !u.docChanged) return;
      const head = u.state.selection.main.head;
      const block = u.view.lineBlockAt(head);
      const dom = u.view.scrollDOM;
      const desired = block.top + block.height / 2 - dom.clientHeight / 2;
      const max = Math.max(0, dom.scrollHeight - dom.clientHeight);
      const clamped = Math.min(Math.max(desired, 0), max);
      if (Math.abs(dom.scrollTop - clamped) > 1) {
        dom.scrollTop = clamped;
      }
    }
  },
);

export const typewriterCompartment = new Compartment();

export function setTypewriter(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: typewriterCompartment.reconfigure(enabled ? typewriter : []),
  });
}

export function openFind(view: EditorView): void {
  openSearchPanel(view);
}

export function openReplace(view: EditorView): void {
  openSearchPanel(view);
  // The search panel always shows Replace controls; opening it puts focus on
  // the search field. Move focus to the replace field via a synthetic Tab.
  queueMicrotask(() => {
    const dom = view.dom.querySelector<HTMLInputElement>(
      ".cm-search .cm-textfield[name='replace']",
    );
    dom?.focus();
  });
}

export const lineNumbersCompartment = new Compartment();

export function setLineNumbers(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: lineNumbersCompartment.reconfigure(enabled ? cmLineNumbers() : []),
  });
}

export const spellCheckCompartment = new Compartment();

export function setSpellCheck(view: EditorView, enabled: boolean): void {
  view.dispatch({
    effects: spellCheckCompartment.reconfigure(
      enabled
        ? EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on" })
        : EditorView.contentAttributes.of({ spellcheck: "false" }),
    ),
  });
}

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange?: ChangeHandler,
  getActiveDocPath?: () => string | null,
): EditorView {
  const extensions: Extension[] = [
    vimCompartment.of([]),
    typewriterCompartment.of([]),
    lineNumbersCompartment.of([]),
    spellCheckCompartment.of(
      EditorView.contentAttributes.of({ spellcheck: "true", autocorrect: "on" }),
    ),
    history(),
    search({ top: true }),
    closeBrackets(),
    keymap.of([
      // Markdown list continuation: Enter inside `- ` or `1. ` continues the
      // list; on an empty bullet, exits the list.
      { key: "Enter", run: insertNewlineContinueMarkup },
      // Backspace inside a markup prefix deletes the prefix cleanly.
      { key: "Backspace", run: deleteMarkupBackward },
      ...closeBracketsKeymap,
      ...defaultKeymap,
      ...historyKeymap,
      ...searchKeymap,
    ]),
    EditorView.lineWrapping,
    markdown({
      base: markdownLanguage,
      codeLanguages,
      extensions: [GFM, { remove: ["SetextHeading"] }],
    }),
    syntaxHighlighting(markduskHighlight),
    markduskTheme,
    livePreview(),
    focusDim("off"),
    smartPunctuation(false),
    katexDecorations(),
    mermaidDecorations(),
    imagePaste({ getActiveDocPath: getActiveDocPath ?? (() => null) }),
    EditorView.updateListener.of((v) => {
      if (v.docChanged && onChange) onChange(v.state.doc.toString());
    }),
  ];

  return new EditorView({
    parent,
    state: EditorState.create({ doc: initial, extensions }),
  });
}
