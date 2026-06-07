import { describe, it, expect, vi } from "vitest";
import { createTabsStore } from "./tabs.svelte";

const noopSaver = vi.fn(async () => {});

describe("tabsStore", () => {
  it("starts with one untitled tab as active", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    expect(tabs.list.length).toBe(1);
    expect(tabs.activeId).toBe(tabs.list[0].id);
    expect(tabs.active.path).toBeNull();
  });

  it("opens a new tab and makes it active", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    const id = tabs.openNew();
    expect(tabs.list.length).toBe(2);
    expect(tabs.activeId).toBe(id);
  });

  it("closing the last tab leaves one untitled tab", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    tabs.close(tabs.activeId);
    expect(tabs.list.length).toBe(1);
    expect(tabs.active.path).toBeNull();
  });

  it("loadFile reuses an open tab if the path matches", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    tabs.loadFile("/tmp/a.md", "alpha");
    const idA = tabs.activeId;
    tabs.openNew();
    tabs.loadFile("/tmp/b.md", "beta");
    tabs.loadFile("/tmp/a.md", "alpha-again");
    expect(tabs.activeId).toBe(idA);
    expect(tabs.list.length).toBe(2);
  });

  it("update marks the active tab dirty", () => {
    const tabs = createTabsStore({ saver: noopSaver });
    tabs.loadFile("/tmp/x.md", "");
    tabs.update("hi");
    expect(tabs.active.dirty).toBe(true);
    expect(tabs.active.contents).toBe("hi");
  });
});
