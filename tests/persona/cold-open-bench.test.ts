import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import {
  bundleInstalled,
  markduskProcessCount,
  quitMarkdusk,
} from "./helpers";

/**
 * Cold-open benchmark — measures wall-clock from `open` returning until the
 * AX-visible window count reaches ≥ 1. Not a microbenchmark; just enough to
 * gate the principle "open in under a second" from the personas doc.
 *
 * Target: < 1500ms on the owner's mini (M-class Apple Silicon, release build).
 * Stretch (M1 roadmap): < 1000ms.
 *
 * If real-world numbers regress past 1500ms, this test fails and we
 * investigate before shipping.
 */

const TARGET_MS = 1500;

function nowMs(): number {
  const [s, n] = process.hrtime();
  return s * 1000 + n / 1e6;
}

describe("Cold-open performance budget", () => {
  it("the bundle is installed", () => {
    expect(bundleInstalled()).toBe(true);
  });

  it("launches and shows a window within the budget", async () => {
    await quitMarkdusk();
    await wait(800);
    expect(markduskProcessCount()).toBe(0);

    const dir = mkdtempSync(join(tmpdir(), "markdusk-bench-"));
    const file = join(dir, "bench.md");
    writeFileSync(file, "# Bench\n\nMarkdown content for cold-open timing.\n", "utf-8");

    const t0 = nowMs();
    execSync(`open -a Markdusk ${JSON.stringify(file)}`);

    let windowCount = 0;
    const deadline = t0 + 10_000;
    while (nowMs() < deadline) {
      try {
        const out = execSync(
          `osascript -e 'tell application "System Events" to tell process "Markdusk" to count windows' 2>/dev/null`,
          { encoding: "utf-8" },
        ).trim();
        windowCount = parseInt(out, 10) || 0;
        if (windowCount >= 1) break;
      } catch {
        // Process not yet known to System Events — keep polling.
      }
      await wait(50);
    }
    const elapsed = nowMs() - t0;

    console.log(`[cold-open] window appeared after ${elapsed.toFixed(0)}ms`);
    expect(windowCount).toBeGreaterThanOrEqual(1);
    expect(elapsed).toBeLessThan(TARGET_MS);

    await quitMarkdusk();
  }, 30_000);
});
