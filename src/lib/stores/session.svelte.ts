const STORAGE_KEY = "markdusk.session.v1";

interface PersistedSession {
  paths: string[];
  activePath: string | null;
}

export function loadSession(): PersistedSession {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return { paths: [], activePath: null };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return { paths: [], activePath: null };
    const paths = Array.isArray(parsed.paths)
      ? parsed.paths.filter((p: unknown): p is string => typeof p === "string")
      : [];
    const activePath = typeof parsed.activePath === "string" ? parsed.activePath : null;
    return { paths, activePath };
  } catch {
    return { paths: [], activePath: null };
  }
}

export function saveSession(paths: string[], activePath: string | null): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify({ paths, activePath }));
  } catch {
    // ignore
  }
}
