# Content format

The Markdown grammar for a Resume's or Cover letter's Content (`docs/resumes/<id>.md`). `scripts/resume/slide-to-md.mjs` writes it from a Layout and compares against it, and `scripts/resume/md-to-docx.mjs` reads it for the Word export, so a Content file must follow this shape exactly. Anything outside it is lost on the next pull from the Layout.

## File shape

```markdown
---
slide: <id>
brief: docs/resume-briefs/<role>.md   (optional)
headline: A line under the name        (optional, omit to render none)
---

# Name

email · phone · website · linkedin

## Summary
...
```

- `slide:` is the folder name under `slides/` (the key keeps upstream's word).
- The name and contact line are kept from the Content file. The Layout builds them from its `CONTACT` const, so retype neither in the Layout.
- Dates use an en dash (for example `Jan 2023 – Present`).

## Resume

| Markdown | Layout component |
| --- | --- |
| `# Name` + contact line | `Header` (contact from the `CONTACT` const) |
| `## Summary` paragraph | the summary `<p>` |
| `## Core skills and expertise`, each `**Category**` then body | `SkillCell title body`, in a 2-column grid |
| `### Company · Role` then `*Dates*` | `Entry company roleTitle date` |
| a plain line right under the dates | `Entry summary` (one line of context for the role) |
| `- **Lead.** rest` | `Bullet label=Lead separator=". " body=rest` |
| `- **Lead**: rest` | `Bullet label=Lead body=rest` |
| `- A full sentence.` | `Bullet label="A full sentence."` (label only, regular weight) |
| `- **Parent**` followed by indented `  - child` lines | `Bullet label=Parent` with one `SubBullet` per child |
| talks, education `- **Title**: detail` | `CompactEntry title body` |
| `**Title**` then `- item` lines (a list in a skills cell) | `BulletCell title` with one `SubBullet` per item |
| `- [label](https://url)` inside a `BulletCell` | a `SubBullet` holding a `LinkText` (the address stays hidden behind the label) |

Sections:

- Any `##` heading is allowed. The Layout and the Word export tell sections apart by their **shape**, not their title:
  - contains `###` entries: experience-style entries
  - contains `**Title**` lines (a body, or a list of items and links): skills-style cells
  - only `- **Title**: detail` rows: a compact list. Two compact sections in a row sit side by side in two columns.
- A role whose dates are unknown gets the visible marker `*Dates needed*` (never an invented date), and is flagged to the user.
- A compact row's text is plain: it cannot hold a link. Put links in a `**Title**` list (a skills-style cell) instead.

Rules:

- One parent level and one child level only. A bold line with no body and no children is not valid: add children or drop the bold.
- A `## ... (continued)` heading is a continuation on the next Page. It is not written to Content.
- Do not use more than two bullet levels or any other Markdown (tables, images, code). The Layout has no component for them.

## Cover letter

| Markdown | Layout component |
| --- | --- |
| each paragraph, including the salutation and the sign-off | `LetterParagraph` |
| `- **Title.** sentence [address](https://url)` | `LetterBullet title body href address`, inside a `LetterList` |

A cover letter has no `##` sections.
