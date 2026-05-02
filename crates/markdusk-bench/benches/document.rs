use criterion::{Criterion, black_box, criterion_group, criterion_main};
use markdusk_core::document::Document;
use std::io::Write;
use tempfile::NamedTempFile;
use tokio::runtime::Runtime;

fn corpus_kb(kb: usize) -> String {
    let chunk = "# Heading\n\nSome **bold** and *italic* text. `code` and a [link](https://example.com).\n\n```rust\nfn main() { println!(\"hi\"); }\n```\n\n| col | val |\n|---|---|\n| a | 1 |\n| b | 2 |\n\n> A quote\n\n";
    let bytes_target = kb * 1024;
    let mut s = String::with_capacity(bytes_target + chunk.len());
    while s.len() < bytes_target {
        s.push_str(chunk);
    }
    s
}

fn bench_document_open(c: &mut Criterion) {
    let rt = Runtime::new().expect("create tokio runtime");
    let mut group = c.benchmark_group("document_open");
    for &kb in &[10usize, 100, 1024] {
        let src = corpus_kb(kb);
        let mut tmp = NamedTempFile::new().expect("create tempfile");
        tmp.write_all(src.as_bytes()).expect("write corpus");
        tmp.flush().expect("flush corpus");
        let path = tmp.path().to_path_buf();
        // Keep the file alive for the duration of the bench by holding the
        // NamedTempFile in scope. Move into closure environment via clone of path.
        group.bench_function(format!("{}_kb", kb), |b| {
            b.iter(|| {
                rt.block_on(async {
                    let _ = Document::open(black_box(&path)).await.expect("open");
                });
            });
        });
        // tmp drops here at end of iteration scope
        drop(tmp);
    }
    group.finish();
}

criterion_group!(benches, bench_document_open);
criterion_main!(benches);
