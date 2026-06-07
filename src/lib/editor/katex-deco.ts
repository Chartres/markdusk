import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { type Extension, RangeSetBuilder } from "@codemirror/state";
import katex from "katex";

class KatexWidget extends WidgetType {
  constructor(
    readonly tex: string,
    readonly displayMode: boolean,
  ) {
    super();
  }
  eq(other: KatexWidget): boolean {
    return other.tex === this.tex && other.displayMode === this.displayMode;
  }
  toDOM(): HTMLElement {
    const span = document.createElement(this.displayMode ? "div" : "span");
    span.className = this.displayMode
      ? "cm-md-math-block"
      : "cm-md-math-inline";
    try {
      span.innerHTML = katex.renderToString(this.tex, {
        displayMode: this.displayMode,
        throwOnError: false,
      });
    } catch (e) {
      span.textContent = `math error: ${(e as Error).message}`;
      span.classList.add("cm-md-math-error");
    }
    return span;
  }
  ignoreEvent(): boolean {
    return false;
  }
}

// Inline single-line: $...$ but not adjacent to alphanumeric (avoid $1 in code).
// We require non-whitespace immediately after the opening $ and immediately
// before the closing $, and disallow newlines inside.
const INLINE_MATH =
  /(?<![A-Za-z0-9_$])\$([^\s$][^$\n]*?[^\s$]|[^\s$\n])\$(?![A-Za-z0-9])/g;
const BLOCK_MATH = /(^|\n)\$\$\n([\s\S]*?)\n\$\$(?=\n|$)/g;

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursor = view.state.selection.main.head;

  for (const { from, to } of view.visibleRanges) {
    const text = view.state.doc.sliceString(from, to);

    // Block math first; remember those ranges to skip when scanning inline.
    const blockSpans: Array<[number, number]> = [];
    BLOCK_MATH.lastIndex = 0;
    let bMatch: RegExpExecArray | null;
    while ((bMatch = BLOCK_MATH.exec(text)) !== null) {
      const startInDoc = from + bMatch.index + bMatch[1].length; // skip leading \n if captured
      const endInDoc = from + BLOCK_MATH.lastIndex;
      blockSpans.push([startInDoc, endInDoc]);
      if (cursor >= startInDoc && cursor <= endInDoc) continue;
      const tex = bMatch[2];
      builder.add(
        startInDoc,
        endInDoc,
        Decoration.replace({ widget: new KatexWidget(tex, true), block: true }),
      );
    }

    INLINE_MATH.lastIndex = 0;
    let iMatch: RegExpExecArray | null;
    while ((iMatch = INLINE_MATH.exec(text)) !== null) {
      const startInDoc = from + iMatch.index;
      const endInDoc = from + INLINE_MATH.lastIndex;
      // Skip if inside a block math span.
      if (blockSpans.some(([bs, be]) => startInDoc >= bs && endInDoc <= be))
        continue;
      // Skip if cursor is inside.
      if (cursor >= startInDoc && cursor <= endInDoc) continue;
      const tex = iMatch[1];
      builder.add(
        startInDoc,
        endInDoc,
        Decoration.replace({ widget: new KatexWidget(tex, false) }),
      );
    }
  }
  return builder.finish();
}

export function katexDecorations(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged) {
          this.decorations = buildDecorations(u.view);
        }
      }
    },
    {
      decorations: (v) => v.decorations,
      provide: (plugin) =>
        EditorView.atomicRanges.of((view) => {
          return view.plugin(plugin)?.decorations ?? Decoration.none;
        }),
    },
  );
}
