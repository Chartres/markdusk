import { describe, it, expect, beforeEach } from "vitest";
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
});
