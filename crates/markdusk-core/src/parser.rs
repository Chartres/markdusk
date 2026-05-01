use crate::types::{Block, ParsedDoc};

pub fn parse(source: &str) -> ParsedDoc {
    let mut blocks = Vec::new();
    let parser = pulldown_cmark::Parser::new_ext(
        source,
        pulldown_cmark::Options::ENABLE_TABLES
            | pulldown_cmark::Options::ENABLE_TASKLISTS
            | pulldown_cmark::Options::ENABLE_STRIKETHROUGH
            | pulldown_cmark::Options::ENABLE_FOOTNOTES
            | pulldown_cmark::Options::ENABLE_YAML_STYLE_METADATA_BLOCKS,
    )
    .into_offset_iter();

    let mut current_text = String::new();
    let mut current_kind: Option<&'static str> = None;
    let mut current_start: usize = 0;

    for (event, range) in parser {
        match event {
            pulldown_cmark::Event::Start(tag) => {
                current_kind = Some(match tag {
                    pulldown_cmark::Tag::Heading { .. } => "heading",
                    pulldown_cmark::Tag::Paragraph => "paragraph",
                    pulldown_cmark::Tag::CodeBlock(_) => "code_block",
                    pulldown_cmark::Tag::List(_) => "list",
                    pulldown_cmark::Tag::BlockQuote(_) => "quote",
                    _ => "other",
                });
                current_start = range.start;
                current_text.clear();
            }
            pulldown_cmark::Event::Text(t) => current_text.push_str(&t),
            pulldown_cmark::Event::End(_) => {
                if let Some(kind) = current_kind.take() {
                    blocks.push(Block {
                        kind: kind.into(),
                        text: std::mem::take(&mut current_text),
                        byte_range: (current_start, range.end),
                    });
                }
            }
            _ => {}
        }
    }
    ParsedDoc { blocks }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_heading_and_paragraph() {
        let doc = parse("# Hello\n\nWorld.");
        assert_eq!(doc.blocks.len(), 2);
        assert_eq!(doc.blocks[0].kind, "heading");
        assert_eq!(doc.blocks[0].text, "Hello");
        assert_eq!(doc.blocks[1].kind, "paragraph");
        assert_eq!(doc.blocks[1].text, "World.");
    }

    #[test]
    fn parses_empty_string() {
        let doc = parse("");
        assert_eq!(doc.blocks.len(), 0);
    }

    #[test]
    fn captures_byte_ranges() {
        let doc = parse("# Hi\n\np");
        assert_eq!(doc.blocks[0].byte_range.0, 0);
        assert!(doc.blocks[0].byte_range.1 >= 4);
    }
}

#[cfg(test)]
mod proptests {
    use super::*;
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn never_panics(input in ".{0,1000}") {
            let _ = parse(&input);
        }

        #[test]
        fn block_count_bounded_by_lines(input in "[a-zA-Z0-9 \n#]{0,500}") {
            let doc = parse(&input);
            let line_count = input.lines().count();
            prop_assert!(doc.blocks.len() <= line_count.max(1) * 2);
        }
    }
}
