import { EditorState, type Extension } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { tags as t } from "@lezer/highlight";
import { livePreview } from "./live-preview";

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
]);

const markduskTheme = EditorView.theme({
  "&": {
    backgroundColor: "transparent",
    color: "var(--md-ink)",
  },
  ".cm-content": {
    fontFamily: 'ui-serif, Charter, "Iowan Old Style", Georgia, serif',
    fontSize: "16px",
    lineHeight: "1.65",
    caretColor: "var(--md-accent)",
    padding: "32px 12px",
    maxWidth: "720px",
    margin: "0 auto",
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
  ".cm-md-hidden-mark": {
    display: "none",
  },
});

export function createEditor(
  parent: HTMLElement,
  initial: string,
  onChange?: ChangeHandler,
): EditorView {
  const extensions: Extension[] = [
    history(),
    keymap.of([...defaultKeymap, ...historyKeymap]),
    markdown(),
    syntaxHighlighting(markduskHighlight),
    markduskTheme,
    livePreview(),
    EditorView.updateListener.of((v) => {
      if (v.docChanged && onChange) onChange(v.state.doc.toString());
    }),
  ];

  return new EditorView({
    parent,
    state: EditorState.create({ doc: initial, extensions }),
  });
}
