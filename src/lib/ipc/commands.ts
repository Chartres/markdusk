import { invoke } from "@tauri-apps/api/core";
import type { Document } from "./types.gen";

export async function openFile(path: string): Promise<Document> {
  return await invoke<Document>("open_file", { path });
}

export async function saveFile(path: string, contents: string): Promise<void> {
  await invoke<void>("save_file", { path, contents });
}
