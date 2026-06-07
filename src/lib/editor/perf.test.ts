import { describe, it, expect, beforeEach } from "vitest";
import { createEditor } from "./editor";

describe("editor perf", () => {
  let parent: HTMLDivElement;
  beforeEach(() => {
    parent = document.createElement("div");
    document.body.appendChild(parent);
  });

  it("handles 200 keystrokes on a 100KB doc within budget", () => {
    const seed = "para\n\n".repeat(20_000); // ~120KB
    const view = createEditor(parent, seed);
    const samples: number[] = [];
    let pos = 0;
    for (let i = 0; i < 200; i++) {
      const t0 = performance.now();
      view.dispatch({ changes: { from: pos, insert: "x" } });
      samples.push(performance.now() - t0);
      pos += 1;
    }
    samples.sort((a, b) => a - b);
    const p95 = samples[Math.floor(samples.length * 0.95)];
    // jsdom is slower than real WebKit; budget is generous.
    expect(p95).toBeLessThan(40);
  });
});
