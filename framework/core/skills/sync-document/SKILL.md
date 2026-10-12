---
name: sync-document
description: Keep a document's Content (the Markdown in docs/content) and its Layout (the page file in slides) saying the same thing. Detects which side changed and syncs in the right direction. Use when the user says "sync", "sync to layout", "sync to the md", "update the layout from the markdown", "pull my edits into the markdown", "check whether they match", "I edited the resume in the editor" (or the cover letter), or after import-document has written new Content. Also run it at the start of a document session.
---

# Sync a document

Content (`docs/content/<id>.md`) and Layout (`slides/<id>/index.tsx`) carry the same words. Edits happen on either side, so this skill finds which side moved and brings the other into line. Drift means the two disagree.

The procedure and the rules for each direction are in the `document-from-brief` skill. This skill decides which direction to run. Use the project's terms from `CONTEXT.md`.

## 1. Check

```bash
node scripts/doc/slide-to-md.mjs <id> --check
```

- **In sync** (exit 0): nothing to do. Say so.
- **Missing Content** (the script says `missing`): the Layout exists with no Content. Create it with `--write`.
- **No Layout** (the script says `no layout` and exits 3, `slides/<id>/` is missing): create it by copying the Template folder (`slides/resume` or `slides/cover-letter`) to `slides/<id>/`, give it a new `meta.title`, a fresh `createdAt` and a unique `FONT_LINK_ID`, then run Content to Layout.
- **Drift** (exit 1): continue.

## 2. Decide the direction

Find out which side changed since the last sync:

```bash
git diff --stat -- docs/content/<id>.md slides/<id>/index.tsx
```

| What changed | Direction | How |
| --- | --- | --- |
| Only the Layout | **Layout to Content** | Run `--write` to pull the edits into the Content, then run the style checks (slide edits bypass them). Tell the user which lines changed. |
| Only the Content | **Content to Layout** | Follow "3. Sync into the Layout" in `document-from-brief`: copy the text exactly, reuse the components, never split an `Entry` across Pages, end every Page but the last with `Continued`. |
| Both, or you cannot tell | **Ask** | Show the diff and ask which side wins. Never overwrite either side blind. |
| Neither is committed yet (a fresh import) | **Content to Layout** | Content is the newer artefact when it came from `import-document`. |

## 3. Fill the Pages, then verify

After building or changing a Layout, measure each Page (step 4 of `document-from-brief`) and set the page breaks from the numbers, not by eye:

- Fill a Page with whole entries and sections. If the next one fits on this Page and still leaves at least 100px of slack, pull it up. A Page with a few hundred pixels spare while the next Page holds a short entry is a bad break.
- Never split an `Entry` across Pages. Put `Continued` at the bottom of every Page but the last.
- A section that moves to the next Page keeps its heading. Repeat the section heading with `(continued)` only when an experience list is split.

Then verify:

- Run `--check` again. It must report `in sync`.
- Run the fit check from step 4 of `document-from-brief`: open each Page in the dev server and compare `scroll` with `client`. Leave about 100px of slack on every Page.
- Report the Page count, the space left on each Page, and anything you moved to the next Page.

Do not commit or push unless asked.
