export interface DocumentStore {
  readonly path: string | null;
  readonly contents: string;
  readonly dirty: boolean;
  setPath(path: string | null): void;
  loadInitial(path: string | null, contents: string): void;
  update(next: string): void;
  saveNow(): Promise<void>;
}

interface Deps {
  saver: (path: string, contents: string) => Promise<void>;
  debounceMs?: number;
}

export function createDocumentStore(deps: Deps): DocumentStore {
  let path = $state<string | null>(null);
  let contents = $state("");
  let dirty = $state(false);
  let timer: ReturnType<typeof setTimeout> | null = null;
  const debounceMs = deps.debounceMs ?? 800;

  const flush = async () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (!path || !dirty) return;
    await deps.saver(path, contents);
    dirty = false;
  };

  return {
    get path() {
      return path;
    },
    get contents() {
      return contents;
    },
    get dirty() {
      return dirty;
    },
    setPath(p) {
      path = p;
    },
    loadInitial(p, c) {
      path = p;
      contents = c;
      dirty = false;
    },
    update(next) {
      if (next === contents) return;
      contents = next;
      dirty = true;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        void flush();
      }, debounceMs);
    },
    saveNow: flush,
  };
}
