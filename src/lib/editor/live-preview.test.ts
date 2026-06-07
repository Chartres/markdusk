import { describe, it, expect } from "vitest";
import { EditorView } from "@codemirror/view";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { livePreview } from "./live-preview";

function makeView(doc: string, cursorPos = 0): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  return new EditorView({
    parent,
    state: EditorState.create({
      doc,
      selection: { anchor: cursorPos },
      extensions: [markdown(), livePreview()],
    }),
  });
}

function lineText(view: EditorView, lineNumber: number): string {
  // CodeMirror renders line elements in document order; index is 0-based.
  const lines = view.dom.querySelectorAll(".cm-line");
  return lines[lineNumber - 1]?.textContent ?? "";
}

describe("livePreview decoration", () => {
  it("hides the '# ' marker on an inactive heading line", () => {
    // Cursor on line 3 (body). Line 1 ('# Hello') is inactive — its '# '
    // marker should be replaced (atomic, invisible) so the rendered line
    // shows just 'Hello'.
    const view = makeView("# Hello\n\nbody", 9);
    expect(lineText(view, 1)).toBe("Hello");
  });

  it("shows the '# ' marker on the active heading line", () => {
    // Cursor on line 1 (heading). Marker should be visible for editing.
    const view = makeView("# Hello\n\nbody", 2);
    expect(lineText(view, 1)).toBe("# Hello");
  });

  it("marks the active line with the cm-md-active class", () => {
    const view = makeView("# Hello\n\nbody", 2);
    const headingLine = view.dom.querySelector(".cm-line.cm-md-active");
    expect(headingLine).not.toBeNull();
  });

  it("hides bold markers ** on an inactive line", () => {
    // Cursor on line 2; line 1 has '**bold**' — the asterisks should be hidden.
    const view = makeView("**bold**\nother", 9);
    expect(lineText(view, 1)).toBe("bold");
  });

  it("keeps fenced-code ``` delimiters visible on inactive lines", () => {
    // The opening and closing fence must remain visible even when the cursor
    // is far from them — otherwise the user can't see where the block ends.
    const doc = "```rust\nfn main() {}\n```\nafter";
    // Cursor at end ("after" line) — both fence lines are inactive.
    const view = makeView(doc, doc.length);
    expect(lineText(view, 1)).toBe("```rust");
    expect(lineText(view, 3)).toBe("```");
  });

  it("hides inline `code` backticks on an inactive line", () => {
    // Cursor on line 2; line 1 inline code backticks should be hidden.
    const view = makeView("`x`\nbody", 5);
    expect(lineText(view, 1)).toBe("x");
  });
});
