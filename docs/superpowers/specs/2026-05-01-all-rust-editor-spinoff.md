# All-Rust Markdown Editor — Spinoff Concept

**Status:** Concept / future project — NOT part of Markdusk v1
**Date:** 2026-05-01
**Parent:** `2026-05-01-markdusk-design.md`

## Summary

This is a placeholder spec for a **separate** future project: an all-Rust, no-WebView markdown editor that takes the Markdusk design language (Smoke + Amber themes, vertical tabs, soft WYSIWYG, literary serif) and re-implements it in pure Rust on top of the **floem** GUI framework (the same one that powers Lapce). It targets ~50 MB resident memory and < 150 ms cold start, at the cost of writing the soft-WYSIWYG editor primitive ourselves instead of reusing CodeMirror.

This is captured as a separate document so Markdusk can ship on schedule. It is not a fork; it is a new product that may share the `markdusk-core` Rust crate (parser, document, export, session) and reskin only the rendering layer.

## Why a separate project?

- The hard, slow part is **the editor primitive**: cursor handling, decoration ranges, IME, accessibility, table-cell editing, undo/redo, find/replace with virtualization. CodeMirror gives this for free; in floem we'd build it.
- Estimated 6-10 weeks of focused work on the editor primitive *before* feature parity.
- Scoping it as a separate project lets Markdusk reach users while this experiment cooks.

## Tech stack (proposed)

- **floem** — reactive Rust GUI, GPU-rendered (used by Lapce). More documented than gpui; less bleeding-edge.
- **comrak** or **pulldown-cmark** — markdown parsing.
- **syntect** — code syntax highlighting (used by Ferrite).
- **cosmic-text** — text shaping/layout (used by floem).
- **wgpu** — GPU rendering (transitive via floem).
- **fontdue** or **swash** — glyph rasterization.
- **markdusk-core** — reused as-is for parser, document, workspace, session, export.

## What we'd write ourselves

1. **Soft-WYSIWYG widget** — a custom floem widget that implements:
   - Decoration ranges (hide markers when cursor leaves line).
   - Inline image rendering.
   - Table cell editing.
   - Code block with inline syntax highlighting.
   - KaTeX / mermaid render-on-leave.
   - Vim mode adapter.
   - Find / replace overlay.
2. **Native macOS chrome bindings** — system menus, services, IME, accessibility — currently easy in Tauri (free via WKWebView), real work in floem.

## Out of scope

- Cross-platform — target macOS first; floem supports Linux/Windows but polish is macOS-first.
- Plugin system.
- Wikilinks / graph view.

## Comparable projects to study

- **Lapce** (`lapce/lapce`) — full editor in floem, has a markdown preview but not soft-WYSIWYG.
- **Zed** (`zed-industries/zed`) — uses gpui not floem, but has the closest soft-WYSIWYG-in-Rust implementation.
- **Ferrite** (`OlaProeis/Ferrite`) — egui-based, MIT licensed, has hand-rolled soft-WYSIWYG widgets we could study (~10 KLOC of widget code).

## Decision criteria

This project ships if:
- Markdusk v1 is in users' hands and getting feedback.
- The floem soft-WYSIWYG prototype reaches "feels as good as CodeMirror" on a 100 KB doc.
- There is meaningful demand for ~50 MB lighter / no-WebView.

If those don't hold, this stays a placeholder. The work is real and we won't start it speculatively.

## Naming

Different name (not "Markdusk-Rust") so it stands on its own. Working title ideas: **Embers**, **Vellum**, **Dusk Lite**, **Ferrous**.
