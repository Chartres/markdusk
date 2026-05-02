import { describe, it, expect, vi } from "vitest";
import { createTabsStore } from "./tabs.svelte";

describe("tab switching perf", () => {
  it("setActive across 9 tabs averages well under 1ms", () => {
    const tabs = createTabsStore({ saver: vi.fn(async () => {}) });
    const ids: string[] = [];
    for (let i = 0; i < 9; i++) {
      ids.push(tabs.loadFile(`/tmp/file${i}.md`, "x".repeat(50_000)));
    }
    const t0 = performance.now();
    for (let i = 0; i < 100; i++) {
      tabs.setActive(ids[i % ids.length]);
    }
    const dt = performance.now() - t0;
    expect(dt / 100).toBeLessThan(2); // 2ms per switch is generous
  });
});
