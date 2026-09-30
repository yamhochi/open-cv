# resume-builder

A resume, as code. Your resume is a React component rendered onto a fixed **A4 page (794 × 1123 px)**, so layout, spacing and print output are exact instead of fighting a Word template.

It runs on a local fork of [open-slide](https://github.com/open-slide/open-slide), vendored in [`framework/core/`](./framework/core) and adapted for documents (see [What's different](#whats-different-from-open-slide)).

## Getting started

```bash
git clone <this repo>
cd resume-builder
pnpm install
pnpm sync:skills
pnpm dev
```

Open the dev server, then either edit `slides/resume/index.tsx` by hand or ask your coding agent to build your resume. Point it at an existing resume, PDF or notes and it will lay the pages out to match. It asks for your source material rather than inventing content.

`pnpm install` links the local framework in `framework/core/` and installs its dependencies. It never overwrites your files.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server with hot reload. |
| `pnpm build` | Build a static bundle you can deploy. |
| `pnpm preview` | Preview the built bundle locally. |
| `pnpm sync:skills` | Copy the authoring skills from `framework/core/skills/` into `.claude/skills` and `.agents/skills` for your coding agent. |

## Authoring

Your resume lives in `slides/resume/index.tsx` and default-exports an array of page components, one per A4 page:

```tsx
import type { Page, SlideMeta } from '@open-slide/core';

const ResumePage: Page = () => (
  <div style={{ width: '100%', height: '100%', padding: 48, boxSizing: 'border-box' }}>
    Your resume here
  </div>
);

export const meta: SlideMeta = { title: 'Resume' };
export default [ResumePage] satisfies Page[];
```

Things to know:

- **The page is fixed at 794 × 1123.** Content past the bottom edge is cropped, so when a section overflows, move whole entries to the next page.
- **Use pixel values** for type and spacing (the template uses 12px body text and 48px padding).
- **Build bullets as components.** Write each bullet as `<Bullet label="…">` with nested `<SubBullet text="…" />` children. Don't use one paragraph or a `.map()`. This keeps every line separately editable in the visual editor.
- **Assets** (a headshot, for example) go in `slides/resume/assets/`.

[`AGENTS.md`](./AGENTS.md) has the full rules and says which skill to use for what.

## Present mode

Present mode shows the page at 100% (794px wide on screen), centered. Scroll to see the rest of the page. Use the left and right arrow keys to change pages. Up, down, space and page up/down scroll.

## Working with Claude Code

The project ships with authoring skills under `.claude/skills/` and `.agents/skills/` (created by `pnpm sync:skills`). Ask your agent to "build my resume" and the `create-slide` skill takes over. Edit the skills in `framework/core/skills/`, not the copies, then run `pnpm sync:skills` again.

## What's different from open-slide

This is a fork of `@open-slide/core` 2.0.1. Changes so far:

- **A4 canvas** (794 × 1123) instead of 1920 × 1080, including portrait thumbnails and export units.
- **Present mode at 100%** with scrolling, described above.
- **Speaker notes removed** (the notes drawer, the presenter-view panel, the `notes` export and PPTX notes).
- **UI renamed:** "slide" is now "template", and the app title is "resume-builder".
- **Authoring skills rewritten** for a document-sized page.

`framework/core/dist/` was patched by hand and there is no build step for it here. If you change `framework/core/src/`, check whether the built files need the same change.

## Updating from upstream

Don't run `pnpm up @open-slide/core`. It would replace the local fork with the npm package and undo the changes above. To take a newer upstream version, diff it against `framework/core/` and port the changes over by hand.

## License

MIT. Includes code from open-slide (MIT, © Yiwei Ho); see [`framework/core/LICENSE`](./framework/core/LICENSE).
