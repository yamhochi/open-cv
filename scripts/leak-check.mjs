#!/usr/bin/env node
// Leak check: stops personal content from a private source repo reaching this public repo.
//
//   node scripts/leak-check.mjs [--source <dir>] [--all | --staged | --history] [--message <file>] [--reveal]
//
// The term list is built at run time from the private source's resume and brief files and is
// never written anywhere. By default it scans what you are about to commit: added lines in
// `git diff HEAD` plus untracked files, and the names of those files. Use --all to scan every
// tracked file, --staged for the index only, and --message to scan a commit message file.
// --history scans every commit on every branch and tag: added lines, file names, commit
// messages, and author names and emails. Binary files cannot be scanned.
//
// What it flags (all derived from the private files):
//   email    email addresses
//   phone    phone numbers
//   url      URLs and bare domains
//   metric   figures such as 37%, $2m, 120k
//   term     words that are not ordinary English (names, employers, products, clients)
//   phrase   any run of five consecutive words copied from the private text
//
// Limits: a personal name that is also an ordinary English word (for example "Frank") is not
// caught by the `term` rule, and a name the private files never contain cannot be known. Treat a
// clean run as necessary, not sufficient, and still read the diff before pushing.
//
// Exit codes: 0 clean, 1 findings, 2 setup problem.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

const SOURCE_DIRS = ['docs/resumes', 'docs/resume-briefs'];
const SHINGLE = 5;
const DICTIONARY = '/usr/share/dict/words';

// Ordinary words that are fine in a public resume template even if the private files use them.
const GENERIC = new Set(
  `resume cv cover letter experience education skills summary projects achievements talks
  senior junior lead principal staff manager director engineer designer product design
  january february march april may june july august september october november december
  monday tuesday wednesday thursday friday saturday sunday present current continued
  figma react typescript javascript css html node pnpm npm git github claude markdown
  docx pdf pptx inter google australia sydney melbourne
  jan feb mar apr jun jul aug sep sept oct nov dec
  api apis app apps english json url urls ui ux seo ai llm sql aws gcp http https svg png yaml ats vite`.split(/\s+/),
);

// Hosts that are safe in a public template, so they are never treated as private.
const PUBLIC_HOSTS = /^(?:https?:\/\/)?(?:www\.)?(?:example\.(?:com|org|net)|yoursite\.com|localhost|github\.com\/yamhochi\/open-(?:cv|doc)|github\.com\/open-slide|fonts\.googleapis\.com|npmjs\.com)/;

// 2026-10-10 or 10/10/2026 looks like a long number but is a date, not a phone number.
const isDate = (v) => /^\s*(?:\d{4}[-/.]\d{1,2}[-/.]\d{1,2}|\d{1,2}[-/.]\d{1,2}[-/.]\d{4})\s*$/.test(v);

const words = (text) => text.toLowerCase().match(/[a-z0-9][a-z0-9'’%$.-]*[a-z0-9%$]|[a-z0-9]/g) ?? [];

function loadDictionary() {
  if (!existsSync(DICTIONARY)) return null;
  return new Set(
    readFileSync(DICTIONARY, 'utf8')
      .split('\n')
      .filter((w) => w && w === w.toLowerCase())
      .map((w) => w.toLowerCase()),
  );
}

const STEMS = [/(?:ies)$/, /(?:es|s|ed|d|er|est|ing|ly|ness|ment)$/];
function isCommon(word, dictionary) {
  if (!dictionary) return false;
  if (dictionary.has(word)) return true;
  if (STEMS[0].test(word) && dictionary.has(word.replace(/ies$/, 'y'))) return true;
  const base = word.replace(STEMS[1], '');
  return base.length >= 3 && (dictionary.has(base) || dictionary.has(`${base}e`));
}

// Percentages such as 100% or 50% are ordinary in CSS and prose; only odd figures identify a person.
const isRoundPercent = (v) => /^\d+%$/.test(v) && Number.parseInt(v, 10) % 5 === 0;

// Build the matcher from the private source texts.
export function buildTerms(texts, dictionary = loadDictionary()) {
  const emails = new Set();
  const phones = new Set();
  const urls = new Set();
  const metrics = new Set();
  const terms = new Set();
  const shingles = new Set();

  const lowercaseSeen = new Set(texts.flatMap((t) => t.match(/\b[a-z][a-z0-9]{2,}\b/g) ?? []));
  for (const text of texts) {
    for (const m of text.matchAll(/[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g)) emails.add(m[0].toLowerCase());
    for (const m of text.matchAll(/(?<![\w.])\+?\d[\d\s().-]{7,}\d/g)) {
      const digits = m[0].replace(/\D/g, '');
      if (!isDate(m[0]) && digits.length >= 8 && digits.length <= 15) phones.add(digits);
    }
    for (const m of text.matchAll(/(?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s)>\]"']*)?/gi)) {
      const u = m[0].replace(/[.,;:]+$/, '').toLowerCase();
      if (!/\.(md|mjs|tsx?|json|js|css|png|svg)$/.test(u) && u.includes('.') && !PUBLIC_HOSTS.test(u)) urls.add(u);
    }
    for (const m of text.matchAll(/(?:\$\s?\d[\d,.]*\s?[kKmMbB]?\b|\b\d[\d,.]*\s?(?:%|[kKmM]\b))/g)) {
      const v = m[0].replace(/\s+/g, '').toLowerCase();
      if (!isRoundPercent(v)) metrics.add(v);
    }
    // Capitalised or ALLCAPS tokens that are not ordinary English.
    for (const m of text.matchAll(/\b[A-Z][A-Za-z0-9]{2,}\b/g)) {
      const w = m[0].toLowerCase();
      if (GENERIC.has(w)) continue;
      if (isCommon(w, dictionary) || lowercaseSeen.has(w)) continue;
      terms.add(w);
    }
    const ws = words(text);
    for (let i = 0; i + SHINGLE <= ws.length; i++) shingles.add(ws.slice(i, i + SHINGLE).join(' '));
  }
  return { emails, phones, urls, metrics, terms, shingles };
}

const mask = (s, reveal) => (reveal ? s : `${s.slice(0, 2)}${'*'.repeat(Math.max(1, s.length - 2))} (${s.length})`);

// Scan one block of text. Returns findings with 1-based line numbers.
export function scanText(text, matcher, reveal = false) {
  const findings = [];
  const lines = text.split('\n');
  lines.forEach((line, i) => {
    const seen = new Set();
    const add = (kind, value) => {
      if (seen.has(`${kind}:${value}`)) return;
      seen.add(`${kind}:${value}`);
      findings.push({ line: i + 1, kind, value: mask(value, reveal) });
    };
    const lower = line.toLowerCase();
    for (const e of matcher.emails) if (lower.includes(e)) add('email', e);
    for (const m of line.matchAll(/(?<![\w.])\+?\d[\d\s().-]{7,}\d/g)) {
      const d = m[0].replace(/\D/g, '');
      if (!isDate(m[0]) && matcher.phones.has(d)) add('phone', d);
    }
    for (const u of matcher.urls) if (lower.includes(u)) add('url', u);
    for (const m of line.matchAll(/(?:\$\s?\d[\d,.]*\s?[kKmMbB]?\b|\b\d[\d,.]*\s?(?:%|[kKmM]\b))/g)) {
      const v = m[0].replace(/\s+/g, '').toLowerCase();
      if (matcher.metrics.has(v)) add('metric', v);
    }
    for (const m of line.matchAll(/[A-Za-z][A-Za-z0-9]{2,}/g)) {
      const w = m[0].toLowerCase();
      if (matcher.terms.has(w)) add('term', w);
    }
    const ws = words(line);
    for (let j = 0; j + SHINGLE <= ws.length; j++) {
      const s = ws.slice(j, j + SHINGLE).join(' ');
      if (matcher.shingles.has(s)) {
        add('phrase', s);
        break;
      }
    }
  });
  return findings;
}

function listFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (name === 'node_modules' || name === '.git') continue;
    if (statSync(p).isDirectory()) out.push(...listFiles(p));
    else if (/\.(md|txt)$/i.test(name)) out.push(p);
  }
  return out;
}

const git = (args, cwd) => execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

function isText(buf) {
  return !buf.subarray(0, 8000).includes(0);
}

function parseArgs(argv) {
  const args = { source: process.env.LEAK_CHECK_SOURCE, mode: 'worktree', message: null, reveal: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--source') args.source = argv[++i];
    else if (a === '--all') args.mode = 'all';
    else if (a === '--staged') args.mode = 'staged';
    else if (a === '--history') args.mode = 'history';
    else if (a === '--message') args.message = argv[++i];
    else if (a === '--reveal') args.reveal = true;
    else if (a === '-h' || a === '--help') args.help = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  return args;
}


// Scan the whole history: every commit's message, author, file names and added lines.
function scanHistory(repo, matcher, reveal) {
  let count = 0;
  const report = (where, kind, value) => {
    count++;
    console.log(`${where}  ${kind}  ${value}`);
  };
  const scan = (where, text, lineNos) => {
    for (const f of scanText(text, matcher, reveal)) report(`${where}${lineNos ? `:${lineNos[f.line - 1]}` : ''}`, f.kind, f.value);
  };
  // Messages and authors.
  const meta = git(['log', '--all', '--format=%H%x1f%an%x1f%ae%x1f%cn%x1f%ce%x1f%B%x1e'], repo);
  let commits = 0;
  for (const rec of meta.split('\x1e')) {
    if (!rec.trim()) continue;
    commits++;
    const [sha, an, ae, cn, ce, body] = rec.trim().split('\x1f');
    const short = sha.slice(0, 7);
    scan(`${short} (message)`, body ?? '');
    scan(`${short} (author)`, `${an} ${ae} ${cn} ${ce}`);
  }
  // File names.
  for (const line of git(['log', '--all', '--name-only', '--format=@@@%H'], repo).split('\n')) {
    if (line.startsWith('@@@')) continue;
    if (line) scan(`(file name) ${line}`, line);
  }
  // Added lines.
  const diff = git(['log', '--all', '-p', '-U0', '--no-color', '--no-renames', '--format=@@@%H'], repo);
  let sha = '';
  let file = '';
  let lineNo = 0;
  const batches = new Map();
  for (const l of diff.split('\n')) {
    if (l.startsWith('@@@')) sha = l.slice(3, 10);
    else if (l.startsWith('+++ b/')) file = l.slice(6);
    else if (l.startsWith('+++ ')) file = '';
    else if (l.startsWith('@@')) lineNo = Number(/\+(\d+)/.exec(l)?.[1] ?? 0) - 1;
    else if (l.startsWith('+') && file) {
      lineNo++;
      const key = `${sha} ${file}`;
      (batches.get(key) ?? batches.set(key, []).get(key)).push([lineNo, l.slice(1)]);
    }
  }
  for (const [key, ls] of batches) scan(key, ls.map(([, t]) => t).join('\n'), ls.map(([n]) => n));
  console.error(
    count === 0
      ? `leak-check: history clean (${commits} commits, all branches and tags).`
      : `leak-check: ${count} finding(s) in history. Do not push until each is removed or confirmed public.`,
  );
  return count === 0 ? 0 : 1;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 22).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
    return 0;
  }
  const repo = git(['rev-parse', '--show-toplevel'], process.cwd()).trim();
  const source = resolve(args.source ?? join(repo, '..', 'open-slide-doc'));
  const sourceFiles = SOURCE_DIRS.map((d) => join(source, d)).filter(existsSync).flatMap(listFiles);
  if (sourceFiles.length === 0) {
    console.error(`leak-check: no source files found under ${source} (looked in ${SOURCE_DIRS.join(', ')}). Pass --source <dir>.`);
    return 2;
  }
  const dictionary = loadDictionary();
  if (!dictionary) console.error(`leak-check: ${DICTIONARY} not found, so the "term" rule is skipped.`);
  const matcher = buildTerms(sourceFiles.map((f) => readFileSync(f, 'utf8')), dictionary);

  if (args.mode === 'history') return scanHistory(repo, matcher, args.reveal);

  // Collect targets: [label, text] pairs. For diffs, only added lines are scanned.
  const targets = [];
  const addDiff = (diff) => {
    let file = null;
    let lineNo = 0;
    const perFile = new Map();
    for (const l of diff.split('\n')) {
      if (l.startsWith('+++ b/')) file = l.slice(6);
      else if (l.startsWith('@@')) lineNo = Number(/\+(\d+)/.exec(l)?.[1] ?? 0) - 1;
      else if (l.startsWith('+') && !l.startsWith('+++')) {
        lineNo++;
        if (file) (perFile.get(file) ?? perFile.set(file, []).get(file)).push([lineNo, l.slice(1)]);
      } else if (!l.startsWith('-')) lineNo++;
    }
    for (const [f, ls] of perFile) targets.push({ label: f, lines: ls });
  };
  const names = [];
  if (args.mode === 'all') {
    for (const f of git(['ls-files'], repo).split('\n').filter(Boolean)) {
      names.push(f);
      const buf = readFileSync(join(repo, f));
      if (isText(buf)) targets.push({ label: f, lines: buf.toString('utf8').split('\n').map((t, i) => [i + 1, t]) });
    }
  } else {
    addDiff(git(args.mode === 'staged' ? ['diff', '--cached', '-U0'] : ['diff', 'HEAD', '-U0'], repo));
    const changed = git(args.mode === 'staged' ? ['diff', '--cached', '--name-only'] : ['diff', 'HEAD', '--name-only'], repo);
    names.push(...changed.split('\n').filter(Boolean));
    if (args.mode !== 'staged') {
      for (const f of git(['ls-files', '--others', '--exclude-standard'], repo).split('\n').filter(Boolean)) {
        names.push(f);
        const buf = readFileSync(join(repo, f));
        if (isText(buf)) targets.push({ label: f, lines: buf.toString('utf8').split('\n').map((t, i) => [i + 1, t]) });
      }
    }
  }
  if (args.message) targets.push({ label: `(commit message ${relative(repo, resolve(args.message))})`, lines: readFileSync(args.message, 'utf8').split('\n').map((t, i) => [i + 1, t]) });
  for (const n of names) targets.push({ label: `(file name) ${n}`, lines: [[0, n]] });

  let count = 0;
  for (const t of targets) {
    const lineNos = t.lines.map(([n]) => n);
    const found = scanText(t.lines.map(([, s]) => s).join('\n'), matcher, args.reveal);
    for (const f of found) {
      count++;
      console.log(`${t.label}:${lineNos[f.line - 1]}  ${f.kind}  ${f.value}`);
    }
  }
  console.error(count === 0 ? `leak-check: clean (${targets.length} targets, ${sourceFiles.length} source files).` : `leak-check: ${count} finding(s). Do not commit or push until each is removed or confirmed public.`);
  return count === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    process.exit(main());
  } catch (err) {
    console.error(`leak-check: ${err.message}`);
    process.exit(2);
  }
}
