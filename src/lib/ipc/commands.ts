import { invoke } from "@tauri-apps/api/core";
import type { Document, FileNode, OutlineEntry } from "./types.gen";

export async function openFile(path: string): Promise<Document> {
  return await invoke<Document>("open_file", { path });
}

export async function saveFile(path: string, contents: string): Promise<void> {
  await invoke<void>("save_file", { path, contents });
}

export async function listWorkspace(root: string): Promise<FileNode> {
  return await invoke<FileNode>("list_workspace_cmd", { root });
}

export async function outlineFor(source: string): Promise<OutlineEntry[]> {
  return await invoke<OutlineEntry[]>("outline_cmd", { source });
}

export async function savePastedImage(
  docPath: string | null,
  base64Data: string,
  extension: string,
): Promise<string> {
  return await invoke<string>("save_pasted_image", { docPath, base64Data, extension });
}

export async function exportHtml(
  targetPath: string,
  source: string,
  theme: "smoke" | "amber",
): Promise<void> {
  await invoke<void>("export_html", { targetPath, source, theme });
}

export async function exportDocx(targetPath: string, source: string): Promise<void> {
  await invoke<void>("export_docx", { targetPath, source });
}

export async function renderHtmlForClipboard(
  source: string,
  theme: "smoke" | "amber",
): Promise<string> {
  return await invoke<string>("render_html_for_clipboard", { source, theme });
}
