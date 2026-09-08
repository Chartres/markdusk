# site/ — the landing page (markdusk.dravec.org)

Static, framework-free. Until 2026-09-08 this page lived only in the Cloudflare Pages
project `markdusk` (direct upload, source not in git); it was mirrored back here from the
live site so the discoverability kit (flywheel Standard §5c — `robots.txt`, `sitemap.xml`,
`llms.txt`, `og.png` 1200×630, `.well-known/security.txt`, OpenGraph/JSON-LD head block)
could be added under version control.

Deploy: the flywheel hub's `connect-pages` workflow with
`slug=markdusk · build_command=true · output_dir=site · recreate=true`
converts the project to Cloudflare's Git integration (brief downtime while the project is
recreated; the run re-attaches the domain and repoints DNS). After that, every push to
`main` that touches `site/` deploys itself. Until that run happens the live page is the old
direct-upload one.

Regenerate the share card after a copy or brand change:

```bash
node ../flywheel/scripts/og-image.mjs --name "Markdusk" \
  --tagline "A Mac-native markdown editor. Free, no account, no cloud, no plugins. It just opens the file." \
  --url markdusk.dravec.org --icon site/favicon.png --out site/og.png \
  --bg "#efecdb" --fg "#35402c" --accent "#6e7f2f" --note "macOS · free · open source"
```
