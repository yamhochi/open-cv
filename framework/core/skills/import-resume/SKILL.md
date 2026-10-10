---
name: import-resume
description: Turn a resume or cover letter the user already has into Content, the Markdown file in docs/resumes, so it can be synced into a Layout. Use when the user pastes a resume, shares a PDF or text file of one, says "import my resume", "start from my existing resume", "set up my resume" or "use this resume", or asks to begin from something they already wrote. Writes Content only, then hands off to the sync-resume skill.
---

# Import a resume

Turns what the user already has into **Content** (`docs/resumes/<id>.md`). Content comes first so the user can read and correct plain Markdown before any Layout exists. This skill never writes the Layout. Hand off to `sync-resume` for that.

Use the project's words from `CONTEXT.md`: Resume, Cover letter, Content, Layout, Page.

## 1. Get the source

- Pasted text: use it as given.
- A PDF or a text or Markdown file: read it with the Read tool. If the text comes out scrambled (columns interleaved, missing spaces), say so and ask the user to paste it.
- A Word file: ask the user to export it to PDF or paste the text. This skill does not read `.docx`.
- A Cover letter is imported the same way, and the grammar differs (see the format reference).

Never invent content. The only facts are the ones in the source.

## 2. Choose where it goes

- Default id: `resume` for a Resume, `cover-letter` for a Cover letter. Those folders ship as untouched **Templates** with placeholder text.
- If `docs/resumes/<id>.md` is still the Template's placeholder, replacing it is the expected first import. Say that you are replacing the placeholder.
- If it holds real content, do not overwrite it. Check `git status` and `git diff docs/resumes/<id>.md`, then ask whether to use a new id (a copy for another role) or replace.

## 3. Write the Content

Follow [the Content format](../resume-from-brief/references/content-format.md) exactly. The sync script and the Word export both depend on it.

- Keep the user's wording. Restructure it into the grammar, and fix only obvious typos and inconsistent date formats (use an en dash). Do not rewrite, tighten or improve it. Tailoring is a separate job, done with the `resume-from-brief` skill.
- Put the name and contact line at the top, from the source.
- Map each source section to the nearest grammar element: summary, core skills (`SkillCell`), experience (`Entry` with bullets), talks and education (`CompactEntry`), links (`BulletCell`).
- Any section heading is fine (Volunteering, Languages, Publications): write it as its own `##` section. A list of `Title: detail` rows becomes compact rows. A list of links becomes a `**Title**` list of `- [label](url)` items.
- Put contact details in the form the format reference shows (for example `linkedin.com/in/name` becomes `in/name`, a bare website has no `https://`).
- A bullet with a bold lead becomes `- **Lead**: rest` or `- **Lead.** rest`. A sentence with no lead stays a plain bullet. Nested bullets are one level only.

## 4. Flag what did not fit

List, briefly, anything you could not place cleanly, and say what you did with it:

- text in a compact row that is really a link (an article URL): it stays plain text there, so say so and offer to move it into a links list
- more than two bullet levels: fold the deepest level into its parent's sentence (do not drop it), say where
- missing dates: write the marker `*Dates needed*` and say which role. Never invent a date.
- ambiguous dates, or text you could not read
- anything that looks like a fact you would want the user to confirm

## 5. Hand off

Run the `sync-resume` skill for the same id so the Layout is built from the new Content, fitted to Pages, and checked. Then tell the user what was imported, the flagged items, and how many Pages it came to.

Do not commit or push unless asked.
