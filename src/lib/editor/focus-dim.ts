import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { Compartment, type Extension, RangeSetBuilder } from "@codemirror/state";

/**
 * iA-Writer-style Focus Mode dim.
 *
 * Two modes:
 *  - "paragraph": the paragraph (block) at the caret stays full opacity,
 *    everything else dims to ~35%.
 *  - "sentence":  the sentence at the caret stays full opacity. Sentence
 *    boundaries are heuristic — `.`, `!`, `?` followed by whitespace.
 *  - "off":       no dimming.
 *
 * Writers consistently rate this as the single feature that makes them
 * stay in iA Writer (Maya persona, JTBD #1 "I want to judge rhythm and
 * length while I write").
 */

export type FocusDimMode = "off" | "paragraph" | "sentence";

const dimDeco = Decoration.mark({ class: "cm-md-dim" });

function buildParagraphDim(view: EditorView): DecorationSet {
  const head = view.state.selection.main.head;
  const doc = view.state.doc;
  const docEnd = doc.length;

  // Find paragraph-like block boundaries by scanning for blank lines.
  // This is simpler and more reliable than the syntax tree for prose.
  const text = doc.toString();
  let start = 0;
  for (let i = head - 1; i > 0; i--) {
    if (text[i] === "\n" && (i === 0 || text[i - 1] === "\n")) {
      start = i + 1;
      break;
    }
  }
  let end = docEnd;
  for (let i = head; i < text.length; i++) {
    if (text[i] === "\n" && i + 1 < text.length && text[i + 1] === "\n") {
      end = i;
      break;
    }
  }

  void syntaxTree;

  const builder = new RangeSetBuilder<Decoration>();
  if (start > 0) builder.add(0, start, dimDeco);
  if (end < docEnd) builder.add(end, docEnd, dimDeco);
  return builder.finish();
}

function buildSentenceDim(view: EditorView): DecorationSet {
  const doc = view.state.doc;
  const head = view.state.selection.main.head;
  const text = doc.toString();

  // Find sentence start: walk backward to previous .?!\n followed by space, or doc start.
  let start = 0;
  for (let i = head - 1; i > 0; i--) {
    const ch = text[i];
    if (ch === "\n") {
      start = i + 1;
      break;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      // Require the next char (if any) to be whitespace, so URLs and decimals
      // aren't sentence boundaries.
      const next = text[i + 1];
      if (!next || /\s/.test(next)) {
        start = i + 1;
        // Skip leading whitespace of the next sentence.
        while (start < text.length && /\s/.test(text[start]) && text[start] !== "\n") start++;
        break;
      }
    }
  }

  // Find sentence end.
  let end = text.length;
  for (let i = head; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\n") {
      end = i;
      break;
    }
    if (ch === "." || ch === "!" || ch === "?") {
      const next = text[i + 1];
      if (!next || /\s/.test(next)) {
        end = i + 1;
        break;
      }
    }
  }

  const builder = new RangeSetBuilder<Decoration>();
  if (start > 0) builder.add(0, start, dimDeco);
  if (end < text.length) builder.add(end, text.length, dimDeco);
  return builder.finish();
}

function makePlugin(mode: FocusDimMode) {
  if (mode === "off") return [];
  const builder = mode === "paragraph" ? buildParagraphDim : buildSentenceDim;
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = builder(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged) {
          this.decorations = builder(u.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

export const focusDimCompartment = new Compartment();

export function focusDim(mode: FocusDimMode = "off"): Extension {
  return focusDimCompartment.of(makePlugin(mode));
}

export function setFocusDim(view: EditorView, mode: FocusDimMode): void {
  view.dispatch({ effects: focusDimCompartment.reconfigure(makePlugin(mode)) });
}
