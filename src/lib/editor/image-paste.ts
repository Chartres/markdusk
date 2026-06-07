import { EditorView } from "@codemirror/view";
import { savePastedImage } from "$lib/ipc/commands";

export interface ImagePasteDeps {
  getActiveDocPath: () => string | null;
}

const IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
  "image/heic": "heic",
};

async function blobToBase64(blob: Blob): Promise<string> {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const data = result.split(",", 2)[1] ?? "";
      resolve(data);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function handleFile(view: EditorView, file: File, deps: ImagePasteDeps): Promise<boolean> {
  const ext = IMAGE_TYPES[file.type];
  if (!ext) return false;
  const base64 = await blobToBase64(file);
  const filename = await savePastedImage(deps.getActiveDocPath(), base64, ext);
  view.dispatch({
    changes: {
      from: view.state.selection.main.head,
      insert: `![](${filename})`,
    },
  });
  return true;
}

export function imagePaste(deps: ImagePasteDeps) {
  return EditorView.domEventHandlers({
    paste: (e, view) => {
      const items = e.clipboardData?.items;
      if (!items) return false;
      for (const item of Array.from(items)) {
        if (item.kind !== "file") continue;
        const file = item.getAsFile();
        if (!file) continue;
        if (!IMAGE_TYPES[file.type]) continue;
        e.preventDefault();
        void handleFile(view, file, deps);
        return true;
      }
      return false;
    },
    drop: (e, view) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return false;
      const file = files[0];
      if (!IMAGE_TYPES[file.type]) return false;
      e.preventDefault();
      void handleFile(view, file, deps);
      return true;
    },
  });
}
