import fs from 'node:fs/promises';
import path from 'node:path';

// The Word exporter lives in the project, not in this package, so it can follow the project's
// document design: scripts/doc/md-to-docx.mjs reads docs/content/<id>.md.
const SCRIPT = path.join('scripts', 'doc', 'md-to-docx.mjs');

export async function findDocScript(from: string): Promise<string | null> {
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

export const docRootOf = (script: string): string => path.resolve(path.dirname(script), '../..');

export const docMarkdownPath = (root: string, slideId: string): string =>
  path.join(root, 'docs', 'content', `${slideId}.md`);

// Duplicating a slide also copies its Markdown, so the copy keeps a source of truth.
export async function copyDocMarkdown(
  userCwd: string,
  fromId: string,
  toId: string,
): Promise<void> {
  const script = await findDocScript(userCwd);
  if (!script) return;
  const root = docRootOf(script);
  let source: string;
  try {
    source = await fs.readFile(docMarkdownPath(root, fromId), 'utf8');
  } catch {
    return;
  }
  const target = docMarkdownPath(root, toId);
  try {
    await fs.access(target);
    return;
  } catch {}
  await fs.writeFile(target, source.replace(/^slide: .*$/m, `slide: ${toId}`));
}
