# Markdusk Personas & Jobs-To-Be-Done

A short, opinionated reference. Use it to decide what ships, what doesn't, and
what we politely refuse to build. Personas were grounded in real discussions —
sources are linked inline. The QA scripts in `docs/personas/` exercise the same
characters; this doc is the strategic counterpart (who they are, what they want,
what we won't sell them).

Target audience for Markdusk in one line: **citizen developers and writers who
suddenly have `.md` files everywhere, want a beautiful Mac-native editor, and do
not want a knowledge-management religion.**

## Why these four

We talked to (read) four kinds of users in the wild:

1. **Switchers** burned out by Obsidian/Notion maintenance overhead
   ([Source: Medium — Why I switched from Obsidian](https://medium.com/@dev_tips/why-i-switched-from-obsidian-a-real-developers-story-and-what-i-m-using-now-1ef20fb1a1a7),
   [Source: XDA — 3 reasons I'm uninstalling Obsidian](https://www.xda-developers.com/reasons-switching-from-obsidian-to-notion/)).
2. **Writers** who chose iA Writer / Bear / Typora for taste, not power
   ([Source: Bill Bennett — Ten years of Markdown and iA Writer](https://billbennett.micro.blog/2026/02/26/ten-years-of-markdown-and.html),
   [Source: Scott Fillmer — 5 Reasons iA Writer is best](https://www.scottfillmer.xyz/5-reasons-iawriter-is-best-markdown-editor/)).
3. **Citizen developers / PMs** opening `.md` files from GitHub, AI tools, repos,
   docs sites — and getting TextEdit ([Source: MacMD Viewer guide](https://macmdviewer.com/blog/how-to-view-markdown-files),
   [Source: ShowMeMyMD — How to open .md on Mac](https://www.showmemymd.com/blog/how-to-open-md-files-mac)).
4. **Engineers / researchers** who treat a folder of `.md` as their source of
   truth and want it to keep working in 50 years
   ([Source: HN — Is there any beautiful Markdown editor?](https://news.ycombinator.com/item?id=32797711),
   [Source: HN — What Markdown editor do you use?](https://news.ycombinator.com/item?id=37097533)).

Four personas, in priority order for the product:

---

## 1. Sam — the switcher who's tired of tool-maintenance

One-line tag: *"I just want to write. I'm done babysitting plugins."*

**Context.** Mid-career knowledge worker (PM, designer, indie hacker). Has used
Obsidian or Notion for 1–3 years. Has a vault. Has ~12 community plugins. Spent
last Sunday fixing a sync conflict. Reads Hacker News. Owns a MacBook.

**What the research says.** The single loudest complaint in the "I left Obsidian"
genre is not features — it's that the tool became the project. "I was spending
more time babysitting my tools than creating"
([Source: Medium — Why I switched from Obsidian](https://medium.com/@dev_tips/why-i-switched-from-obsidian-a-real-developers-story-and-what-i-m-using-now-1ef20fb1a1a7)).
XDA's reviewer hit the same wall: sync errors, maintenance, the plugin treadmill
([Source: XDA](https://www.xda-developers.com/reasons-switching-from-obsidian-to-notion/)).

**Top JTBDs.**

1. When I double-click a `.md` file, I want it to open in a beautiful Mac-native
   editor in under a second, so I can read or edit without ceremony.
2. When I open Markdusk fresh, I want sensible defaults and zero setup wizard,
   so I can type a sentence within five seconds of first launch.
3. When I evaluate a new editor, I want to feel "this is finished" within five
   minutes, so I can decide to switch without reading docs.

**Pain points (paraphrased from real users).**

- Obsidian's blank-canvas start screen "makes it harder to figure out templates"
  ([Source: XDA](https://www.xda-developers.com/reasons-switching-from-obsidian-to-notion/)).
- Sync errors and tolerance for them dropped to zero
  ([Source: Medium](https://medium.com/@dev_tips/why-i-switched-from-obsidian-a-real-developers-story-and-what-i-m-using-now-1ef20fb1a1a7)).
- TextEdit on macOS shows `**bold**` as literal asterisks — the default Mac
  experience for `.md` is "surprisingly bad" ([Source: MacMD Viewer](https://macmdviewer.com/blog/how-to-view-markdown-files)).

**Anti-features Sam will reject.**

- Required login or account creation.
- Plugin marketplace on day one.
- Onboarding tour with five steps and a checklist.
- Anything that says "Sync with Markdusk Cloud" on first launch.
- Graph view. Backlinks panel. Daily-notes ritual.

---

## 2. Maya — the writer who chose taste over power

One-line tag: *"Make it feel like writing. Get out of my way."*

**Context.** Substacker, essayist, freelance writer, sometimes a journalist.
Drafts long-form prose in markdown because it survives platform changes. Pays
for iA Writer or Bear today. Owns the latest MacBook Air. Cares about serif
typography and the color of the page. Does not write code, but knows what a
heading is.

**What the research says.** Writers stick with iA Writer because it is
"beautiful, opinionated, and deliberately limited in all the right ways"
([Source: web2md — Best Markdown Apps 2026](https://web2md.org/blog/best-markdown-apps-2026)).
Bill Bennett, ten years in: writers are "more productive with Markdown, getting
more done with less mental and physical strain"
([Source: Bill Bennett](https://billbennett.micro.blog/2026/02/26/ten-years-of-markdown-and.html)).
Typora's appeal is the same — WYSIWYG that makes markdown "feel like a word
processor," at $14.99 for life
([Source: Bicycle For Your Mind — Typora is Fantastic](https://bicycleforyourmind.com/typora_is_fantastic)).
Bear gets praised for "elegant themes, refined typography, and a clutter-free
interface" ([Source: Bear app review](https://dockshare.io/apps/bear)).

**Top JTBDs.**

1. When I'm drafting an essay, I want the page to look like the finished thing,
   so I can judge rhythm and length while I write.
2. When I press ⌘B on selected text, I want it bold immediately — markup
   visible only on the current line, hidden everywhere else.
3. When I need to send a draft to my editor, I want to export a presentable PDF
   in one step, so I can ship without a pandoc detour.

**Pain points.**

- Typora "has no sync, no publishing, no mobile app, and limited organization"
  ([Source: Typora review](https://productivitystack.io/tools/typora/)) — Maya
  ends up taping two apps together.
- Bear is Apple-only and locks sync behind a subscription
  ([Source: Bear app review](https://dockshare.io/apps/bear)) — fine for now,
  but the paywall stings.
- iA Writer is "deliberately limited" — which is mostly a feature but
  occasionally a wall (no flexible export theming, etc.).

**Anti-features Maya will reject.**

- A second preview pane she has to look at while writing
  ([HN: "No weird 2nd pane just to have the readable pretty markdown."](https://news.ycombinator.com/item?id=32797711)).
- Code-editor aesthetics: monospace body font, hash-symbol fetishism.
- A plugin marketplace.
- AI features that suggest words mid-sentence.
- Vim mode in her face.

---

## 3. Priya — the citizen developer drowning in .md files

One-line tag: *"GitHub, ChatGPT, Cursor, and Notion all hand me markdown. Now what?"*

**Context.** PM, designer-engineer, technical writer, or junior researcher.
Doesn't ship code daily but reads it. Their inbox of `.md` files comes from:
README files in repos they cloned, transcripts from AI chats, exported Notion
pages, meeting notes from a teammate. Today they open these in VS Code (overkill)
or TextEdit (broken).

> Note: We re-use the *name* Priya from the existing QA persona script
> (`docs/personas/priya.md`). The QA script characterizes her as an academic with
> LaTeX needs — that's a thin slice of the same archetype. For *product*
> purposes, treat Priya as the broader "I didn't choose markdown, markdown chose
> me" persona, with academia as one of several flavors.

**What the research says.** The Mac out-of-box `.md` experience is the
recurring complaint: double-click, TextEdit, raw symbols, sad face
([Source: MacMD Viewer guide](https://macmdviewer.com/blog/how-to-view-markdown-files),
[Source: ShowMeMyMD](https://www.showmemymd.com/blog/how-to-open-md-files-mac)).
HN commenters specifically want "user-friendly UI for viewing and editing
markdown files," with interlinking between local files and no surprise
frontmatter mangling ([Source: HN — user-friendly UI for markdown](https://news.ycombinator.com/item?id=39690725)).
The "plain text future-proof" stance is now mainstream — "readable in fifty
years by any text editor on any platform"
([Source: The Creative Cyborg — The Markdown Era](https://creativecyborg.substack.com/p/the-markdown-era)).

**Top JTBDs.**

1. When I double-click a `.md` from Finder, GitHub, or Slack, I want a beautiful
   rendered view *immediately*, so I don't have to install or configure anything.
2. When I want to tweak something — a heading, a typo, a bullet — I want to
   edit in place, not switch apps, so my "read" tool and "edit" tool are one.
3. When I'm done, I want to share the result as a PDF, HTML, or rich-text paste,
   so non-technical recipients see formatting, not asterisks.

**Pain points.**

- "Heading hierarchy h4-h6 are indistinguishable from text" in many editors
  ([Source: HN — beautiful markdown editor thread](https://news.ycombinator.com/item?id=32797711)).
- LaTeX/math fans note silent fallback to raw TeX when the editor can't render —
  also from the same thread.
- Frontmatter being mangled on save is a named anxiety
  ([Source: HN — UI for markdown](https://news.ycombinator.com/item?id=39690725)).

**Anti-features Priya will reject.**

- A modal "Choose Markdown Flavor" dialog. Just do GFM well.
- A required vault / workspace concept.
- Anything that rewrites her file on save (smart quotes, trailing-whitespace
  trimming) without her asking.
- Cloud-only quick-look.

---

## 4. Diego — the engineer who lives in a folder of .md

One-line tag: *"My README is my product. Don't break my code blocks."*

**Context.** Backend or platform engineer. Maintains README files, ADRs,
runbooks, architecture docs. Has 5+ `.md` files open simultaneously. Comfortable
in a terminal. Might use vim bindings, might not — but is comfortable either way
(unlike the vim greybeards, who are not our audience).

**What the research says.** HN regulars consistently rate three things highest:
no lock-in, files in a git repo, low friction to write
([Source: HN — How Markdown took over the world](https://news.ycombinator.com/item?id=46556695)).
They reject Electron/PWA wrappers when they can ("Unlike nearly every other
editor it's not a PWA/electron" was a *compliment*
[Source: HN — beautiful markdown editor](https://news.ycombinator.com/item?id=32797711)).
Mermaid, code-fence highlighting, and tables are the table-stakes rendering
features.

**Top JTBDs.**

1. When I edit a fenced code block, I want syntax highlighting that updates as I
   type, so I can spot a typo without leaving the editor.
2. When I open my project folder, I want a fast file tree that hides dotfiles
   and non-markdown noise, so I can jump between docs at the speed of `:e`.
3. When I export a README to HTML for a colleague, I want a single self-contained
   file with inline CSS, so they can open it anywhere without missing assets.

**Pain points.**

- Electron editors feel slow on his 2019 MacBook — performance is the silent
  killer of every "beautiful markdown editor" Show HN.
- Mermaid is everywhere in his docs now; many editors silently leave it as a
  raw code fence.
- Tab strip overflow is consistently broken in cross-platform markdown editors
  once he hits ~7 tabs.

**Anti-features Diego will reject.**

- A reformatter that "fixes" his pipe-aligned tables.
- A markdown linter that flags his deliberate single-newline-after-heading.
- Forced web-first features (real-time collaboration, share-via-URL).
- Anything that touches `.git/` or rewrites file paths.

---

## Cross-persona principles

These fall out of the four personas above. Treat them as constraints; if a
proposed feature breaks one, the feature is wrong, not the principle.

1. **Open in under a second, type within five.** Sub-second cold launch from
   double-click in Finder, sub-200ms tab switch. This is the entire reason to be
   Tauri/Rust, not Electron. Lose this and Sam goes back to Bear.
2. **WYSIWYG by default, source mode one keystroke away.** Markup hides on lines
   the cursor isn't on. This is Typora's central insight, and writers will not
   give it up ([Source: Bicycle For Your Mind](https://bicycleforyourmind.com/typora_is_fantastic)).
3. **No required login, no cloud, no account.** Files are the file system. The
   "local-first, no account" cohort is large and growing
   ([Source: MakeUseOf — synced markdown folder no account](https://www.makeuseof.com/replaced-entire-note-taking-system-with-tool-that-syncs-without-account/)).
4. **Don't touch the file we didn't change.** Frontmatter, line endings,
   trailing whitespace, smart-quote substitution — all off by default. Diego and
   Priya both name this as a deal-breaker.
5. **Beautiful by default — serif, calm, typographic.** Two themes (Smoke,
   Amber) is enough on day one. Bear and iA Writer have proven this market.
6. **Export must look like a finished document.** PDF for Maya, self-contained
   HTML for Diego, plain-text-with-rich-paste for Priya. Markdown editors that
   skip export feel like half a product.
7. **Keyboard-first, but discoverable.** Menu bar entries with shortcuts shown.
   Vim mode exists for Diego but is opt-in and unobtrusive.
8. **macOS-native cues.** Native save panel, native quick look, native menu bar,
   native window chrome. Sam is leaving a cross-platform Electron app *because*
   it never felt right on Mac.

## Non-goals

What Markdusk explicitly is not, so we can say "no" cleanly.

- **Not Obsidian.** No graph view, no daily notes, no plugin marketplace, no
  backlinks panel. The maintenance-burden refugees do not want a smaller
  Obsidian; they want an editor.
- **Not a knowledge base or PKM system.** No tags-as-database, no Dataview, no
  spaced repetition. Files in folders is the structure.
- **Not a publishing CMS.** Export to PDF/HTML/clipboard. We do not publish to
  Substack, Medium, Ghost, or "your blog."
- **Not real-time collaborative.** No CRDT, no presence cursors, no comment
  threads. Markdusk is a single-author editor.
- **Not a code IDE.** Syntax highlighting in code fences is rendering, not
  language servers. We will not host LSPs, debug code, or run tests.
- **Not a research database.** No citation manager, no Zotero integration, no
  bibliography engine. Priya's LaTeX-shaped flavor gets KaTeX rendering and that
  is the scope.
- **Not cross-platform on day one.** Mac-native and proud of it. Windows/Linux
  are interesting, later, only if the Mac product is loved.
- **Not AI-first.** No always-on assistant, no inline ghost-text completions.
  We may add an "Ask" command later; we will not make the cursor argue with the
  writer.
- **Not vim for greybeards.** Vim mode is a courtesy for Diego, not a brand.
  Anything beyond core motions, visual mode, and `:w` / `:q` is out of scope.

## How to use this doc

When prioritizing a feature, ask:

1. Which persona is this for? If the answer is "all of them, sort of," it's
   probably wrong.
2. Which JTBD does it serve? Quote it.
3. Does it violate a cross-persona principle? If yes, redesign or drop.
4. Is it on the non-goals list? If yes, the answer is no, and that's good news
   — every "no" sharpens the product.

If a real user contradicts something here, update this doc. It is meant to be a
living reference, not scripture.
