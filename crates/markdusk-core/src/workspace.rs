use serde::{Deserialize, Serialize};
use std::future::Future;
use std::path::{Path, PathBuf};
use std::pin::Pin;
use ts_rs::TS;

#[derive(Debug, Clone, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
pub struct FileNode {
    pub name: String,
    pub path: PathBuf,
    pub is_dir: bool,
    pub children: Vec<FileNode>,
}

const MAX_DEPTH: usize = 8;
const MAX_ENTRIES_PER_DIR: usize = 500;

pub async fn list_workspace(root: &Path) -> std::io::Result<FileNode> {
    walk(root, 0).await
}

fn walk(
    path: &Path,
    depth: usize,
) -> Pin<Box<dyn Future<Output = std::io::Result<FileNode>> + Send + '_>> {
    Box::pin(async move {
        let metadata = tokio::fs::metadata(path).await?;
        let name = path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| path.to_string_lossy().into_owned());

        if !metadata.is_dir() {
            return Ok(FileNode {
                name,
                path: path.to_path_buf(),
                is_dir: false,
                children: vec![],
            });
        }

        let mut children = Vec::new();
        if depth < MAX_DEPTH {
            let mut entries = tokio::fs::read_dir(path).await?;
            let mut count = 0;
            while let Some(entry) = entries.next_entry().await? {
                if count >= MAX_ENTRIES_PER_DIR {
                    break;
                }
                count += 1;
                let entry_path = entry.path();
                let file_name = entry.file_name().to_string_lossy().into_owned();
                if file_name.starts_with('.')
                    || file_name == "node_modules"
                    || file_name == "target"
                    || file_name == "dist"
                {
                    continue;
                }
                let entry_metadata = entry.metadata().await?;
                if entry_metadata.is_dir() {
                    children.push(walk(&entry_path, depth + 1).await?);
                } else {
                    let lower = file_name.to_lowercase();
                    if lower.ends_with(".md")
                        || lower.ends_with(".markdown")
                        || lower.ends_with(".mdown")
                    {
                        children.push(FileNode {
                            name: file_name,
                            path: entry_path,
                            is_dir: false,
                            children: vec![],
                        });
                    }
                }
            }
            children.sort_by(|a, b| match (a.is_dir, b.is_dir) {
                (true, false) => std::cmp::Ordering::Less,
                (false, true) => std::cmp::Ordering::Greater,
                _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
            });
        }

        Ok(FileNode {
            name,
            path: path.to_path_buf(),
            is_dir: true,
            children,
        })
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn lists_markdown_files_only() {
        let tmp = TempDir::new().unwrap();
        tokio::fs::write(tmp.path().join("a.md"), "x")
            .await
            .unwrap();
        tokio::fs::write(tmp.path().join("b.txt"), "y")
            .await
            .unwrap();
        tokio::fs::write(tmp.path().join("c.markdown"), "z")
            .await
            .unwrap();
        let tree = list_workspace(tmp.path()).await.unwrap();
        assert!(tree.is_dir);
        assert_eq!(tree.children.len(), 2);
        let names: Vec<_> = tree.children.iter().map(|c| c.name.clone()).collect();
        assert!(names.contains(&"a.md".to_string()));
        assert!(names.contains(&"c.markdown".to_string()));
    }

    #[tokio::test]
    async fn recurses_into_subdirs() {
        let tmp = TempDir::new().unwrap();
        tokio::fs::create_dir(tmp.path().join("nested"))
            .await
            .unwrap();
        tokio::fs::write(tmp.path().join("nested").join("a.md"), "x")
            .await
            .unwrap();
        let tree = list_workspace(tmp.path()).await.unwrap();
        assert_eq!(tree.children.len(), 1);
        assert!(tree.children[0].is_dir);
        assert_eq!(tree.children[0].children.len(), 1);
        assert_eq!(tree.children[0].children[0].name, "a.md");
    }

    #[tokio::test]
    async fn dirs_sort_before_files() {
        let tmp = TempDir::new().unwrap();
        tokio::fs::write(tmp.path().join("a.md"), "x")
            .await
            .unwrap();
        tokio::fs::create_dir(tmp.path().join("zfolder"))
            .await
            .unwrap();
        tokio::fs::write(tmp.path().join("zfolder").join("z.md"), "z")
            .await
            .unwrap();
        let tree = list_workspace(tmp.path()).await.unwrap();
        assert!(tree.children[0].is_dir);
        assert_eq!(tree.children[0].name, "zfolder");
    }

    #[tokio::test]
    async fn skips_dotfiles_and_common_build_dirs() {
        let tmp = TempDir::new().unwrap();
        tokio::fs::create_dir(tmp.path().join("node_modules"))
            .await
            .unwrap();
        tokio::fs::create_dir(tmp.path().join(".hidden"))
            .await
            .unwrap();
        tokio::fs::write(tmp.path().join("real.md"), "x")
            .await
            .unwrap();
        let tree = list_workspace(tmp.path()).await.unwrap();
        assert_eq!(tree.children.len(), 1);
        assert_eq!(tree.children[0].name, "real.md");
    }
}
