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

describe("livePreview decoration", () => {
  it("hides heading marker on inactive line", () => {
    // Cursor in body, line 3 — heading on line 1 should have its marker hidden
    const view = makeView("# Hello\n\nbody", 9);
    const hidden = view.dom.querySelectorAll(".cm-md-hidden-mark");
    expect(hidden.length).toBeGreaterThan(0);
  });

  it("shows heading marker on active line", () => {
    // Cursor on line 1 (heading) — active-line class should be present
    const view = makeView("# Hello\n\nbody", 2);
    const headingLine = view.dom.querySelector(".cm-line.cm-md-active");
    expect(headingLine).not.toBeNull();
  });
});
