import { describe, it, expect } from "vitest";
import { execSync, spawn } from "node:child_process";
import { existsSync, writeFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";

const BUNDLE = "target/debug/bundle/macos/Markdusk.app";

function markduskProcessCount(): number {
  try {
    const out = execSync("pgrep -f 'markdusk-app' || true", { encoding: "utf-8" });
    return out.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

describe("Sam the Switcher: first-launch", () => {
  it("the app bundle exists at the expected path", () => {
    expect(existsSync(BUNDLE)).toBe(true);
  });

  it("launches and quits cleanly when given a markdown file", async () => {
    // Ensure no stragglers from a previous run.
    execSync("pkill -f 'markdusk-app' 2>/dev/null || true");
    await wait(500);
    expect(markduskProcessCount()).toBe(0);

    const dir = mkdtempSync(join(tmpdir(), "markdusk-persona-"));
    const file = join(dir, "hello.md");
    writeFileSync(file, "# Hello, Sam\n\nthis is markdusk", "utf-8");

    spawn("open", ["-a", "Markdusk", file], { stdio: "ignore", detached: true }).unref();
    await wait(2000);

    expect(markduskProcessCount()).toBeGreaterThanOrEqual(1);

    execSync("osascript -e 'tell application \"Markdusk\" to quit' 2>/dev/null", { stdio: "ignore" });
    await wait(1500);
    execSync("pkill -f 'markdusk-app' 2>/dev/null || true");
    await wait(500);

    expect(markduskProcessCount()).toBe(0);
  }, 15_000);
});
