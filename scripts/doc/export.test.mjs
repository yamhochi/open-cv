// Completeness test for the Word export: every line of every Content file in docs/content must
// appear in the .docx built from it, so a section can never be dropped silently.
// Run with: node --test scripts/doc/export.test.mjs
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const here = dirname(fileURLToPath(import.meta.url));
const repo = resolve(here, '../..');
const contentDir = join(repo, 'docs', 'content');

// Read one file out of a .docx (a zip) without any dependency.
function readZipEntry(buf, wanted) {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOffset = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === wanted) {
      const lhNameLen = buf.readUInt16LE(localOffset + 26);
      const lhExtraLen = buf.readUInt16LE(localOffset + 28);
      const start = localOffset + 30 + lhNameLen + lhExtraLen;
      const data = buf.subarray(start, start + size);
      return method === 0 ? data : inflateRawSync(data);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in docx`);
}

const unescapeXml = (s) =>
  s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
const squash = (s) => s.replace(/\s+/g, ' ').trim();

// The words a Content line contributes, with the Markdown syntax removed.
function plain(line) {
  return squash(
    line
      .replace(/^\s*#{1,6}\s+/, '')
      .replace(/^\s*-\s+/, '')
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/^\*([^*]+)\*$/, '$1'),
  );
}

for (const file of readdirSync(contentDir).filter((f) => f.endsWith('.md'))) {
  const id = file.replace(/\.md$/, '');
  test(`Word export of ${id} contains every line of its Content`, () => {
    const out = join(mkdtempSync(join(tmpdir(), 'resume-docx-')), `${id}.docx`);
    const run = spawnSync(process.execPath, [join(here, 'md-to-docx.mjs'), id, out], { cwd: repo, encoding: 'utf8' });
    assert.equal(run.status, 0, run.stderr);
    const xml = readZipEntry(readFileSync(out), 'word/document.xml').toString('utf8');
    const text = squash(unescapeXml(xml.replace(/<\/w:p>/g, '\n').replace(/<[^>]+>/g, '')));
    const body = readFileSync(join(contentDir, file), 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
    const missing = body
      .split('\n')
      .map(plain)
      // The summary has no heading in the Word file, by design.
      .filter((l) => l && l !== 'Summary' && !/\(continued\)$/.test(l))
      .filter((l) => !text.includes(l));
    assert.deepEqual(missing, [], `lines missing from the Word export of ${id}`);
  });
}
