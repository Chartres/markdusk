use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use markdusk_core::document::Document;
use markdusk_core::outline::{OutlineEntry, outline};
use markdusk_core::workspace::{FileNode, list_workspace};
use std::path::PathBuf;

#[tauri::command]
pub async fn list_workspace_cmd(root: String) -> Result<FileNode, String> {
    list_workspace(std::path::Path::new(&root))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn outline_cmd(source: String) -> Vec<OutlineEntry> {
    outline(&source)
}

#[tauri::command]
pub async fn open_file(path: String) -> Result<Document, String> {
    Document::open(PathBuf::from(path))
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_file(path: String, contents: String) -> Result<(), String> {
    let mut doc = Document {
        path: Some(PathBuf::from(path)),
        contents,
        dirty: true,
    };
    doc.save().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_pasted_image(
    doc_path: Option<String>,
    base64_data: String,
    extension: String,
) -> Result<String, String> {
    let bytes = BASE64.decode(&base64_data).map_err(|e| e.to_string())?;
    let parent_dir = match doc_path.as_deref() {
        Some(p) => std::path::Path::new(p)
            .parent()
            .ok_or_else(|| "no parent directory".to_string())?
            .to_path_buf(),
        None => std::env::temp_dir().join("markdusk-images"),
    };
    tokio::fs::create_dir_all(&parent_dir)
        .await
        .map_err(|e| e.to_string())?;
    let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S-%f");
    let filename = format!("paste-{}.{}", stamp, sanitize_ext(&extension));
    let target = parent_dir.join(&filename);
    tokio::fs::write(&target, &bytes)
        .await
        .map_err(|e| e.to_string())?;
    Ok(filename)
}

fn sanitize_ext(s: &str) -> String {
    s.chars()
        .filter(|c| c.is_ascii_alphanumeric())
        .take(8)
        .collect::<String>()
        .to_lowercase()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn open_file_returns_contents() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("hi.md");
        tokio::fs::write(&path, b"# Hi").await.unwrap();
        let doc = open_file(path.to_string_lossy().into_owned())
            .await
            .unwrap();
        assert_eq!(doc.contents, "# Hi");
    }

    #[tokio::test]
    async fn save_file_writes_then_open_reads() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("out.md");
        save_file(path.to_string_lossy().into_owned(), "saved".into())
            .await
            .unwrap();
        let doc = open_file(path.to_string_lossy().into_owned())
            .await
            .unwrap();
        assert_eq!(doc.contents, "saved");
    }

    #[tokio::test]
    async fn save_pasted_image_writes_next_to_doc() {
        use std::path::Path;
        let tmp = TempDir::new().unwrap();
        let doc_path = tmp.path().join("note.md").to_string_lossy().into_owned();
        // 1x1 transparent PNG
        let png_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkAAIAAAUAAeImBZsAAAAASUVORK5CYII=".to_string();
        let filename = save_pasted_image(Some(doc_path.clone()), png_b64, "png".into())
            .await
            .unwrap();
        assert!(filename.starts_with("paste-"));
        assert!(filename.ends_with(".png"));
        let written = Path::new(&doc_path).parent().unwrap().join(&filename);
        assert!(written.exists());
    }
}
