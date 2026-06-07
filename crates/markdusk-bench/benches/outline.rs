use criterion::{Criterion, black_box, criterion_group, criterion_main};
use markdusk_core::outline;

fn corpus_kb(kb: usize) -> String {
    let chunk = "# Heading\n\nSome **bold** and *italic* text. `code` and a [link](https://example.com).\n\n```rust\nfn main() { println!(\"hi\"); }\n```\n\n| col | val |\n|---|---|\n| a | 1 |\n| b | 2 |\n\n> A quote\n\n";
    let bytes_target = kb * 1024;
    let mut s = String::with_capacity(bytes_target + chunk.len());
    while s.len() < bytes_target {
        s.push_str(chunk);
    }
    s
}

fn bench_outline(c: &mut Criterion) {
    let mut group = c.benchmark_group("outline");
    for &kb in &[10usize, 100, 1024] {
        let src = corpus_kb(kb);
        group.bench_function(format!("{}_kb", kb), |b| {
            b.iter(|| outline::outline(black_box(&src)));
        });
    }
    group.finish();
}

criterion_group!(benches, bench_outline);
criterion_main!(benches);
