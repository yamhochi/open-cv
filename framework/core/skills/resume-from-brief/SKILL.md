---
name: resume-from-brief
description: Tailor the resume to a role through a fixed flow - read the role brief in docs/resume-briefs, write the resume as Markdown in docs/resumes, then sync that Markdown into the resume Layout in slides/ and verify it fits. Also syncs the other way, pulling edits made directly on the Layout back into the Markdown. Use when the user asks to tailor, rewrite or update the resume for a role, to update the resume from the md, to sync the resume Layout, to sync the Layout back to the md, to check whether the resume and Layout match, or to start a resume for a new role.
---

# Resume from brief

One role, three artefacts. The default order is Brief, then Content (the Markdown), then Layout (the page file), so when you are writing or rewriting, never edit the Layout first. The user can also edit the Layout directly in the inspector, so the flow runs backwards too (see "Sync back" below).

| Stage | File | Role |
| --- | --- | --- |
| 1. Brief (input) | `docs/resume-briefs/<id>.md` | Target role, JD keywords, confirmed experience, gaps, style. The only source of facts. |
| 2. Content | `docs/resumes/<id>.md` | The words, as Markdown. The default source for the Layout's text. Reviewed and edited by the user. |
| 3. Layout | `slides/<id>/index.tsx` | How the words are arranged into Pages and styled. Text is copied from Content, never invented here. |

**Every Resume and Cover letter has a Content file in `docs/resumes/<id>.md`.** The Word export needs it (the editor's Export as DOCX item or `pnpm export:docx`), and `slide-to-md.mjs --check` fails when it is missing. Duplicating a template in the editor copies its Markdown too, with `slide:` updated. For a Layout made any other way, create the Markdown straight away with `node scripts/resume/slide-to-md.mjs <id> --write`.

Stage 2 carries front matter (`slide:` and `brief:`) so the three files stay linked. For a new role, copy the closest existing Layout's folder under `slides/` and its Markdown, give it a new kebab-case id, a new `meta.title`, a fresh `createdAt` (`node -e "console.log(new Date().toISOString())"`) and a unique `FONT_LINK_ID`, then follow the flow.

Before any Layout edit, also follow the `slide-authoring` skill (canvas, spacing, pagination rules).

## 1. Read the brief

Read the whole brief. Then:

- Claim nothing outside "Confirmed experience". If the user gives a new fact in chat, add it to the brief first, then use it.
- Honour "Gaps to handle honestly". Hedge exactly as the brief does (for example a tool you have only used on side projects is described as exactly that).
- A JD keyword with no confirmed experience behind it is not claimed. Say so in the report instead.

## 2. Write `docs/resumes/<id>.md`

The grammar, and how each line maps to a Layout component, is in [references/content-format.md](references/content-format.md). Follow it exactly: the sync script and the Word export both read this file.

Core skills rules (readability is the point):

- Name each category after a JD keyword (for example "Design systems at scale" or "Research to roadmap"), not a generic bucket.
- One or two sentences per category, about 30 words at most. No bullet lists inside a category.
- One claim per sentence, each backed by confirmed experience. Cover the JD's themes across categories without repeating the summary word for word.
- Experience bullets the user has already approved keep their wording. Tighten only when asked.

Style: follow the brief's Language register and Style sections. By default write plain, direct prose. Avoid em dashes and buzzwords (for example leverage, seamless, unlock, empower), aim for one sentence per bullet, and never invent metrics.

## 3. Sync into the Layout

- Copy text from the Markdown. Do not paraphrase while syncing. For the core skills grid you can generate the `SkillCell` elements from the Markdown with a small node script.
- Reuse the existing components (`Entry`, `Bullet`, `SkillCell`, `CompactEntry`, `Continued`). Do not change a shared component to fit one role.
- Keep padding, max width and the 4px, 20px and 40px spacing tiers fixed. Overflow becomes a new page.
- Never split an `Entry` across pages. Fill a page with whole entries and move the next one to the following page.
- The last page ends with the contact footer. Every earlier page ends with `Continued`.
- Remove components the Layout no longer uses.

Component rules (so the inspector can edit and save a field without corrupting the shared component):

- Pass editable text as a string prop (`label`, `text`, `title`, `body`), not as JSX children. The inspector traces a `{prop}` back to the call site, and it cannot do that for `{children}` in this framework.
- The prop sits alone as the only child of its own `<div style={{ display: 'inline-block' }}>`, never a `<span>`. The inspector climbs past inline tags to the nearest block element, so a span lets a click resolve to the whole `<li>` and the parent and its sub-bullets edit as one paragraph.
- Do not put literal text next to an expression in the same element (for example `<span>{title}: </span>`). Move the literal into a separate sibling element.
- Prefer literal child components per line over a data array plus `.map()`.

## Bullet and list style guide

This resume uses two marker shapes on purpose, chosen by level. This is a deliberate exception to the general "one marker glyph per document" advice in `slide-authoring`. All values are CSS pixels on the 794px canvas; the Word export mirrors them (`md-to-docx.mjs`).

| Where | Marker | Text | Spacing |
| --- | --- | --- | --- |
| Experience bullet, standalone or parent (`Bullet`) | filled round dot, 3px, muted grey | starts 9px from the dot's left edge (3px dot + 6px gap). A single-sentence bullet is regular weight; the label is medium only when the bullet has a bold lead (`label` plus `body`) or children | line-height 1.5, 4px between bullets, no hanging offset |
| Child of a parent (`SubBullet`) | outlined ring, 4px with a 1px very light grey border (`#DEDCD7`) and no fill, centred on the parent's dot | starts at the same 9px as the parent text, so children are not indented | 4px between the parent row and its children, and between children |
| List inside a skills cell (`BulletCell` of `SubBullet`s) | the same outlined ring as a child | 12px regular weight, muted, 9px start | line-height 1.4 like the cell's body text, items one line apart with no extra gap |

Rules behind these:

- Section spacing for this resume is 24px between named sections (`SECTION_GAP` in the Layout and the Word export), 20px between entries and between a heading and its first item. It is a deliberate step down from the 40px default in `slide-authoring`.
- Markers are drawn shapes (a box with a background or border), never typed characters such as `•`, `-` or `·`. A typed marker becomes part of the text, so it shows up when the PDF is copied or parsed.
- One parent level and one child level only. A parent with children is written `- **Parent**` with the children indented two spaces. A bold line with no children is not valid.
- A list under a skills title is written `**Title**` then `- item` lines. An item can be a link, written `- [label](https://url)`. It renders as the label only, in a vivid blue (`#1D4ED8`) with a thin light blue underline (`#A5B8F0`), and the address stays hidden behind it. A list item with no link stays plain grey. Applicant systems that read only the page text will not see the address, so keep contact links (website, LinkedIn) as visible text in the header.
- Fonts load one file per weight (separate `<link>` per Inter 400, Inter 500, Geist Mono weight), because variable fonts print to PDF as Type 3 fonts and lose the spaces between words when text is copied.
- In the Word export the child ring is list level 1 (the white bullet glyph) with the same indent as level 0, so children line up under the parent text there too. Inter Medium is the medium weight; pass `--bold` if a viewer lacks it.

## 4. Verify

Run all of these and fix what fails.

```bash
# Style on the Markdown
grep -n "—" docs/resumes/<id>.md
grep -inE "leverag|seamless|unlock|empower" docs/resumes/<id>.md
# The Layout and the Content must say the same thing
node scripts/resume/slide-to-md.mjs <id> --check
```

The last command parses the Layout with the same Babel parser the editor uses, regenerates the Markdown from it, and diffs against `docs/resumes/<id>.md`. `-` lines are the Markdown, `+` lines are the Layout. It exits 1 on any difference, so you cannot finish a sync with the two out of step.

Fit: open each page in the dev server (`pnpm dev`, usually port 5173) at `/s/<id>?p=N`. The first load waits on webfonts, so poll until the Layout mounts, then run:

```js
let root;
for (let i = 0; i < 120 && !(root = document.querySelector('[data-inspector-root]')); i++)
  await new Promise(r => setTimeout(r, 500));
const c = [...root.querySelectorAll('div')].find(d => getComputedStyle(d).maxWidth === '640px');
const s = c.getBoundingClientRect().height / c.clientHeight;
({ client: c.clientHeight, scroll: c.scrollHeight,
   kids: [...c.children].map(k => Math.round(k.getBoundingClientRect().height / s)) })
```

The usable height is 1027px. Add the page's children plus the 24px gaps between them. `scroll > client` means overflow. Leave at least about 100px of slack on every page so a different browser's text wrapping cannot push content off the page. If a page is within 35px of full, move its last entry to the next page.

Also read each page's text (`get_page_text`) and compare against the Markdown.

## Sync back (Layout to Content)

Edits the user makes directly on the Layout in the browser never pass through Claude, so the Markdown goes stale. Run this at the start of any resume session, and whenever the user says they edited the slide:

```bash
node scripts/resume/slide-to-md.mjs <id> --check
```

- **In sync** (exit 0): carry on with the normal flow.
- **Drift** (exit 1): read the diff and decide who wins.
  - Only the Layout changed (the Markdown is unchanged since the last sync, check `git diff docs/resumes/<id>.md`): the Layout wins. Run `--write` to pull the edits into the Markdown, then re-run the style checks in step 4 on the result, because Layout edits bypass them. Tell the user which lines changed.
  - Only the Markdown changed (the user edited the file, the Layout is unchanged): the Markdown wins. Sync it into the Layout as in step 3.
  - Both changed, or you cannot tell: show the user the diff and ask. Never overwrite either side blind.
- `--write` only regenerates the Markdown body. The name and contact line at the top are kept from the existing file, because the Layout builds them from the `CONTACT` const.
- The script only understands this Layout's components (`SectionTitle`, `SkillCell`, `Entry`, `Bullet`, `CompactEntry`, the summary `<p>`). If a new kind of component is added to the Layout, extend the script in the same change, or the new content will be missing from the Markdown.

Anything the Layout edit introduced that is not in the brief's confirmed experience is flagged in the report, the same as for new content.

## Export to Word

`.docx` files are built on demand from the Markdown and are not stored in the repo (`docs/resumes/*.docx` is git-ignored). Do not commit them or regenerate them after edits.

In the editor, open the Download menu and choose Export as DOCX. From the terminal:

```bash
pnpm export:docx <id> [out.docx]
```

Without an output path it writes `docs/resumes/<id>.docx`, which is ignored. The export follows the Layout's design: Inter and Geist Mono, 9pt body, muted greys, the two-column skills grid, spacing and bullet styles from the style guide, A4 with the Layout's margins. Entries never split across pages. If you change the Layout's styling, change the tokens at the top of `scripts/resume/md-to-docx.mjs` too. The one dependency (`docx`) belongs to the `scripts/resume` workspace package, so `pnpm install` at the repo root installs it. The design's medium weight (500) uses the "Inter Medium" family, which Google Docs has; add `--bold` if a viewer lacks it. For Google Docs, upload the file and open it with Docs.

## 5. Report

Say, briefly:

- What changed in the Markdown and Layout, and the page count with the space left on each page.
- JD keyword coverage: which themes are covered and in which category, and which were deliberately not claimed because the brief has no confirmed experience for them (for example a language or tool the job description names that you have not used).
- Anything in the Markdown that is not in the brief's confirmed experience, flagged for the user to confirm before it goes out.

Do not commit or push unless asked.
