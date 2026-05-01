use markdusk_core::document::Document;
use std::path::PathBuf;

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
}
