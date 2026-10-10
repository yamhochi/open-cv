import fs from 'node:fs/promises';
import path from 'node:path';

// The Word exporter lives in the project, not in this package, so it can follow the project's
// resume design: scripts/resume/md-to-docx.mjs reads docs/resumes/<id>.md.
const SCRIPT = path.join('scripts', 'resume', 'md-to-docx.mjs');

export async function findResumeScript(from: string): Promise<string | null> {
  let dir = from;
  for (;;) {
    const candidate = path.join(dir, SCRIPT);
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export const resumeRootOf = (script: string): string => path.resolve(path.dirname(script), '../..');

export const resumeMarkdownPath = (root: string, slideId: string): string =>
  path.join(root, 'docs', 'resumes', `${slideId}.md`);

// Duplicating a slide also copies its Markdown, so the copy keeps a source of truth.
export async function copyResumeMarkdown(
  userCwd: string,
  fromId: string,
  toId: string,
): Promise<void> {
  const script = await findResumeScript(userCwd);
  if (!script) return;
  const root = resumeRootOf(script);
  let source: string;
  try {
    source = await fs.readFile(resumeMarkdownPath(root, fromId), 'utf8');
  } catch {
    return;
  }
  const target = resumeMarkdownPath(root, toId);
  try {
    await fs.access(target);
    return;
  } catch {}
  await fs.writeFile(target, source.replace(/^slide: .*$/m, `slide: ${toId}`));
}
