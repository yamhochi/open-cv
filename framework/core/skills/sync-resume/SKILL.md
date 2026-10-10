---
name: sync-resume
description: Keep a Resume's or Cover letter's Content (the Markdown in docs/resumes) and its Layout (the page file in slides) saying the same thing. Detects which side changed and syncs in the right direction. Use when the user says "sync", "sync to layout", "sync to the md", "update the layout from the markdown", "pull my edits into the markdown", "check whether they match", "I edited the resume in the editor", or after import-resume has written new Content. Also run it at the start of a resume session.
---

# Sync a Resume

Content (`docs/resumes/<id>.md`) and Layout (`slides/<id>/index.tsx`) carry the same words. Edits happen on either side, so this skill finds which side moved and brings the other into line. Drift means the two disagree.

The procedure and the rules for each direction are in the `resume-from-brief` skill. This skill decides which direction to run. Use the project's terms from `CONTEXT.md`.

## 1. Check

```bash
node scripts/resume/slide-to-md.mjs <id> --check
```

- **In sync** (exit 0): nothing to do. Say so.
- **Missing Content** (the script says `missing`): the Layout exists with no Content. Create it with `--write`.
- **No Layout** (`slides/<id>/` is missing): create it by copying the Template folder (`slides/resume` or `slides/cover-letter`) to `slides/<id>/`, give it a new `meta.title`, a fresh `createdAt` and a unique `FONT_LINK_ID`, then run Content to Layout.
- **Drift** (exit 1): continue.

## 2. Decide the direction

Find out which side changed since the last sync:

```bash
git diff --stat -- docs/resumes/<id>.md slides/<id>/index.tsx
```

| What changed | Direction | How |
| --- | --- | --- |
| Only the Layout | **Layout to Content** | Run `--write` to pull the edits into the Content, then run the style checks (slide edits bypass them). Tell the user which lines changed. |
| Only the Content | **Content to Layout** | Follow "3. Sync into the Layout" in `resume-from-brief`: copy the text exactly, reuse the components, never split an `Entry` across Pages, end every Page but the last with `Continued`. |
| Both, or you cannot tell | **Ask** | Show the diff and ask which side wins. Never overwrite either side blind. |
| Neither is committed yet (a fresh import) | **Content to Layout** | Content is the newer artefact when it came from `import-resume`. |

## 3. Verify

- Run `--check` again. It must report `in sync`.
- Run the fit check from step 4 of `resume-from-brief`: open each Page in the dev server and compare `scroll` with `client`. Leave about 100px of slack on every Page.
- Report the Page count, the space left on each Page, and anything you moved to the next Page.

Do not commit or push unless asked.
