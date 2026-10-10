# open-cv — Agent Guide

This repo builds a resume and its cover letter, authored as open-slide documents under `slides/resume/` and `slides/cover-letter/`. A tailored version of either is a copy of its folder under a new id (see the `resume-from-brief` skill).

## Vocabulary

The project's terms (Resume, Cover letter, Template, Page, Brief, Content, Layout, Drift, Theme, Design) are defined in [`CONTEXT.md`](./CONTEXT.md). Use them in code comments, commit messages and replies.

## Hard rules

- All content lives in `slides/<id>/` folders. The entries are `slides/resume/index.tsx` and `slides/cover-letter/index.tsx`.
- Put a document's assets (headshot, etc.) under its own `slides/<id>/assets/`.
- Do **not** touch `package.json`, `pnpm-workspace.yaml`, `open-slide.config.ts`, or add anything under `slides/` other than a new Resume or Cover letter.
- The framework is vendored in `framework/core/` (a fork of `@open-slide/core`: A4 794×1123 canvas, no speaker notes). Edit it only when the task is about the framework itself, never as part of resume work.
- Do not add dependencies. Use only `react` and standard web APIs.

## Which skill to use

- **Building or rewriting the resume** — use the `create-slide` skill. It has a dedicated "document" flow for resumes: it asks for your source material (an existing resume, PDF, or notes) rather than inventing content, and sizes the page to what you actually have.
- **Applying inspector comments** (`@slide-comment` markers) — use the `apply-comments` skill.
- **Tailoring the resume to a role** (brief, then Markdown, then slide, with sync both ways and the Word export) — use the `resume-from-brief` skill.
- **Picking or adapting a visual style** — use the `create-theme` skill if you want to extract a reusable theme; otherwise `create-slide` handles one-off styling.
- **Resolving "this page" / "this element"** — use the `current-slide` skill.
- **Any other edit** inside `slides/resume/` — read the `slide-authoring` skill first. It's the technical reference: file contract, canvas size, type scale, palette, layout, assets, self-review checklist.

Keep this file short: hard rules only. All deeper guidance lives in the skills above.

## Updating skills

The skills above live in `framework/core/skills/` (the vendored framework) and are copied into `.claude/skills` and `.agents/skills`, which are not committed. Refresh the copies with:

```
pnpm install
pnpm sync:skills
```

`pnpm dev` also detects drift on startup and offers to sync.
