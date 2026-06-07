//! markdusk-core — pure Rust core for the Markdusk editor.
//!
//! No Tauri imports. All file I/O, parsing, and document logic lives here
//! so it can be tested headlessly.

pub mod document;
pub mod export;
pub mod outline;
pub mod parser;
pub mod settings;
pub mod types;
pub mod workspace;
