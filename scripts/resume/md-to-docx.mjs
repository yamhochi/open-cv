#!/usr/bin/env node
// Exports docs/resumes/<id>.md to a .docx that follows the resume slide's design.
//
//   node scripts/resume/md-to-docx.mjs <slide-id> [out.docx]
//
// Default output: docs/resumes/<id>.docx. Reads the Markdown only, so run slide-to-md.mjs --check
// first if the slide may have been edited. Design tokens below mirror
// slides/resume/index.tsx; 1 CSS px = 15 twips = 0.75pt.
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  VerticalAlign,
  WidthType,
} from 'docx';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const flags = process.argv.slice(2).filter((a) => a.startsWith('--'));
const [id, outArg] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const MEDIUM_FONT = flags.includes('--bold')
  ? undefined
  : (flags.find((f) => f.startsWith('--medium-font='))?.split('=')[1] ?? 'Inter Medium');
if (!id) {
  console.error(
    'usage: md-to-docx.mjs <slide-id> [out.docx] [--bold | --medium-font="Inter Medium"]',
  );
  process.exit(2);
}

const px = (n) => Math.round(n * 15);
const SANS = 'Inter';
const MONO = 'Geist Mono';
const TEXT = '21201C';
const MUTED = '63635E';
const HAIR = 'E6E4DF';
const BODY = 18;
const TITLE = 21;
const CONTACT_SIZE = 17;
const PAGE_W = 11906;
const SIDE = px(77);
const CONTENT_W = PAGE_W - SIDE * 2;
const SECTION_GAP = px(24);
const ITEM_GAP = px(20);
const TIGHT = px(4);

// Contact parts that should be clickable are worked out from their text: a handle such as
// in/yourname becomes a LinkedIn link and a bare domain becomes an https link. Emails and
// phone numbers stay plain text.
function linkFor(part) {
  if (/^in\/[\w-]+\/?$/.test(part)) return `https://www.linkedin.com/${part}`;
  if (/^[\w-]+(\.[\w-]+)+(\/\S*)?$/.test(part) && !part.includes('@')) return `https://${part}`;
  return undefined;
}

// The design's 500 weight uses the "Inter Medium" family, which Google Docs provides. Without it
// (for example Word with only Inter installed) pass --bold to fall back to bold.
const run = (text, o = {}) =>
  new TextRun({
    text,
    font: o.mono ? MONO : o.medium && MEDIUM_FONT ? MEDIUM_FONT : SANS,
    size: o.size ?? BODY,
    bold: o.medium && !MEDIUM_FONT,
    color: o.color ?? MUTED,
    underline: o.underline ? { type: 'single', color: 'A5B8F0' } : undefined,
    characterSpacing: -2,
  });

function inline(text, o = {}) {
  return text
    .split(/(\*\*[^*]+\*\*)/)
    .filter(Boolean)
    .map((part) =>
      part.startsWith('**') ? run(part.slice(2, -2), { ...o, medium: true }) : run(part, o),
    );
}

const line = (mult) => ({ line: Math.round(240 * mult), lineRule: 'auto' });

const md = readFileSync(join(repo, 'docs/resumes', `${id}.md`), 'utf8');
const rows = md.replace(/^---\n[\s\S]*?\n---\n/, '').split('\n');

const name = rows
  .find((l) => l.startsWith('# '))
  .slice(2)
  .trim();
const contact = rows[rows.findIndex((l) => l.startsWith('# ')) + 2].trim();

const sections = [];
let cur;
for (let i = 0; i < rows.length; i++) {
  const l = rows[i];
  if (l.startsWith('## ')) {
    cur = { title: l.slice(3).trim(), rows: [] };
    sections.push(cur);
  } else if (cur) cur.rows.push(l);
}

function contactRuns() {
  return contact.split(' · ').flatMap((part, i) => {
    const sep = i ? [run('  ·  ', { mono: true, size: CONTACT_SIZE })] : [];
    const href = linkFor(part);
    const r = run(part, { mono: true, size: CONTACT_SIZE });
    return [
      ...sep,
      href
        ? new ExternalHyperlink({
            link: href,
            children: [
              new TextRun({
                text: part,
                font: MONO,
                size: CONTACT_SIZE,
                color: MUTED,
                characterSpacing: -2,
              }),
            ],
          })
        : r,
    ];
  });
}

const sectionTitle = (text, before = SECTION_GAP) =>
  new Paragraph({
    keepNext: true,
    spacing: { before, after: ITEM_GAP },
    children: [run(text, { size: TITLE, medium: true, color: TEXT })],
  });

const noBorders = {
  top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
  right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
};

const LEFT_W = Math.round(CONTENT_W * 0.3);
const GUTTER = ITEM_GAP;
const COL_W = (CONTENT_W - GUTTER) / 2;

function twoCol(left, right, rowGap = 0) {
  const cell = (children, i) =>
    new TableCell({
      borders: noBorders,
      width: { size: i === 0 ? COL_W : COL_W + GUTTER, type: WidthType.DXA },
      margins: {
        top: 0,
        bottom: rowGap,
        left: i === 0 ? 0 : GUTTER,
        right: 0,
      },
      children,
    });
  return new TableRow({
    cantSplit: true,
    children: [cell(left, 0), cell(right, 1)],
  });
}

function table(tableRows) {
  return new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [COL_W, COL_W + GUTTER],
    borders: {
      ...noBorders,
      insideHorizontal: noBorders.top,
      insideVertical: noBorders.top,
    },
    rows: tableRows,
  });
}

function skillCell(title, body) {
  return [
    new Paragraph({
      spacing: { after: px(2) },
      children: [run(title, { medium: true, color: TEXT })],
    }),
    new Paragraph({ spacing: { after: ITEM_GAP, ...line(1.4) }, children: [run(body)] }),
  ];
}

const linkRun = (text, href, o = {}) =>
  new ExternalHyperlink({ link: href, children: [run(text, o)] });

function bulletCell(title, items) {
  return [
    new Paragraph({
      keepNext: true,
      spacing: { after: px(2) },
      children: [run(title, { medium: true, color: TEXT })],
    }),
    ...items.map((text, i) => {
      const link = text.match(/^\[(.+?)\]\((.+?)\)$/);
      return new Paragraph({
        spacing: { after: i === items.length - 1 ? ITEM_GAP : 0, ...line(1.4) },
        numbering: { reference: 'dots', level: 1 },
        children: link
          ? [linkRun(`${link[1]} \u2197`, link[2], { color: '1D4ED8', underline: true })]
          : inline(text),
      });
    }),
  ];
}

function skillsGrid(sec) {
  const cells = [];
  for (let i = 0; i < sec.rows.length; i++) {
    const m = sec.rows[i].trim().match(/^\*\*(.+)\*\*$/);
    if (!m) continue;
    const items = [];
    while (i + 1 < sec.rows.length && sec.rows[i + 1].startsWith('- ')) {
      items.push(sec.rows[++i].slice(2).trim());
    }
    if (items.length) cells.push(bulletCell(m[1], items));
    else cells.push(skillCell(m[1], sec.rows[++i].trim()));
  }
  const trs = [];
  for (let i = 0; i < cells.length; i += 2) {
    trs.push(twoCol(cells[i], cells[i + 1] ?? [new Paragraph({ children: [] })]));
  }
  return [table(trs)];
}

function entries(sec) {
  const out = [];
  const list = sec.rows;
  for (let i = 0; i < list.length; i++) {
    const l = list[i];
    if (!l.startsWith('### ')) continue;
    const heading = l.slice(4).trim();
    const date = (list[i + 1] ?? '').trim().replace(/^\*|\*$/g, '');
    i++;
    const bullets = [];
    let summary = '';
    while (i + 1 < list.length && !list[i + 1].startsWith('### ')) {
      i++;
      const row = list[i];
      if (!row.trim()) continue;
      if (!bullets.length && !/^\s*- /.test(row)) summary = row.trim();
      else bullets.push(row);
    }
    out.push(
      new Paragraph({
        keepNext: true,
        keepLines: true,
        spacing: { before: out.length ? ITEM_GAP : 0, after: TIGHT },
        children: [run(date, { mono: true })],
      }),
      new Paragraph({
        keepNext: true,
        keepLines: true,
        spacing: { after: TIGHT },
        children: [run(heading.replace(/ · /g, ' · '), { medium: true, color: TEXT })],
      }),
    );
    if (summary) {
      out.push(
        new Paragraph({
          keepNext: true,
          keepLines: true,
          spacing: { after: TIGHT, ...line(1.5) },
          children: [run(summary)],
        }),
      );
    }
    bullets.forEach((b, bi) => {
      const sub = /^ {2,}- /.test(b);
      const text = b.replace(/^\s*- /, '').trim();
      const hasChildren = !sub && /^\*\*[^*]+\*\*\s*$/.test(text);
      const nextIsSub = /^ {2,}- /.test(bullets[bi + 1] ?? '');
      out.push(
        new Paragraph({
          keepLines: true,
          keepNext: bi < bullets.length - 1 && (nextIsSub || hasChildren),
          spacing: { after: TIGHT, ...line(1.5) },
          numbering: { reference: 'dots', level: sub ? 1 : 0 },
          children: inline(text),
        }),
      );
    });
  }
  return out;
}

function compact(sec) {
  return sec.rows
    .filter((l) => l.startsWith('- '))
    .map((l, i, all) => {
      const m = l.slice(2).match(/^\*\*(.+?)\*\*:?\s*(.*)$/);
      return new Paragraph({
        keepLines: true,
        spacing: { after: i < all.length - 1 ? TIGHT : 0, ...line(1.5) },
        children: m
          ? [run(`${m[1]}: `, { medium: true, color: TEXT }), run(m[2])]
          : inline(l.slice(2)),
      });
    });
}

const headerCell = (children, width, align) =>
  new TableCell({
    borders: noBorders,
    width: { size: width, type: WidthType.DXA },
    margins: { top: 0, bottom: 0, left: 0, right: 0 },
    verticalAlign: VerticalAlign.BOTTOM,
    children: [new Paragraph({ alignment: align, children })],
  });

const children = [
  new Table({
    layout: TableLayoutType.FIXED,
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [LEFT_W, CONTENT_W - LEFT_W],
    borders: { ...noBorders, insideHorizontal: noBorders.top, insideVertical: noBorders.top },
    rows: [
      new TableRow({
        children: [
          headerCell(
            [run(name, { size: TITLE + 7, medium: true, color: TEXT })],
            LEFT_W,
            AlignmentType.LEFT,
          ),
          headerCell(contactRuns(), CONTENT_W - LEFT_W, AlignmentType.RIGHT),
        ],
      }),
    ],
  }),
  new Paragraph({ spacing: { after: SECTION_GAP - 200 }, children: [] }),
];

function letterRuns(text, color) {
  return text
    .split(/(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/)
    .filter(Boolean)
    .map((part) => {
      const link = part.match(/^\[(.+?)\]\((.+?)\)$/);
      if (link) return linkRun(link[1], link[2], { color: '1D4ED8', underline: true });
      if (part.startsWith('**')) return run(part.slice(2, -2), { medium: true, color: TEXT });
      return run(part, { color });
    });
}

if (!sections.length) {
  const start = rows.findIndex((l) => l.startsWith('# ')) + 3;
  const blocks = rows
    .slice(start)
    .join('\n')
    .split(/\n{2,}/)
    .map((x) => x.trim())
    .filter(Boolean);
  blocks.forEach((block, i) => {
    if (block.startsWith('- ')) {
      for (const item of block.split('\n')) {
        children.push(
          new Paragraph({
            spacing: { after: px(8), ...line(1.6) },
            keepLines: true,
            numbering: { reference: 'dots', level: 0 },
            children: letterRuns(item.slice(2), MUTED),
          }),
        );
      }
      return;
    }
    const salutation = i === 0 || i >= blocks.length - 2;
    children.push(
      new Paragraph({
        spacing: { after: px(12), ...line(1.6) },
        keepLines: true,
        children: letterRuns(block, salutation ? TEXT : MUTED),
      }),
    );
  });
}

let firstTitle = true;
for (let s = 0; s < sections.length; s++) {
  const sec = sections[s];
  const t = (text) => {
    const p = sectionTitle(text, firstTitle ? 0 : SECTION_GAP);
    firstTitle = false;
    return p;
  };
  const isCompact = (x) => /^(Talks|Education)/.test(x.title);

  if (sec.title === 'Summary') {
    firstTitle = false;
    children.push(
      new Paragraph({
        spacing: { after: 0, ...line(1.45) },
        children: [run(sec.rows.find((l) => l.trim()).trim())],
      }),
    );
  } else if (sec.title.startsWith('Core skills')) {
    children.push(t(sec.title), ...skillsGrid(sec));
  } else if (isCompact(sec) && sections[s + 1] && isCompact(sections[s + 1])) {
    const next = sections[++s];
    const colWith = (x) => [
      new Paragraph({
        keepNext: true,
        spacing: { after: ITEM_GAP },
        children: [run(x.title, { size: TITLE, medium: true, color: TEXT })],
      }),
      ...compact(x),
    ];
    children.push(
      new Paragraph({ spacing: { before: SECTION_GAP, after: 0 }, children: [] }),
      table([twoCol(colWith(sec), colWith(next))]),
    );
    firstTitle = false;
  } else {
    children.push(t(sec.title), ...entries(sec));
  }
}

children.push(
  new Paragraph({
    spacing: { before: SECTION_GAP },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: HAIR, space: 8 } },
    children: contactRuns(),
  }),
);

const dot = (level, left, hanging, color, glyph = '•') => ({
  level,
  format: LevelFormat.BULLET,
  text: glyph,
  alignment: AlignmentType.LEFT,
  style: {
    paragraph: { indent: { left, hanging } },
    run: { font: SANS, color, size: BODY },
  },
});

const doc = new Document({
  creator: name,
  title: `Resume ${id}`,
  styles: {
    default: { document: { run: { font: SANS, size: BODY, color: MUTED } } },
  },
  numbering: {
    config: [
      {
        reference: 'dots',
        levels: [dot(0, px(9), px(9), MUTED), dot(1, px(9), px(9), 'DEDCD7', '\u25E6')],
      },
    ],
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: PAGE_W, height: 16838 },
          margin: { top: px(48), bottom: px(48), left: SIDE, right: SIDE },
        },
      },
      children,
    },
  ],
});

const outPath = outArg ? resolve(outArg) : join(repo, 'docs/resumes', `${id}.docx`);
writeFileSync(outPath, await Packer.toBuffer(doc));
console.log(`wrote ${outPath}`);
