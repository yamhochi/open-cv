# open-cv

A resume, as code. Your resume is a React component rendered onto a fixed **A4 page (794 × 1123 px)**, so layout, spacing and print output are exact instead of fighting a Word template. Edit it in a live visual editor, or hand it to a coding agent.

![open-cv editor showing a two-page A4 resume template](docs/screenshot.png)

Built on [open-slide](https://github.com/open-slide/open-slide) by [Yiwei Ho](https://github.com/1weiho), adapted here for documents. See [how this differs from open-slide](docs/FORK.md).

## Get started

You need [Node.js](https://nodejs.org) 20.19+ (or 22.12+) and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/yamhochi/open-cv.git
cd open-cv
pnpm install
pnpm sync:skills
pnpm dev
```

Open the address `pnpm dev` prints (usually <http://localhost:5173>). You will see the two Templates, a placeholder resume and a placeholder cover letter. The steps below turn them into yours.

## How to use it

Open the project in Claude Code (or another coding agent that reads `.claude/skills`) and talk to it. Each resume is two files that carry the same words: the **Content** (`docs/resumes/<id>.md`, plain Markdown) and the **Layout** (`slides/<id>/index.tsx`, the page file the editor shows). The skills keep them in step. The terms are defined in [`CONTEXT.md`](./CONTEXT.md).

### 1. Start from the resume you already have

Say **"import my resume"** and paste it, or give a path to a PDF or text file.

- The `import-resume` skill writes your words into `docs/resumes/resume.md`, keeping your wording and only putting it into the fixed Markdown shape. It tells you anything it could not place cleanly.
- It then hands over to `sync-resume`, which builds the Layout from that Content, fits it onto A4 Pages and checks it.
- Open the editor to see it. Read the Markdown first if you want to correct anything before the layout is built.

### 2. Keep chatting to change it

Ask for changes in plain language: "shorten the summary", "put the second role on page two", "make the section headings smaller". Wording changes go to the Content and are synced into the Layout. Visual changes go straight to the Layout.

You can also edit in the editor yourself by double-clicking text. The Markdown is then out of date, which the project calls **Drift**. Say **"sync"** and `sync-resume` finds which side changed and brings the other into line. It asks you before overwriting anything if both changed.

### 3. Tailor it to a role

Copy `docs/resume-briefs/example.md` to a new file and fill it in with the job description and the facts you can stand behind. Then say **"tailor my resume for this role"**. The `resume-from-brief` skill writes new Content from the brief, using only your confirmed experience, syncs it into a copy of your Layout under a new id, and checks the fit. Make one copy per role.

### 4. Check and export

- **Download** in the editor toolbar exports a PDF. The menu also has HTML, PPTX and Word. PDF export needs a Chromium-based browser.
- The PDF comes from the Layout, and the Word file comes from the Content, so run a sync first if you have edited in the editor. `pnpm resume:check <id>` tells you whether they match.

| You say | Skill | What it does |
| --- | --- | --- |
| "import my resume" | `import-resume` | Pasted or file resume in, Content out, then a sync. |
| "sync" or "I edited it in the editor" | `sync-resume` | Finds the side that changed and updates the other. |
| "tailor it for this role" | `resume-from-brief` | Brief to Content to Layout, with a fit check. |

Everything else is ordinary chat: "move this", "reword that", "add a link".

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the editor with hot reload. |
| `pnpm build` | Build a static bundle you can deploy. |
| `pnpm preview` | Preview the built bundle locally. |
| `pnpm sync:skills` | Copy the skills from `framework/core/skills/` into `.claude/skills` and `.agents/skills` for your coding agent. |
| `pnpm resume:check <id>` | Report whether the Content and Layout match (exit 1 on drift). |
| `pnpm resume:pull <id>` | Rewrite the Content from the Layout, to absorb editor edits. |
| `pnpm export:docx <id> [out.docx]` | Build a Word file from the Content. The files are git-ignored. |

## How a resume is written

`slides/resume/index.tsx` default-exports an array of page components, one per A4 page:

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

- **The page is fixed at 794 × 1123.** Content past the bottom edge is cropped, so when a section overflows, move whole entries to the next page.
- **Use pixel values** for type and spacing (the template uses 12px body text and 48px padding).
- **Build bullets as components.** Write each bullet as `<Bullet label="…">` with nested `<SubBullet text="…" />` children. Don't use one paragraph or a `.map()`. This keeps every line separately editable in the visual editor.
- **Assets** (a headshot, for example) go in `slides/resume/assets/`.

[`AGENTS.md`](./AGENTS.md) has the full rules for coding agents.

## Present mode

Present mode shows the page at 100% (794px wide on screen), centered. Scroll to see the rest of the page. Use the left and right arrow keys to change pages.

## Credits and license

MIT. This project includes code from [open-slide](https://github.com/open-slide/open-slide) (MIT, © Yiwei Ho); see [`framework/core/LICENSE`](./framework/core/LICENSE). What was changed, and how to pull in upstream updates, is in [docs/FORK.md](docs/FORK.md).
