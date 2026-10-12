# open-doc — Agent Guide

This repo builds documents, today a resume and a cover letter, authored as open-slide documents under `slides/resume/` and `slides/cover-letter/`. A tailored version of a document is a copy of its folder under a new id (see the `document-from-brief` skill).

## Vocabulary

The project's terms (Document, Resume, Cover letter, Template, Page, Brief, Content, Layout, Drift, Theme, Design) are defined in [`CONTEXT.md`](./CONTEXT.md). Use them in code comments, commit messages and replies.

## Hard rules

- Every document lives in a `slides/<id>/` folder. The two shipped Templates are `slides/resume/index.tsx` and `slides/cover-letter/index.tsx`.
- Put a document's assets (headshot, etc.) under its own `slides/<id>/assets/`.
- Do **not** touch `package.json`, `pnpm-workspace.yaml`, `open-slide.config.ts`, or add anything under `slides/` other than a new Document.
- The framework is vendored in `framework/core/` (a fork of `@open-slide/core`: A4 794×1123 canvas, no speaker notes). Edit it only when the task is about the framework itself, never as part of resume work.
- Do not add dependencies. Use only `react` and standard web APIs.

## Which skill to use

- **Designing or rebuilding a Layout from scratch** (a new look, a new structure, no existing document to start from) — use the `create-slide` skill. For a document the user already has, use `import-document` instead.
- **Applying inspector comments** (`@slide-comment` markers) — use the `apply-comments` skill.
- **The user already has a document** (a resume or cover letter, pasted or as a PDF, "import my resume") — use the `import-document` skill. It writes Content only, then hands over to `sync-document`.
- **Content and Layout may disagree** ("sync", "I edited it in the editor", or at the start of any document session) — use the `sync-document` skill. Check with `pnpm doc:check <id>`.
- **Tailoring a document to a role** (brief, then Content, then Layout) — use the `document-from-brief` skill.
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
