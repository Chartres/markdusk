import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { setTimeout as wait } from "node:timers/promises";

export const BUNDLE = "/Applications/Markdusk.app";

export function markduskProcessCount(): number {
  try {
    const out = execSync("pgrep -f 'markdusk-app' || true", { encoding: "utf-8" });
    return out.trim().split("\n").filter(Boolean).length;
  } catch {
    return 0;
  }
}

export async function quitMarkdusk(): Promise<void> {
  execSync("osascript -e 'tell application \"Markdusk\" to quit' 2>/dev/null", { stdio: "ignore" });
  await wait(800);
  execSync("pkill -f 'markdusk-app' 2>/dev/null || true");
  await wait(300);
}

export async function openInMarkdusk(file: string): Promise<void> {
  execSync(`open -a Markdusk ${JSON.stringify(file)}`);
  await wait(2200);
}

function hasCliclick(): boolean {
  try {
    execSync("command -v cliclick", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

/**
 * Reads the rendered editor text by activating Markdusk, clicking the editor,
 * Cmd-A + Cmd-C, and returning the clipboard. Requires `cliclick` (Homebrew)
 * and Accessibility permission for the test runner.
 *
 * Returns null on systems where the tooling isn't available, so individual
 * tests can skip rather than fail.
 */
export async function readEditorContent(): Promise<string | null> {
  if (!hasCliclick()) return null;

  // Marker so we can tell apart "copy produced empty" from "copy didn't run".
  execSync('echo "__MARKDUSK_MARKER__" | pbcopy');
  await wait(200);

  execSync('osascript -e \'tell application "Markdusk" to activate\'');
  await wait(700);

  // Find the front window's bounds and click roughly center to focus the editor.
  let bounds: { x: number; y: number; w: number; h: number };
  try {
    const raw = execSync(
      `osascript -e 'tell application "System Events" to tell process "Markdusk" to return (position of window 1) & (size of window 1)'`,
      { encoding: "utf-8" },
    ).trim();
    const parts = raw.split(",").map((s) => parseInt(s.trim(), 10));
    bounds = { x: parts[0], y: parts[1], w: parts[2], h: parts[3] };
  } catch {
    return null;
  }
  const cx = Math.round(bounds.x + bounds.w / 2);
  const cy = Math.round(bounds.y + bounds.h / 2);
  execSync(`cliclick c:${cx},${cy}`);
  await wait(300);

  execSync(
    `osascript -e 'tell application "System Events" to tell process "Markdusk" to keystroke "a" using {command down}'`,
  );
  await wait(250);
  execSync(
    `osascript -e 'tell application "System Events" to tell process "Markdusk" to keystroke "c" using {command down}'`,
  );
  await wait(500);

  const clip = execSync("pbpaste", { encoding: "utf-8" });
  if (clip === "__MARKDUSK_MARKER__\n" || clip === "__MARKDUSK_MARKER__") {
    // Copy didn't fire (no focus, no AX perms, etc.)
    return null;
  }
  return clip;
}

export function bundleInstalled(): boolean {
  return existsSync(BUNDLE);
}
