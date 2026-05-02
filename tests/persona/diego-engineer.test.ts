import { describe, it, expect } from "vitest";
import { execSync, spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = "target/debug/bundle/macos/Markdusk.app";
const FIXTURE = join(__dirname, "fixtures", "diego-readme.md");

function processCount(): number {
  try {
    const out = execSync("pgrep -f 'markdusk-app' || true", { encoding: "utf-8" });
    return out.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

describe("Diego the Engineer: launch-smoke", () => {
  it("opens his README fixture and the app launches cleanly", async () => {
    expect(existsSync(BUNDLE)).toBe(true);
    expect(existsSync(FIXTURE)).toBe(true);
    expect(readFileSync(FIXTURE, "utf-8")).toContain("# ");
    execSync("pkill -f 'markdusk-app' 2>/dev/null || true");
    await wait(500);
    expect(processCount()).toBe(0);
    spawn("open", ["-a", "Markdusk", FIXTURE], { stdio: "ignore", detached: true }).unref();
    await wait(2500);
    expect(processCount()).toBeGreaterThanOrEqual(1);
    execSync("osascript -e 'tell application \"Markdusk\" to quit' 2>/dev/null", { stdio: "ignore" });
    await wait(1500);
    execSync("pkill -f 'markdusk-app' 2>/dev/null || true");
  }, 15_000);
});
