import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { type Extension, RangeSet, RangeSetBuilder } from "@codemirror/state";

// Replace (not mark) — replacement decorations are atomic for cursor navigation,
// so up/down arrow keys step over hidden markers as a single unit instead of
// landing inside a `display: none` range. Mark + display:none breaks vertical
// caret motion around bold/italic/link markers.
const HIDDEN = Decoration.replace({});
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
        // HeaderMark covers only the '#' chars, not the space after them.
        // Extend the hidden range over a single trailing space so '# Hello'
        // renders as 'Hello' (not ' Hello').
        let nodeTo = node.to;
        if (
          node.name === "HeaderMark" &&
          view.state.doc.sliceString(nodeTo, nodeTo + 1) === " "
        ) {
          nodeTo += 1;
        }
        markBuilder.add(node.from, nodeTo, HIDDEN);
      },
    });
  }

  return RangeSet.join([lineBuilder.finish(), markBuilder.finish()]);
}

export function livePreview(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      // Cache the last active line so we can skip the (expensive) syntax tree
      // walk when only the cursor column changed within the same line.
      private lastActiveLine = -1;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view);
        this.lastActiveLine = view.state.doc.lineAt(
          view.state.selection.main.head,
        ).number;
      }

      update(u: ViewUpdate) {
        const newLine = u.state.doc.lineAt(u.state.selection.main.head).number;
        const lineChanged = newLine !== this.lastActiveLine;

        if (u.docChanged || u.viewportChanged || lineChanged) {
          this.decorations = buildDecorations(u.view);
          this.lastActiveLine = newLine;
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
