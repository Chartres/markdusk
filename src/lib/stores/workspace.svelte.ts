import { listWorkspace } from "$lib/ipc/commands";
import type { FileNode } from "$lib/ipc/types.gen";

export interface WorkspaceStore {
  readonly root: FileNode | null;
  open(path: string): Promise<void>;
  refresh(): Promise<void>;
  clear(): void;
}

export function createWorkspaceStore(): WorkspaceStore {
  let root = $state<FileNode | null>(null);
  let rootPath: string | null = null;

  return {
    get root() {
      return root;
    },
    async open(path) {
      rootPath = path;
      root = await listWorkspace(path);
    },
    async refresh() {
      if (rootPath) root = await listWorkspace(rootPath);
    },
    clear() {
      root = null;
      rootPath = null;
    },
  };
}
