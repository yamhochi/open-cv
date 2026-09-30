# resume-builder — Agent Guide

This repo builds one thing: a resume, authored as an open-slide document under `slides/resume/`.

## Hard rules

- All content lives under `slides/resume/`. The entry is `slides/resume/index.tsx`.
- Put resume-specific assets (headshot, etc.) under `slides/resume/assets/`.
- Do **not** touch `package.json`, `open-slide.config.ts`, or add new top-level slides — this project is scoped to a single resume.
- Do not add dependencies. Use only `react` and standard web APIs.

## Which skill to use

- **Building or rewriting the resume** — use the `create-slide` skill. It has a dedicated "document" flow for resumes: it asks for your source material (an existing resume, PDF, or notes) rather than inventing content, and sizes the page to what you actually have.
- **Applying inspector comments** (`@slide-comment` markers) — use the `apply-comments` skill.
- **Picking or adapting a visual style** — use the `create-theme` skill if you want to extract a reusable theme; otherwise `create-slide` handles one-off styling.
- **Resolving "this page" / "this element"** — use the `current-slide` skill.
- **Any other edit** inside `slides/resume/` — read the `slide-authoring` skill first. It's the technical reference: file contract, canvas size, type scale, palette, layout, assets, self-review checklist.

Keep this file short: hard rules only. All deeper guidance lives in the skills above.

## Updating skills

The skills above are managed by `@open-slide/core`, not committed here. Pull them with:

```
pnpm install
pnpm sync:skills
```

`pnpm dev` also detects drift on startup and offers to sync.
