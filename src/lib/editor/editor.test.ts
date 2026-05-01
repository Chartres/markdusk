import { describe, it, expect, beforeEach } from "vitest";
import { syntaxTree } from "@codemirror/language";
import { createEditor } from "./editor";

describe("createEditor", () => {
  let parent: HTMLDivElement;

  beforeEach(() => {
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  it("mounts a CodeMirror view with given doc", () => {
    const view = createEditor(parent, "# Hello");
    expect(view.state.doc.toString()).toBe("# Hello");
  });

  it("notifies the onChange callback when contents change", () => {
    const changes: string[] = [];
    const view = createEditor(parent, "", (next) => changes.push(next));
    view.dispatch({ changes: { from: 0, insert: "abc" } });
    expect(changes).toEqual(["abc"]);
  });

  it("does not parse text + dash-line as a Setext heading", () => {
    // CommonMark would interpret "Hello\n-" as a Setext H2.
    // Markdusk disables Setext to avoid the gotcha where typing the first
    // character of a list reflows the previous paragraph as a heading.
    const view = createEditor(parent, "Hello\n-\nworld");
    const found: string[] = [];
    syntaxTree(view.state).iterate({
      enter: (node) => {
        found.push(node.name);
      },
    });
    expect(found).not.toContain("SetextHeading1");
    expect(found).not.toContain("SetextHeading2");
  });

  it("still parses ATX headings", () => {
    const view = createEditor(parent, "# Hello");
    const found: string[] = [];
    syntaxTree(view.state).iterate({
      enter: (node) => {
        found.push(node.name);
      },
    });
    expect(found).toContain("ATXHeading1");
  });

  it("parses GFM tables", () => {
    const view = createEditor(parent, "| a | b |\n|---|---|\n| 1 | 2 |");
    const found: string[] = [];
    syntaxTree(view.state).iterate({
      enter: (node) => {
        found.push(node.name);
      },
    });
    expect(found).toContain("Table");
  });

  it("does not leave $...$ visible on an inactive math line", () => {
    // Cursor on line 2; line 1 has inline math $E=mc^2$ — math should be replaced.
    const view = createEditor(parent, "$E=mc^2$\nbody");
    view.dispatch({ selection: { anchor: view.state.doc.length } }); // move cursor to end
    // After dispatch, the math line is inactive. Querying .cm-line[0]'s rendered text:
    const lines = view.dom.querySelectorAll(".cm-line");
    // First line should not include the literal '$' chars (they're replaced by the widget)
    expect(lines[0]?.textContent ?? "").not.toContain("$");
  });
});
