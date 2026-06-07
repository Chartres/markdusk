import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as wait } from "node:timers/promises";
import {
  BUNDLE,
  bundleInstalled,
  markduskProcessCount,
  openInMarkdusk,
  quitMarkdusk,
  readEditorContent,
} from "./helpers";

describe("Sam the Switcher: first-launch", () => {
  it("the installed bundle exists at /Applications/Markdusk.app", () => {
    expect(bundleInstalled()).toBe(true);
    expect(BUNDLE).toBe("/Applications/Markdusk.app");
  });

  it("opens a markdown file and the editor surface shows its contents (JTBD: 'I double-clicked an .md — show me what's in it')", async () => {
    await quitMarkdusk();
    await wait(400);
    expect(markduskProcessCount()).toBe(0);

    const dir = mkdtempSync(join(tmpdir(), "markdusk-persona-"));
    const file = join(dir, "hello.md");
    const sentinel = "# Hello, Sam\n\nthis is markdusk and it must show up";
    writeFileSync(file, sentinel, "utf-8");

    await openInMarkdusk(file);
    expect(markduskProcessCount()).toBeGreaterThanOrEqual(1);

    const editorText = await readEditorContent();
    if (editorText === null) {
      console.warn("[sam] skipping content assertion — cliclick or AX perms unavailable");
    } else {
      // Trim a trailing newline that copy operations frequently add.
      expect(editorText.trim()).toBe(sentinel.trim());
    }

    await quitMarkdusk();
    expect(markduskProcessCount()).toBe(0);
  }, 25_000);
});
