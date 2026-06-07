import { describe, it, expect, vi, beforeEach } from "vitest";
import { createDocumentStore } from "./document.svelte";

describe("documentStore", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it("starts as untitled with empty contents", () => {
    const s = createDocumentStore({ saver: vi.fn() });
    expect(s.path).toBeNull();
    expect(s.contents).toBe("");
    expect(s.dirty).toBe(false);
  });

  it("debounces save calls to 800ms after last update", () => {
    const saver = vi.fn().mockResolvedValue(undefined);
    const s = createDocumentStore({ saver });
    s.setPath("/tmp/t.md");
    s.update("a");
    s.update("ab");
    s.update("abc");
    expect(saver).not.toHaveBeenCalled();
    vi.advanceTimersByTime(800);
    expect(saver).toHaveBeenCalledTimes(1);
    expect(saver).toHaveBeenCalledWith("/tmp/t.md", "abc");
  });

  it("flushes immediately on saveNow", async () => {
    const saver = vi.fn().mockResolvedValue(undefined);
    const s = createDocumentStore({ saver });
    s.setPath("/tmp/t.md");
    s.update("hi");
    await s.saveNow();
    expect(saver).toHaveBeenCalledWith("/tmp/t.md", "hi");
  });
});
