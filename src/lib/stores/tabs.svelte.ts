type Saver = (path: string, contents: string) => Promise<void>;

export interface Tab {
  id: string;
  path: string | null;
  contents: string;
  dirty: boolean;
}

export interface TabsStore {
  readonly list: Tab[];
  readonly activeId: string;
  readonly active: Tab;
  openNew(): string;
  loadFile(path: string, contents: string): string;
  setActive(id: string): void;
  close(id: string): void;
  update(next: string): void;
  saveActiveNow(): Promise<void>;
}

interface Deps {
  saver: Saver;
  debounceMs?: number;
}

let nextId = 1;
const newId = () => `tab-${nextId++}`;

export function createTabsStore(deps: Deps): TabsStore {
  const debounceMs = deps.debounceMs ?? 800;
  const initial: Tab = { id: newId(), path: null, contents: "", dirty: false };
  let list = $state<Tab[]>([initial]);
  let activeId = $state(initial.id);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const indexOf = (id: string) => list.findIndex((t) => t.id === id);

  const flush = async (id: string) => {
    const t = timers.get(id);
    if (t) {
      clearTimeout(t);
      timers.delete(id);
    }
    const i = indexOf(id);
    if (i < 0) return;
    const tab = list[i];
    if (!tab.path || !tab.dirty) return;
    await deps.saver(tab.path, tab.contents);
    list[i] = { ...tab, dirty: false };
  };

  const scheduleFlush = (id: string) => {
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    timers.set(
      id,
      setTimeout(() => {
        void flush(id);
      }, debounceMs),
    );
  };

  return {
    get list() {
      return list;
    },
    get activeId() {
      return activeId;
    },
    get active() {
      return list[indexOf(activeId)] ?? list[0];
    },
    openNew() {
      const tab: Tab = { id: newId(), path: null, contents: "", dirty: false };
      list = [...list, tab];
      activeId = tab.id;
      return tab.id;
    },
    loadFile(path, contents) {
      const existing = list.findIndex((t) => t.path === path);
      if (existing >= 0) {
        list[existing] = { ...list[existing], contents, dirty: false };
        activeId = list[existing].id;
        return list[existing].id;
      }
      const tab: Tab = { id: newId(), path, contents, dirty: false };
      const activeIdx = indexOf(activeId);
      const activeTab = activeIdx >= 0 ? list[activeIdx] : null;
      if (
        activeTab &&
        activeTab.path === null &&
        activeTab.contents === "" &&
        !activeTab.dirty
      ) {
        list = list.map((t, i) => (i === activeIdx ? tab : t));
      } else {
        list = [...list, tab];
      }
      activeId = tab.id;
      return tab.id;
    },
    setActive(id) {
      if (indexOf(id) >= 0) activeId = id;
    },
    close(id) {
      const i = indexOf(id);
      if (i < 0) return;
      list = list.filter((t) => t.id !== id);
      const existingTimer = timers.get(id);
      if (existingTimer) clearTimeout(existingTimer);
      timers.delete(id);
      if (list.length === 0) {
        list = [{ id: newId(), path: null, contents: "", dirty: false }];
      }
      if (activeId === id) {
        activeId = list[Math.min(i, list.length - 1)].id;
      }
    },
    update(next) {
      const i = indexOf(activeId);
      if (i < 0) return;
      const tab = list[i];
      if (next === tab.contents) return;
      list[i] = { ...tab, contents: next, dirty: true };
      scheduleFlush(tab.id);
    },
    saveActiveNow() {
      return flush(activeId);
    },
  };
}
