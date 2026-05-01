use serde::{Deserialize, Serialize};
use ts_rs::TS;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, TS)]
#[ts(export, export_to = "../../../src/lib/ipc/types.gen.ts")]
pub struct OutlineEntry {
    pub level: u8,
    pub text: String,
    pub byte_offset: usize,
}

pub fn outline(source: &str) -> Vec<OutlineEntry> {
    use pulldown_cmark::{Event, HeadingLevel, Options, Parser, Tag, TagEnd};
    let parser = Parser::new_ext(
        source,
        Options::ENABLE_TABLES
            | Options::ENABLE_TASKLISTS
            | Options::ENABLE_FOOTNOTES
            | Options::ENABLE_YAML_STYLE_METADATA_BLOCKS,
    )
    .into_offset_iter();

    let mut entries = Vec::new();
    let mut current: Option<(u8, String, usize)> = None;

    for (event, range) in parser {
        match event {
            Event::Start(Tag::Heading { level, .. }) => {
                let lvl = match level {
                    HeadingLevel::H1 => 1,
                    HeadingLevel::H2 => 2,
                    HeadingLevel::H3 => 3,
                    HeadingLevel::H4 => 4,
                    HeadingLevel::H5 => 5,
                    HeadingLevel::H6 => 6,
                };
                current = Some((lvl, String::new(), range.start));
            }
            Event::Text(t) => {
                if let Some((_, ref mut text, _)) = current {
                    text.push_str(&t);
                }
            }
            Event::End(TagEnd::Heading(_)) => {
                if let Some((level, text, byte_offset)) = current.take() {
                    entries.push(OutlineEntry {
                        level,
                        text,
                        byte_offset,
                    });
                }
            }
            _ => {}
        }
    }
    entries
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn empty_doc_has_no_outline() {
        assert_eq!(outline(""), vec![]);
    }

    #[test]
    fn extracts_atx_headings_with_levels() {
        let src = "# A\n\n## B\n\nbody\n\n### C";
        let o = outline(src);
        assert_eq!(o.len(), 3);
        assert_eq!(
            o[0],
            OutlineEntry {
                level: 1,
                text: "A".into(),
                byte_offset: 0
            }
        );
        assert_eq!(o[1].level, 2);
        assert_eq!(o[1].text, "B");
        assert_eq!(o[2].level, 3);
        assert_eq!(o[2].text, "C");
    }

    #[test]
    fn ignores_paragraphs_and_lists() {
        let src = "para\n\n- item\n\n# only this";
        let o = outline(src);
        assert_eq!(o.len(), 1);
        assert_eq!(o[0].text, "only this");
    }
}
