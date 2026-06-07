import { syntaxTree } from "@codemirror/language";
import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { type Extension, RangeSetBuilder } from "@codemirror/state";

let mermaidInstance: typeof import("mermaid").default | null = null;
let mermaidLoading: Promise<typeof import("mermaid").default> | null = null;

async function loadMermaid() {
  if (mermaidInstance) return mermaidInstance;
  if (!mermaidLoading) {
    mermaidLoading = import("mermaid").then((m) => {
      m.default.initialize({ startOnLoad: false, theme: "default" });
      mermaidInstance = m.default;
      return m.default;
    });
  }
  return await mermaidLoading;
}

const renderCache = new Map<string, string>();

class MermaidWidget extends WidgetType {
  constructor(readonly source: string) {
    super();
  }
  eq(other: MermaidWidget): boolean {
    return other.source === this.source;
  }
  toDOM(): HTMLElement {
    const wrap = document.createElement("div");
    wrap.className = "cm-md-mermaid";
    const cached = renderCache.get(this.source);
    if (cached) {
      wrap.innerHTML = cached;
      return wrap;
    }
    wrap.textContent = "Rendering diagram…";
    void this.renderInto(wrap);
    return wrap;
  }
  async renderInto(wrap: HTMLElement) {
    try {
      const mermaid = await loadMermaid();
      const id = `mermaid-${Math.random().toString(36).slice(2, 10)}`;
      const { svg } = await mermaid.render(id, this.source);
      renderCache.set(this.source, svg);
      wrap.innerHTML = svg;
    } catch (e) {
      wrap.classList.add("cm-md-mermaid-error");
      wrap.textContent = `Mermaid error: ${(e as Error).message}`;
    }
  }
  ignoreEvent(): boolean {
    return false;
  }
}

function buildDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const cursor = view.state.selection.main.head;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name !== "FencedCode") return;
        // Find the language tag (CodeInfo node) child.
        const codeNode = node.node;
        const infoChild = codeNode.getChild("CodeInfo");
        if (!infoChild) return;
        const lang = view.state.doc
          .sliceString(infoChild.from, infoChild.to)
          .trim();
        if (lang !== "mermaid") return;
        // Cursor inside this block? skip.
        if (cursor >= node.from && cursor <= node.to) return;
        const codeBody = codeNode.getChild("CodeText");
        const source = codeBody
          ? view.state.doc.sliceString(codeBody.from, codeBody.to)
          : "";
        builder.add(
          node.from,
          node.to,
          Decoration.replace({
            widget: new MermaidWidget(source),
            block: true,
          }),
        );
      },
    });
  }
  return builder.finish();
}

export function mermaidDecorations(): Extension {
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
