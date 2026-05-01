//! markdusk-core — pure Rust core for the Markdusk editor.
//!
//! No Tauri imports. All file I/O, parsing, and document logic lives here
//! so it can be tested headlessly.

pub mod parser;
pub mod document;
pub mod settings;
pub mod types;
