use base64::{Engine, engine::general_purpose::STANDARD as BASE64};
use markdusk_core::document::Document;
use markdusk_core::export::{HtmlTheme, render_html};
use markdusk_core::outline::{OutlineEntry, outline};
use markdusk_core::workspace::{FileNode, list_workspace};
use std::path::PathBuf;

fn parse_theme(theme: &str) -> HtmlTheme {
    match theme {
        "amber" => HtmlTheme::Amber,
        _ => HtmlTheme::Smoke,
    }
}

#[tauri::command]
pub async fn export_html(target_path: String, source: String, theme: String) -> Result<(), String> {
    let html = render_html(&source, parse_theme(&theme));
    tokio::fs::write(target_path, html.as_bytes())
        .await
        .map_err(|e| e.to_string())
}

/// Export the current document as DOCX via the `pandoc` sidecar.
/// Returns an error string the frontend can surface; the frontend handles
/// the "pandoc not installed" case by suggesting `brew install pandoc`.
#[tauri::command]
pub async fn export_docx(target_path: String, source: String) -> Result<(), String> {
    // Look for pandoc on PATH or in common Homebrew locations.
    let pandoc_bin = which::which("pandoc")
        .ok()
        .or_else(|| {
            ["/opt/homebrew/bin/pandoc", "/usr/local/bin/pandoc"]
                .iter()
                .map(std::path::PathBuf::from)
                .find(|p| p.exists())
        })
        .ok_or_else(|| "pandoc not found — install with: brew install pandoc".to_string())?;

    use tokio::io::AsyncWriteExt;
    let mut child = tokio::process::Command::new(&pandoc_bin)
        .args([
            "--from=gfm",
            "--to=docx",
            "--standalone",
            "-o",
            &target_path,
        ])
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .stderr(std::process::Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn pandoc failed: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        stdin
            .write_all(source.as_bytes())
            .await
            .map_err(|e| format!("write to pandoc stdin failed: {e}"))?;
    }
    let output = child
        .wait_with_output()
        .await
        .map_err(|e| format!("pandoc wait failed: {e}"))?;
    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(format!("pandoc exited {}: {}", output.status, stderr));
    }
    Ok(())
}

#[tauri::command]
pub fn render_html_for_clipboard(source: String, theme: String) -> String {
    render_html(&source, parse_theme(&theme))
}

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
    async fn export_html_writes_file() {
        let tmp = TempDir::new().unwrap();
        let p = tmp.path().join("out.html");
        export_html(
            p.to_string_lossy().into_owned(),
            "# x".into(),
            "smoke".into(),
        )
        .await
        .unwrap();
        let read = tokio::fs::read_to_string(&p).await.unwrap();
        assert!(read.contains("<h1>x</h1>"));
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
