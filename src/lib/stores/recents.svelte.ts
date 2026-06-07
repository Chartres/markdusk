const STORAGE_KEY = "markdusk.recents.v1";
const MAX = 10;

export interface RecentsStore {
  readonly list: string[];
  push(path: string): void;
  remove(path: string): void;
  clear(): void;
}

function loadInitial(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((p): p is string => typeof p === "string").slice(0, MAX);
  } catch {
    return [];
  }
}

function persist(items: string[]): void {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage may be unavailable in headless/test contexts — silently skip.
  }
}

export function createRecentsStore(): RecentsStore {
  let items = $state<string[]>(loadInitial());

  return {
    get list() {
      return items;
    },
    push(path: string) {
      const filtered = items.filter((p) => p !== path);
      items = [path, ...filtered].slice(0, MAX);
      persist(items);
    },
    remove(path: string) {
      items = items.filter((p) => p !== path);
      persist(items);
    },
    clear() {
      items = [];
      persist(items);
    },
  };
}
