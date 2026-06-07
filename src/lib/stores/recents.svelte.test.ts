import { describe, it, expect, beforeEach } from "vitest";
import { createRecentsStore } from "./recents.svelte";

beforeEach(() => {
  globalThis.localStorage?.clear();
});

describe("recents", () => {
  it("starts empty", () => {
    const r = createRecentsStore();
    expect(r.list).toEqual([]);
  });

  it("push prepends a new path", () => {
    const r = createRecentsStore();
    r.push("/a.md");
    r.push("/b.md");
    expect(r.list).toEqual(["/b.md", "/a.md"]);
  });

  it("push deduplicates by promoting to front", () => {
    const r = createRecentsStore();
    r.push("/a.md");
    r.push("/b.md");
    r.push("/a.md");
    expect(r.list).toEqual(["/a.md", "/b.md"]);
  });

  it("caps the list at 10", () => {
    const r = createRecentsStore();
    for (let i = 0; i < 15; i++) r.push(`/p${i}.md`);
    expect(r.list.length).toBe(10);
    expect(r.list[0]).toBe("/p14.md");
  });

  it("clear empties the list", () => {
    const r = createRecentsStore();
    r.push("/a.md");
    r.clear();
    expect(r.list).toEqual([]);
  });
});
