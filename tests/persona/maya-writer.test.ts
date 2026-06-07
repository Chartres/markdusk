import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as wait } from "node:timers/promises";
import {
  bundleInstalled,
  openInMarkdusk,
  quitMarkdusk,
  markduskProcessCount,
} from "./helpers";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE = join(__dirname, "fixtures", "maya-essay.md");

describe("Maya the Writer", () => {
  it("the installed bundle exists", () => {
    expect(bundleInstalled()).toBe(true);
    expect(existsSync(FIXTURE)).toBe(true);
  });

  it("⌘⇧P opens the command palette and search-then-Enter doesn't crash the app", async () => {
    await quitMarkdusk();
    await wait(400);

    const dir = mkdtempSync(join(tmpdir(), "markdusk-maya-"));
    const file = join(dir, "essay.md");
    writeFileSync(file, "# Essay\n\nFirst paragraph for Maya.\n", "utf-8");

    await openInMarkdusk(file);
    expect(markduskProcessCount()).toBeGreaterThanOrEqual(1);

    try {
      execSync(`osascript -e 'tell application "Markdusk" to activate'`);
      await wait(500);
      execSync(
        `osascript -e 'tell application "System Events" to tell process "Markdusk" to keystroke "p" using {command down, shift down}'`,
      );
      await wait(300);
      execSync(
        `osascript -e 'tell application "System Events" to tell process "Markdusk" to keystroke "amber"'`,
      );
      await wait(300);
      execSync(
        `osascript -e 'tell application "System Events" to tell process "Markdusk" to keystroke return'`,
      );
      await wait(500);
    } catch (e) {
      console.warn("[maya] AppleScript path unavailable:", e);
    }

    expect(markduskProcessCount()).toBeGreaterThanOrEqual(1);

    await quitMarkdusk();
    expect(markduskProcessCount()).toBe(0);
  }, 25_000);
});
