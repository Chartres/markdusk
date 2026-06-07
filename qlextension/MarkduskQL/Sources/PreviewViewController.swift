import Cocoa
import Quartz
import WebKit

@objc(MarkduskQLPreview)
class PreviewViewController: NSViewController, QLPreviewingController {
    private var webView: WKWebView!

    override func loadView() {
        let v = NSView(frame: NSRect(x: 0, y: 0, width: 720, height: 900))
        webView = WKWebView(frame: v.bounds)
        webView.autoresizingMask = [.width, .height]
        v.addSubview(webView)
        self.view = v
    }

    func preparePreviewOfFile(at url: URL) async throws {
        let data = try Data(contentsOf: url)
        guard let source = String(data: data, encoding: .utf8) else {
            throw NSError(domain: "Markdusk", code: 1)
        }
        let html = render(source)
        webView.loadHTMLString(html, baseURL: url.deletingLastPathComponent())
    }

    private func render(_ source: String) -> String {
        let body = renderBlocks(source)
        let css = bundledCSS()
        return """
        <!doctype html>
        <html><head><meta charset="utf-8"><style>\(css)</style></head>
        <body class="markdusk">\(body)</body></html>
        """
    }

    private func renderBlocks(_ source: String) -> String {
        var out = ""
        var inFence = false
        var fenceBuf = ""
        var fenceLang = ""
        for raw in source.components(separatedBy: "\n") {
            let line = raw
            if inFence {
                if line.hasPrefix("```") {
                    out += "<pre><code class=\"lang-\(fenceLang)\">\(escapeHTML(fenceBuf))</code></pre>"
                    inFence = false
                    fenceBuf = ""
                    fenceLang = ""
                } else {
                    if !fenceBuf.isEmpty { fenceBuf += "\n" }
                    fenceBuf += line
                }
                continue
            }
            if line.hasPrefix("```") {
                inFence = true
                fenceLang = String(line.dropFirst(3))
                continue
            }
            if let h = atxHeading(line) {
                out += "<h\(h.level)>\(escapeHTML(h.text))</h\(h.level)>"
                continue
            }
            if line.trimmingCharacters(in: .whitespaces).isEmpty {
                continue
            }
            // Inline syntax via AttributedString(markdown:)
            if let attr = try? AttributedString(markdown: line) {
                let html = String(NSAttributedString(attr).string)
                out += "<p>\(escapeHTML(html))</p>"
            } else {
                out += "<p>\(escapeHTML(line))</p>"
            }
        }
        if inFence {
            out += "<pre><code class=\"lang-\(fenceLang)\">\(escapeHTML(fenceBuf))</code></pre>"
        }
        return out
    }

    private func atxHeading(_ line: String) -> (level: Int, text: String)? {
        var hashes = 0
        for c in line { if c == "#" { hashes += 1 } else { break } }
        guard (1...6).contains(hashes), line.count > hashes else { return nil }
        let after = line.index(line.startIndex, offsetBy: hashes)
        let rest = String(line[after...]).trimmingCharacters(in: .whitespaces)
        if rest.isEmpty { return nil }
        return (hashes, rest)
    }

    private func escapeHTML(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;")
            .replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;")
    }

    private func bundledCSS() -> String {
        guard let url = Bundle(for: type(of: self)).url(forResource: "smoke", withExtension: "css"),
              let css = try? String(contentsOf: url) else {
            return ""
        }
        return css
    }
}
