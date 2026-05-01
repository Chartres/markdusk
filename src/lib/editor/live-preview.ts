import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { type Extension, RangeSet, RangeSetBuilder } from "@codemirror/state";

const HIDDEN = Decoration.mark({ class: "cm-md-hidden-mark" });
const ACTIVE_LINE = Decoration.line({ class: "cm-md-active" });

const HIDABLE_NODES = new Set([
  "HeaderMark",
  "EmphasisMark",
  "StrongEmphasisMark",
  "InlineCodeMark",
  "CodeMark",
  "QuoteMark",
  "LinkMark",
]);

function buildDecorations(view: EditorView): DecorationSet {
  const lineBuilder = new RangeSetBuilder<Decoration>();
  const markBuilder = new RangeSetBuilder<Decoration>();

  const cursor = view.state.selection.main.head;
  const activeLine = view.state.doc.lineAt(cursor);
  lineBuilder.add(activeLine.from, activeLine.from, ACTIVE_LINE);

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (!HIDABLE_NODES.has(node.name)) return;
        const line = view.state.doc.lineAt(node.from);
        if (line.number === activeLine.number) return;
        markBuilder.add(node.from, node.to, HIDDEN);
      },
    });
  }

  return RangeSet.join([lineBuilder.finish(), markBuilder.finish()]);
}

export function livePreview(): Extension {
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
    { decorations: (v) => v.decorations },
  );
}
