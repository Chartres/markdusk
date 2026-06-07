//! Render markdown to standalone HTML with embedded theme CSS.
//!
//! The two `HtmlTheme` palettes mirror `smoke.css`/`amber.css` at the level
//! needed for offline rendering — body, headings, code, tables, blockquote,
//! links — so an exported `.html` file looks like the in-app preview when
//! opened anywhere.

/// Render markdown source to standalone HTML with the given theme palette inlined.
pub fn render_html(source: &str, theme: HtmlTheme) -> String {
    use pulldown_cmark::{Options, Parser, html};

    let mut html_out = String::new();
    let parser = Parser::new_ext(
        source,
        Options::ENABLE_TABLES
            | Options::ENABLE_TASKLISTS
            | Options::ENABLE_STRIKETHROUGH
            | Options::ENABLE_FOOTNOTES
            | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS,
    );
    html::push_html(&mut html_out, parser);

    let css = theme.embedded_css();
    format!(
        "<!doctype html>\n<html><head><meta charset=\"utf-8\"><style>{css}</style></head><body class=\"markdusk\">{html_out}</body></html>",
    )
}

/// A single self-contained CSS block per theme. Keep this in sync with
/// smoke.css/amber.css at the level needed for offline rendering.
pub enum HtmlTheme {
    Smoke,
    Amber,
}

impl HtmlTheme {
    fn embedded_css(&self) -> &'static str {
        match self {
            HtmlTheme::Smoke => SMOKE_CSS,
            HtmlTheme::Amber => AMBER_CSS,
        }
    }
}

const SMOKE_CSS: &str = r#"
body.markdusk {
  font-family: ui-serif, Charter, "Iowan Old Style", Georgia, serif;
  background: #eee9de; color: #2a2c2c;
  max-width: 720px; margin: 32px auto; padding: 0 24px;
  line-height: 1.65; font-size: 16px;
}
.markdusk h1, .markdusk h2, .markdusk h3, .markdusk h4, .markdusk h5, .markdusk h6 { color: #3d6a5e; font-weight: 700; }
.markdusk h1 { font-size: 1.7em; }
.markdusk h2 { font-size: 1.4em; }
.markdusk h3 { font-size: 1.2em; }
.markdusk a { color: #3d6a5e; }
.markdusk blockquote { border-left: 3px solid #5d8a7e; color: #5d8a7e; padding-left: 12px; font-style: italic; }
.markdusk code { font-family: "JetBrains Mono", ui-monospace, monospace; background: #1d2222; color: #dfd8c6; padding: 1px 4px; border-radius: 3px; }
.markdusk pre { background: #1d2222; color: #dfd8c6; padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdusk pre code { background: transparent; padding: 0; }
.markdusk table { border-collapse: collapse; }
.markdusk th, .markdusk td { border: 1px solid #d2cbb8; padding: 6px 10px; }
.markdusk th { background: rgba(61,106,94,0.06); }
@media (prefers-color-scheme: dark) {
  body.markdusk { background: #1d2222; color: #dcd6c4; }
  .markdusk h1, .markdusk h2, .markdusk h3, .markdusk h4, .markdusk h5, .markdusk h6 { color: #88b3a4; }
  .markdusk a { color: #88b3a4; }
  .markdusk th, .markdusk td { border-color: #262b2b; }
}
"#;

const AMBER_CSS: &str = r#"
body.markdusk {
  font-family: ui-serif, Charter, "Iowan Old Style", Georgia, serif;
  background: #f4ecdb; color: #28323e;
  max-width: 720px; margin: 32px auto; padding: 0 24px;
  line-height: 1.65; font-size: 16px;
}
.markdusk h1, .markdusk h2, .markdusk h3, .markdusk h4, .markdusk h5, .markdusk h6 { color: #b85c2a; font-weight: 700; }
.markdusk a { color: #b85c2a; }
.markdusk blockquote { border-left: 3px solid #b85c2a; color: #5a4a32; padding-left: 12px; font-style: italic; }
.markdusk code { font-family: "JetBrains Mono", ui-monospace, monospace; background: #28323e; color: #e7dec5; padding: 1px 4px; border-radius: 3px; }
.markdusk pre { background: #28323e; color: #e7dec5; padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdusk pre code { background: transparent; padding: 0; }
.markdusk table { border-collapse: collapse; }
.markdusk th, .markdusk td { border: 1px solid #dbd1b3; padding: 6px 10px; }
.markdusk th { background: rgba(184,92,42,0.06); }
@media (prefers-color-scheme: dark) {
  body.markdusk { background: #1a2230; color: #e0d8c0; }
  .markdusk h1, .markdusk h2, .markdusk h3, .markdusk h4, .markdusk h5, .markdusk h6 { color: #e08a4a; }
  .markdusk a { color: #e08a4a; }
  .markdusk th, .markdusk td { border-color: #22293a; }
}
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn renders_basic_markdown_to_html() {
        let html = render_html("# Hello\n\n**bold** *italic*", HtmlTheme::Smoke);
        assert!(html.starts_with("<!doctype html>"));
        assert!(html.contains("<h1>Hello</h1>"));
        assert!(html.contains("<strong>bold</strong>"));
        assert!(html.contains("<em>italic</em>"));
        assert!(html.contains("body.markdusk"));
    }

    #[test]
    fn switches_palette_with_theme() {
        let smoke = render_html("# t", HtmlTheme::Smoke);
        let amber = render_html("# t", HtmlTheme::Amber);
        assert!(smoke.contains("#3d6a5e"));
        assert!(amber.contains("#b85c2a"));
        assert!(!smoke.contains("#b85c2a"));
        assert!(!amber.contains("#3d6a5e"));
    }

    #[test]
    fn renders_tables_and_code() {
        let html = render_html(
            "| a | b |\n|---|---|\n| 1 | 2 |\n\n```\ncode\n```",
            HtmlTheme::Smoke,
        );
        assert!(html.contains("<table>"));
        assert!(html.contains("<th>a</th>"));
        assert!(html.contains("<pre><code>code\n</code></pre>") || html.contains("<pre><code>"));
    }
}
