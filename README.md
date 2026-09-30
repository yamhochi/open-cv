# resume-builder

A resume, as code. Built on [open-slide](https://www.npmjs.com/package/@open-slide/core) — your resume is a React component rendered onto a fixed-size page, so layout, spacing, and print output are exact instead of fighting a Word template.

## Getting started

```bash
pnpm install
pnpm sync:skills
pnpm dev
```

Then open the dev server and ask your coding agent to build your resume — point it at an existing resume, PDF, or notes, and it will lay out `slides/resume/index.tsx` to match. Edit the file directly if you'd rather write it by hand.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the dev server with hot reload. |
| `pnpm build` | Build a static bundle you can deploy or print to PDF. |
| `pnpm preview` | Preview the built bundle locally. |
| `pnpm sync:skills` | Pull the latest authoring skills from `@open-slide/core`. |

## Authoring

Your resume lives entirely in `slides/resume/index.tsx` and default-exports an array of page components:

```tsx
// slides/resume/index.tsx
import type { Page, SlideMeta } from '@open-slide/core';

const ResumePage: Page = () => (
  <div style={{ width: '100%', height: '100%' }}>Your resume here</div>
);

export const meta: SlideMeta = { title: 'Resume' };
export default [ResumePage] satisfies Page[];
```

See [`AGENTS.md`](./AGENTS.md) for the full authoring guide and which skill to use for what.

## Claude Code integration

This project ships with Claude Code skills (pulled via `pnpm sync:skills`) under `.claude/skills/` and `.agents/skills/`. Ask your agent to "build my resume" and the `create-slide` skill takes over — it asks for your source material rather than inventing content.

## Updating the framework

```bash
pnpm up @open-slide/core
pnpm sync:skills
```

## License

MIT
