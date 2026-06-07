import { outlineFor } from "$lib/ipc/commands";
import type { OutlineEntry } from "$lib/ipc/types.gen";

export interface OutlineStore {
  readonly entries: OutlineEntry[];
  refresh(source: string): Promise<void>;
}

export function createOutlineStore(): OutlineStore {
  let entries = $state<OutlineEntry[]>([]);

  return {
    get entries() {
      return entries;
    },
    async refresh(source) {
      const next = await outlineFor(source);
      entries = next;
    },
  };
}
