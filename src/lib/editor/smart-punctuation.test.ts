import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { markdown } from "@codemirror/lang-markdown";
import { setSmartPunctuation, smartPunctuation } from "./smart-punctuation";

function makeView(initial = "", enabled = true): EditorView {
  const parent = document.createElement("div");
  document.body.appendChild(parent);
  const view = new EditorView({
    parent,
    state: EditorState.create({
      doc: initial,
      selection: { anchor: initial.length },
      extensions: [markdown(), smartPunctuation(enabled)],
    }),
  });
  return view;
}

function type(view: EditorView, text: string) {
  const pos = view.state.selection.main.head;
  view.dispatch({
    changes: { from: pos, to: pos, insert: text },
    selection: { anchor: pos + text.length },
    userEvent: "input.type",
  });
}

describe("smart-punctuation", () => {
  it("turns -- into en-dash", () => {
    const v = makeView("");
    type(v, "-");
    type(v, "-");
    expect(v.state.doc.toString()).toBe("–");
  });

  it("turns --- into em-dash", () => {
    const v = makeView("");
    type(v, "-");
    type(v, "-");
    type(v, "-");
    expect(v.state.doc.toString()).toBe("—");
  });

  it("turns ... into ellipsis", () => {
    const v = makeView("");
    type(v, ".");
    type(v, ".");
    type(v, ".");
    expect(v.state.doc.toString()).toBe("…");
  });

  it("opening straight quote at start becomes opening curly", () => {
    const v = makeView("");
    type(v, '"');
    expect(v.state.doc.toString()).toBe("“");
  });

  it("closing straight quote after word becomes closing curly", () => {
    const v = makeView("hello");
    type(v, '"');
    expect(v.state.doc.toString()).toBe("hello”");
  });

  it("apostrophe inside a word becomes ’", () => {
    const v = makeView("don");
    type(v, "'");
    expect(v.state.doc.toString()).toBe("don’");
  });

  it("does NOT transform inside fenced code blocks", () => {
    const v = makeView("```\n");
    type(v, '"');
    expect(v.state.doc.toString()).toBe('```\n"');
  });

  it("respects the disabled state", () => {
    const v = makeView("");
    setSmartPunctuation(v, false);
    type(v, "-");
    type(v, "-");
    expect(v.state.doc.toString()).toBe("--");
  });
});
