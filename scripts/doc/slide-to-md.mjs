#!/usr/bin/env node
// Reads a Layout (slides/<id>/index.tsx) and prints the Content (Markdown) it corresponds to, in
// the format documented in framework/core/skills/document-from-brief/references/content-format.md.
// Used to detect and absorb edits made directly in the editor.
//
//   node scripts/doc/slide-to-md.mjs <id>           print
//   node scripts/doc/slide-to-md.mjs <id> --check   diff vs docs/content/<id>.md, exit 1 on Drift
//   node scripts/doc/slide-to-md.mjs <id> --write   overwrite docs/content/<id>.md
//
// Shortcuts: `pnpm doc:check <id>` and `pnpm doc:pull <id>`.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const { parse } = createRequire(join(repo, 'framework/core/package.json'))('@babel/parser');

// The id is the first plain argument and the flag can come before or after it, so both
// `slide-to-md.mjs <id> --check` and `pnpm doc:check <id>` work.
const cliArgs = process.argv.slice(2);
const id = cliArgs.find((a) => !a.startsWith('--'));
const flag = cliArgs.find((a) => a.startsWith('--'));
if (!id) {
  console.error('usage: slide-to-md.mjs <slide-id> [--check|--write]');
  process.exit(2);
}

const slidePath = join(repo, 'slides', id, 'index.tsx');
const mdPath = join(repo, 'docs/content', `${id}.md`);
if (!existsSync(slidePath)) {
  console.log(
    `no layout: slides/${id}/index.tsx does not exist. Create it by copying a Template folder (slides/resume or slides/letter) to slides/${id}/, then sync the Content into it (see the sync-document skill).`,
  );
  process.exit(3);
}
const ast = parse(readFileSync(slidePath, 'utf8'), {
  sourceType: 'module',
  plugins: ['jsx', 'typescript'],
});

const norm = (s) => s.replace(/\s+/g, ' ').trim();

function str(node) {
  if (!node) return undefined;
  if (node.type === 'StringLiteral') return node.value;
  if (node.type === 'JSXExpressionContainer') return str(node.expression);
  if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
    return node.quasis.map((q) => q.value.cooked).join('');
  }
  return undefined;
}

function attr(el, name) {
  const a = el.openingElement.attributes.find(
    (x) => x.type === 'JSXAttribute' && x.name.name === name,
  );
  return a ? str(a.value) : undefined;
}

function text(el) {
  return norm(
    el.children
      .map((c) =>
        c.type === 'JSXText' ? c.value : c.type === 'JSXExpressionContainer' ? (str(c) ?? '') : '',
      )
      .join(''),
  );
}

// Text of a SubBullet-style element: a `text` prop (this repo's templates) or its children.
const itemText = (el) => attr(el, 'text') ?? text(el);

const tag = (el) => el.openingElement.name.name;
const childEls = (el) => el.children.filter((c) => c.type === 'JSXElement');

const out = [];
let seenTitle = false;
let headline;
let lastEntryKey;

function bullet(el) {
  const label = attr(el, 'label');
  const body = attr(el, 'body');
  const subs = childEls(el).filter((c) => tag(c) === 'SubBullet');
  let head;
  if (body === undefined) head = subs.length ? `- **${label}**` : `- ${label}`;
  else {
    const sep = attr(el, 'separator') ?? ': ';
    head = sep.trim() === '.' ? `- **${label}.** ${body}` : `- **${label}**: ${body}`;
  }
  return [head, ...subs.map((c) => `  - ${itemText(c)}`)].join('\n');
}

function visit(el) {
  switch (tag(el)) {
    case 'Header':
      headline = attr(el, 'headline');
      return;
    case 'SectionTitle': {
      seenTitle = true;
      const t = text(el);
      if (/\(continued\)$/.test(t)) return;
      out.push(`\n## ${t}\n`);
      return;
    }
    case 'LetterList':
      for (const b of childEls(el)) {
        const title = attr(b, 'title').replace(/\.$/, '');
        const address = attr(b, 'address');
        const href = attr(b, 'href');
        out.push(`- **${title}.** ${attr(b, 'body')}${address && href ? ` [${address}](${href})` : ''}`);
      }
      out.push('');
      return;
    case 'LetterParagraph':
      if (!out.length) out.push('');
      out.push(itemText(el), '');
      return;
    case 'BulletCell':
      out.push(`**${attr(el, 'title')}**`);
      for (const b of childEls(el)) {
        const link = childEls(b).find((c) => tag(c) === 'LinkText');
        out.push(link ? `- [${attr(link, 'label')}](${attr(link, 'href')})` : `- ${itemText(b)}`);
      }
      out.push('');
      return;
    case 'SkillCell':
      out.push(`**${attr(el, 'title')}**\n${attr(el, 'body')}\n`);
      return;
    case 'Entry': {
      const key = `${attr(el, 'company')}|${attr(el, 'date')}`;
      if (key === lastEntryKey) {
        if (out[out.length - 1] === '') out.pop();
      } else {
        const summary = attr(el, 'summary');
        out.push(
          `### ${attr(el, 'company')} · ${attr(el, 'roleTitle')}\n*${attr(el, 'date')}*${summary ? `\n${summary}` : ''}`,
        );
      }
      lastEntryKey = key;
      for (const b of childEls(el)) out.push(bullet(b));
      out.push('');
      return;
    }
    case 'CompactEntry':
      out.push(`- **${attr(el, 'title')}**: ${attr(el, 'body')}`);
      return;
    case 'p':
      if (!seenTitle) {
        seenTitle = true;
        out.push(`\n## Summary\n\n${text(el)}\n`);
        return;
      }
      break;
    default:
  }
  for (const c of childEls(el)) visit(c);
}

function pageBodies() {
  const decls = new Map();
  let order = [];
  for (const n of ast.program.body) {
    if (n.type === 'VariableDeclaration') {
      for (const d of n.declarations) decls.set(d.id.name, d.init);
    } else if (n.type === 'ExportDefaultDeclaration') {
      const arr =
        n.declaration.type === 'TSSatisfiesExpression' ? n.declaration.expression : n.declaration;
      order = arr.elements.map((e) => e.name);
    }
  }
  return order.map((name) => {
    const body = decls.get(name)?.body;
    return body?.type === 'ParenthesizedExpression' ? body.expression : body;
  });
}

for (const page of pageBodies()) visit(page);

// A Layout built from other components (a Report, for example) has nothing this script can read,
// so say so instead of writing an empty Content file.
if (!out.some((l) => l.trim())) {
  console.log(
    `unsupported: slides/${id}/index.tsx has no Content format. Only resumes and letters can be synced to Markdown; edit this document in its Layout.`,
  );
  process.exit(4);
}

function contactLine() {
  for (const n of ast.program.body) {
    if (n.type !== 'VariableDeclaration') continue;
    for (const d of n.declarations) {
      if (d.id.name !== 'CONTACT') continue;
      const obj = d.init.type === 'TSAsExpression' ? d.init.expression : d.init;
      return obj.properties.map((p) => p.value.value).join(' \u00b7 ');
    }
  }
  return 'contact line';
}

function headerName() {
  let found;
  (function walk(node) {
    if (found || !node || typeof node.type !== 'string') return;
    if (node.type === 'JSXText' && node.value.trim()) {
      found = node.value.trim();
      return;
    }
    for (const k of Object.keys(node)) {
      const v = node[k];
      if (Array.isArray(v)) v.forEach(walk);
      else if (v && typeof v === 'object') walk(v);
    }
  })(
    ast.program.body
      .filter((n) => n.type === 'VariableDeclaration')
      .flatMap((n) => n.declarations)
      .find((d) => d.id.name === 'Header')?.init,
  );
  return found ?? 'Name';
}

// Name and contact line come from the Header and CONTACT const, so keep what the Markdown already has.
// A slide with no Markdown yet gets a fresh header built from the slide.
const header = existsSync(mdPath)
  ? (readFileSync(mdPath, 'utf8').match(/^---\n[\s\S]*?\n---\n\n# .+\n\n.+/)?.[0] ??
    readFileSync(mdPath, 'utf8').split('\n## Summary')[0].trimEnd())
  : `---\nslide: ${id}\n---\n\n# ${headerName()}\n\n${contactLine()}`;
const headerWithHeadline = header
  .split('\n')
  .filter((l) => !l.startsWith('headline:'))
  .flatMap((l) => (l.startsWith('brief:') && headline ? [l, `headline: ${headline}`] : [l]))
  .join('\n');
const body = out
  .join('\n')
  .replace(/\n{3,}/g, '\n\n')
  .replace(/\n*$/, '\n');
const result = `${headerWithHeadline}\n${body}`;

if (flag === '--write') {
  writeFileSync(mdPath, result);
  console.log(`wrote ${mdPath}`);
} else if (flag === '--check') {
  if (!existsSync(mdPath)) {
    console.log(
      `missing: docs/content/${id}.md does not exist. Every resume or letter needs one, create it with --write.`,
    );
    process.exit(1);
  }
  const tmp = join(mkdtempSync(join(tmpdir(), 'resume-')), 'slide.md');
  writeFileSync(tmp, result);
  const d = spawnSync(
    'diff',
    ['-u', '--label', `docs/content/${id}.md`, '--label', `slide ${id}`, mdPath, tmp],
    {
      encoding: 'utf8',
    },
  );
  if (d.status === 0) {
    console.log('in sync: slide matches the Markdown');
  } else {
    console.log(d.stdout);
    console.log('drift: slide and Markdown differ (- is the Markdown, + is the slide)');
    process.exit(1);
  }
} else {
  process.stdout.write(result);
}
