#!/usr/bin/env node
// Re-applies this project's changes to the BUILT files of the vendored framework.
//
// framework/core/dist/ is compiled output with hashed chunk names, so it can't be merged
// with git the way framework/core/src/ can. After dropping a new upstream release into
// framework/core/, run:
//
//   node scripts/patch-framework-dist.mjs [path/to/framework/core]
//
// It patches, in place:
//   - dist/index.js, dist/index.d.ts   canvas 794x1123 (A4); drops `notes` from SlideModule
//   - dist/update-*.js                 removes the notes-array helpers; disables the npm update routes
//   - dist/config-*.js                 removes the notes plugin and its use in reorder/delete/duplicate
//   - dist/<locale bundle>.js          removes notes strings, "slide" -> "template", app title
//   - dist/types-*.d.ts                removes notes locale types
//
// Every edit must match or the script exits non-zero, so an upstream refactor is noticed
// instead of silently skipped. Running it twice on an already-patched tree fails the same way;
// run it on a fresh upstream copy. Source changes in src/ and skills/ are NOT handled here:
// merge those with git (see README, "Updating from upstream").

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? 'framework/core');
const dist = join(root, 'dist');
const files = readdirSync(dist);

let failed = false;
const log = (msg) => console.log(msg);
const fail = (file, what) => {
  failed = true;
  console.error(`FAIL  ${file}: ${what}`);
};

function pick(test, label) {
  const hits = files.filter(test);
  if (hits.length !== 1) {
    fail(label, `expected exactly one match in dist/, found ${hits.length}`);
    return null;
  }
  return hits[0];
}

function contentPick(candidates, needle, label) {
  const hits = candidates.filter((f) => readFileSync(join(dist, f), 'utf8').includes(needle));
  if (hits.length !== 1) {
    fail(label, `expected exactly one file containing ${JSON.stringify(needle)}, found ${hits.length}`);
    return null;
  }
  return hits[0];
}

// An edit is [description, (source) => newSource | null]. null means "did not match".
function patch(file, edits) {
  if (!file) return;
  const path = join(dist, file);
  let src = readFileSync(path, 'utf8');
  for (const [what, fn] of edits) {
    const out = fn(src);
    if (out === null || out === undefined) {
      fail(file, what);
    } else {
      src = out;
      log(`ok    ${file}: ${what}`);
    }
  }
  writeFileSync(path, src);
}

const replaceOnce = (re, to) => (src) => {
  const next = src.replace(re, to);
  return next === src ? null : next;
};
const sliceOut = (startMarker, endMarker) => (src) => {
  const a = src.indexOf(startMarker);
  if (a === -1) return null;
  const b = src.indexOf(endMarker, a);
  if (b === -1) return null;
  return src.slice(0, a) + src.slice(b);
};

// ---- Canvas + SDK types ---------------------------------------------------------------
patch(pick((f) => f === 'index.js', 'index.js'), [
  ['canvas width 1920 -> 794', replaceOnce(/CANVAS_WIDTH = 1920/, 'CANVAS_WIDTH = 794')],
  ['canvas height 1080 -> 1123', replaceOnce(/CANVAS_HEIGHT = 1080/, 'CANVAS_HEIGHT = 1123')],
]);
patch(pick((f) => f === 'index.d.ts', 'index.d.ts'), [
  ['canvas width 1920 -> 794', replaceOnce(/CANVAS_WIDTH = 1920/, 'CANVAS_WIDTH = 794')],
  ['canvas height 1080 -> 1123', replaceOnce(/CANVAS_HEIGHT = 1080/, 'CANVAS_HEIGHT = 1123')],
  [
    'drop notes from SlideModule',
    replaceOnce(/[ \t]*(?:\/\/[^\n]*\n[ \t]*)?notes\?: \(string \| undefined\)\[\];\n/, ''),
  ],
]);

// ---- Notes helpers + update routes (shared "update-*.js" chunk) ------------------------
const NOTES_FNS = 'duplicateNotesElementInSource|reorderNotesArrayInSource|removeNotesElementInSource';
const stripAliases = (src) => {
  // Handles both `name as x` (exports) and `x as name` (imports), with a leading comma.
  const next = src.replace(new RegExp(`,\\s*(?:(?:${NOTES_FNS}) as \\w+|\\w+ as (?:${NOTES_FNS}))`, 'g'), '');
  return next === src ? null : next;
};

const updateFile = pick((f) => /^update-.*\.js$/.test(f), 'update-*.js');
patch(updateFile, [
  [
    'remove notes-array helpers',
    sliceOut('function findNotesArray(source)', '/**\n* Remove the element at `index` from `export default [...]`.'),
  ],
  ['remove notes helper exports', stripAliases],
  [
    'disable npm update routes',
    (src) => {
      const a = src.indexOf('function registerUpdateRoutes(server, ctx) {');
      if (a === -1) return null;
      const b = src.indexOf('//#endregion', a);
      if (b === -1) return null;
      return (
        src.slice(0, a) +
        '// The npm update flow is disabled: this project vendors a modified fork of @open-slide/core,\n' +
        "// and `pnpm up @open-slide/core` would replace it with the published package.\n" +
        'function registerUpdateRoutes(_server, _ctx) {}\n' +
        src.slice(b)
      );
    },
  ],
]);

// ---- Vite server: notes plugin + page ops ---------------------------------------------
const configFile = pick((f) => /^config-.*\.js$/.test(f), 'config-*.js');
patch(configFile, [
  ['remove notes helper imports', stripAliases],
  [
    'reorder no longer rewrites a notes export',
    replaceOnce(
      /(\t+)const withNotes = reorderNotesArrayInSource\(reordered, order\);\n\t+if \(withNotes === null\)[^\n]*\n\t+if \(withNotes !== source\) await fs\.writeFile\(entry, withNotes, "utf8"\);/,
      '$1if (reordered !== source) await fs.writeFile(entry, reordered, "utf8");',
    ),
  ],
  [
    'delete/duplicate page no longer rewrite a notes export',
    replaceOnce(
      /(\t+)const withNotes = isDelete \? removeNotesElementInSource[^\n]*\n\t+if \(withNotes === null\)[^\n]*\n\t+if \(withNotes !== source\) await fs\.writeFile\(entry, withNotes, "utf8"\);/,
      '$1if (updated !== source) await fs.writeFile(entry, updated, "utf8");',
    ),
  ],
  [
    'remove the notes plugin',
    sliceOut('//#region src/vite/notes-plugin.ts', '//#region src/vite/open-slide-plugin.ts'),
  ],
  ['unregister the notes plugin', replaceOnce(/\t+notesPlugin\(\{\n[^}]*\}\),\n/, '')],
]);

// ---- Locale bundle + locale types -----------------------------------------------------
const NOTES_KEYS = 'speakerNotes|notesTextSmaller|notesTextLarger|noNotesPrefix|noNotesSuffix';

// Only English words inside string literals; {placeholders}, hyphenated names and paths stay.
function renameWords(text) {
  return text
    .split(/(\{[^}]*\})/)
    .map((part) => {
      if (part.startsWith('{')) return part;
      const map = { slides: 'templates', Slides: 'Templates', slide: 'template', Slide: 'Template' };
      return part.replace(/(?<![-\w/.@])(slides?|Slides?)(?![-\w/@])/g, (w) => map[w]);
    })
    .join('');
}
const renameLine = (line) => {
  if (/^\s*(\/\/|\/\*|\*)/.test(line)) return line;
  return line.replace(/(['"])((?:\\.|(?!\1).)*)\1/g, (_m, q, body) => q + renameWords(body) + q);
};

const jsFiles = files.filter((f) => f.endsWith('.js'));
const localeFile = contentPick(jsFiles, '//#region src/locale/en.ts', 'locale bundle');
patch(localeFile, [
  ['remove notes strings', replaceOnce(new RegExp(`^[ \\t]*(?:${NOTES_KEYS}):[^\\n]*\\n`, 'gm'), '')],
  ['remove notesDrawer blocks', replaceOnce(/^[ \t]*notesDrawer: \{\n[\s\S]*?^[ \t]*\},?\n\n?/gm, '')],
  [
    'app title -> resume-builder',
    replaceOnce(/(appTitle: )(["'])open-slide\2/g, '$1$2resume-builder$2'),
  ],
  [
    'update notice -> resume-builder',
    replaceOnce(/(updateAvailable: )(["'])open-slide /g, '$1$2resume-builder '),
  ],
  [
    '"slide" -> "template" in UI strings',
    (src) => {
      const next = src.split('\n').map(renameLine).join('\n');
      return next === src ? null : next;
    },
  ],
]);

const typesFile = contentPick(
  files.filter((f) => /^types-.*\.d\.ts$/.test(f)),
  'notesDrawer:',
  'locale types',
);
patch(typesFile, [
  ['remove notes string types', replaceOnce(new RegExp(`^[ \\t]*(?:${NOTES_KEYS})\\??:[^\\n]*\\n`, 'gm'), '')],
  ['remove notesDrawer type', replaceOnce(/^  notesDrawer: \{[\s\S]*?^  \};\n\n?/m, '')],
]);

if (failed) {
  console.error('\nSome edits did not apply. Upstream changed something this script relies on;');
  console.error('update scripts/patch-framework-dist.mjs, then re-run on a fresh upstream copy.');
  process.exit(1);
}
console.log('\nAll dist edits applied.');
