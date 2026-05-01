use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;
use ts_rs::TS;

#[derive(Debug, Error)]
pub enum DocumentError {
    #[error("file not found: {0}")]
    NotFound(PathBuf),
    #[error("permission denied: {0}")]
    PermissionDenied(PathBuf),
    #[error("file too large: {size} bytes (max {max})")]
    TooLarge { size: u64, max: u64 },
    #[error("invalid UTF-8")]
    InvalidUtf8,
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
}

const MAX_FILE_BYTES: u64 = 50 * 1024 * 1024; // 50 MB hard limit per spec

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
pub struct Document {
    pub path: Option<PathBuf>,
    pub contents: String,
    pub dirty: bool,
}

impl Document {
    pub fn untitled() -> Self {
        Self {
            path: None,
            contents: String::new(),
            dirty: false,
        }
    }

    pub async fn open(path: impl AsRef<Path>) -> Result<Self, DocumentError> {
        let path = path.as_ref().to_path_buf();
        let metadata = tokio::fs::metadata(&path)
            .await
            .map_err(|e| match e.kind() {
                std::io::ErrorKind::NotFound => DocumentError::NotFound(path.clone()),
                std::io::ErrorKind::PermissionDenied => {
                    DocumentError::PermissionDenied(path.clone())
                }
                _ => DocumentError::Io(e),
            })?;
        if metadata.len() > MAX_FILE_BYTES {
            return Err(DocumentError::TooLarge {
                size: metadata.len(),
                max: MAX_FILE_BYTES,
            });
        }
        let bytes = tokio::fs::read(&path).await?;
        let contents = String::from_utf8(bytes).map_err(|_| DocumentError::InvalidUtf8)?;
        Ok(Self {
            path: Some(path),
            contents,
            dirty: false,
        })
    }

    pub async fn save(&mut self) -> Result<(), DocumentError> {
        let path = self
            .path
            .clone()
            .ok_or_else(|| DocumentError::NotFound(PathBuf::from("<untitled>")))?;
        let tmp = path.with_extension(format!(
            "{}.markdusk.tmp",
            path.extension().and_then(|s| s.to_str()).unwrap_or("md")
        ));
        tokio::fs::write(&tmp, self.contents.as_bytes()).await?;
        tokio::fs::rename(&tmp, &path).await?;
        self.dirty = false;
        Ok(())
    }

    pub fn update(&mut self, new_contents: String) {
        if new_contents != self.contents {
            self.contents = new_contents;
            self.dirty = true;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn untitled_doc_starts_empty_and_clean() {
        let doc = Document::untitled();
        assert!(doc.path.is_none());
        assert_eq!(doc.contents, "");
        assert!(!doc.dirty);
    }

    #[tokio::test]
    async fn open_reads_file_contents() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("hello.md");
        tokio::fs::write(&path, b"# Hi\n\nworld").await.unwrap();
        let doc = Document::open(&path).await.unwrap();
        assert_eq!(doc.contents, "# Hi\n\nworld");
        assert_eq!(doc.path.as_deref(), Some(path.as_path()));
        assert!(!doc.dirty);
    }

    #[tokio::test]
    async fn open_returns_not_found_for_missing_file() {
        let result = Document::open("/nonexistent/path.md").await;
        assert!(matches!(result, Err(DocumentError::NotFound(_))));
    }

    #[tokio::test]
    async fn update_marks_dirty_when_contents_change() {
        let mut doc = Document::untitled();
        doc.update("hello".into());
        assert!(doc.dirty);
        assert_eq!(doc.contents, "hello");
    }

    #[tokio::test]
    async fn update_with_same_contents_leaves_clean() {
        let mut doc = Document::untitled();
        doc.update("".into());
        assert!(!doc.dirty);
    }

    #[tokio::test]
    async fn save_writes_file_and_clears_dirty() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("out.md");
        let mut doc = Document {
            path: Some(path.clone()),
            contents: "saved".into(),
            dirty: true,
        };
        doc.save().await.unwrap();
        let bytes = tokio::fs::read(&path).await.unwrap();
        assert_eq!(bytes, b"saved");
        assert!(!doc.dirty);
    }

    #[tokio::test]
    async fn save_uses_atomic_rename_no_tmp_left_behind() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("out.md");
        let mut doc = Document {
            path: Some(path.clone()),
            contents: "x".into(),
            dirty: true,
        };
        doc.save().await.unwrap();
        let mut entries = tokio::fs::read_dir(tmp.path()).await.unwrap();
        let mut count = 0;
        while entries.next_entry().await.unwrap().is_some() {
            count += 1;
        }
        assert_eq!(count, 1, "only the final file should exist, no .tmp left");
    }
}
