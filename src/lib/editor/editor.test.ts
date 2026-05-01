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
});
