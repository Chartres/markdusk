use criterion::{Criterion, black_box, criterion_group, criterion_main};
use markdusk_core::export::{HtmlTheme, render_html};

fn corpus_kb(kb: usize) -> String {
    let chunk = "# Heading\n\nSome **bold** and *italic* text. `code` and a [link](https://example.com).\n\n```rust\nfn main() { println!(\"hi\"); }\n```\n\n| col | val |\n|---|---|\n| a | 1 |\n| b | 2 |\n\n> A quote\n\n";
    let bytes_target = kb * 1024;
    let mut s = String::with_capacity(bytes_target + chunk.len());
    while s.len() < bytes_target {
        s.push_str(chunk);
    }
    s
}

fn bench_render(c: &mut Criterion) {
    let mut group = c.benchmark_group("render");
    for &kb in &[10usize, 100, 1024] {
        let src = corpus_kb(kb);
        group.bench_function(format!("{}_kb", kb), |b| {
            b.iter(|| render_html(black_box(&src), HtmlTheme::Smoke));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_render);
criterion_main!(benches);
