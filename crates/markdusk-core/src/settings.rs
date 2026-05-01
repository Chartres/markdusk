use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use thiserror::Error;
use ts_rs::TS;

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq, Default)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
#[serde(rename_all = "snake_case")]
pub enum Theme {
    #[default]
    Smoke,
    Amber,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, TS, PartialEq, Eq, Default)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
#[serde(rename_all = "snake_case")]
pub enum AppearanceMode {
    #[default]
    System,
    Light,
    Dark,
}

#[derive(Debug, Clone, Serialize, Deserialize, TS, PartialEq, Eq)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
pub struct Settings {
    pub theme: Theme,
    pub appearance: AppearanceMode,
    pub font_size_px: u8,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            theme: Theme::default(),
            appearance: AppearanceMode::default(),
            font_size_px: 16,
        }
    }
}

#[derive(Debug, Error)]
pub enum SettingsError {
    #[error("io error: {0}")]
    Io(#[from] std::io::Error),
    #[error("invalid settings file: {0}")]
    Invalid(#[from] serde_json::Error),
}

impl Settings {
    pub async fn load(path: impl AsRef<Path>) -> Result<Self, SettingsError> {
        match tokio::fs::read(path.as_ref()).await {
            Ok(bytes) => Ok(serde_json::from_slice(&bytes)?),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Settings::default()),
            Err(e) => Err(e.into()),
        }
    }

    pub async fn save(&self, path: impl AsRef<Path>) -> Result<(), SettingsError> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            tokio::fs::create_dir_all(parent).await?;
        }
        let json = serde_json::to_vec_pretty(self)?;
        let tmp: PathBuf = path.with_extension("json.tmp");
        tokio::fs::write(&tmp, &json).await?;
        tokio::fs::rename(&tmp, &path).await?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn defaults_to_smoke_system_16px() {
        let s = Settings::default();
        assert_eq!(s.theme, Theme::Smoke);
        assert_eq!(s.appearance, AppearanceMode::System);
        assert_eq!(s.font_size_px, 16);
    }

    #[tokio::test]
    async fn load_returns_default_when_file_missing() {
        let s = Settings::load("/nonexistent/markdusk-settings.json")
            .await
            .unwrap();
        assert_eq!(s, Settings::default());
    }

    #[tokio::test]
    async fn save_then_load_roundtrips() {
        let tmp = TempDir::new().unwrap();
        let path = tmp.path().join("settings.json");
        let original = Settings {
            theme: Theme::Amber,
            appearance: AppearanceMode::Dark,
            font_size_px: 18,
        };
        original.save(&path).await.unwrap();
        let loaded = Settings::load(&path).await.unwrap();
        assert_eq!(loaded, original);
    }
}
