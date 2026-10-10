// Tests use invented data only. Run with: node --test scripts/
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildTerms, scanText } from './leak-check.mjs';

const dictionary = new Set(['led', 'the', 'team', 'that', 'cut', 'costs', 'by', 'and', 'worked', 'at', 'for']);
const privateText = [
  'Jane Zorblax, jane@zorblax.test, +61 400 123 456, janezorblax.test',
  'Led the Quuxly team that cut costs by 37% and worked at Frobnitz Industries for clients.',
].join('\n');
const matcher = buildTerms([privateText], dictionary);

const kinds = (text) => scanText(text, matcher, true).map((f) => f.kind);

test('flags an email, a phone number and a domain', () => {
  assert.ok(kinds('Contact jane@zorblax.test').includes('email'));
  assert.ok(kinds('Call +61 400 123 456').includes('phone'));
  assert.ok(kinds('See janezorblax.test/work').includes('url'));
  assert.deepEqual(kinds('Call 0061 400 123 456'), []);
});

test('flags non-dictionary names and a copied run of five words', () => {
  assert.ok(kinds('Worked with Quuxly daily').includes('term'));
  assert.ok(kinds('Frobnitz is a client').includes('term'));
  assert.ok(kinds('We led the quuxly team that cut costs').includes('phrase'));
});

test('does not treat a date as a phone number', () => {
  const withDate = buildTerms(['Added on 2026-10-09 and 400 123 456 789.'], dictionary);
  assert.deepEqual(scanText('createdAt: 2026-10-09', withDate, true).map((f) => f.kind), []);
  assert.ok(scanText('Call 400 123 456 789', withDate, true).map((f) => f.kind).includes('phone'));
});

test('flags a metric that also appears in the private text', () => {
  assert.ok(kinds('Improved retention by 37%').includes('metric'));
  assert.deepEqual(kinds('Improved retention by 12%'), []);
});

test('passes ordinary placeholder resume text', () => {
  const clean = [
    'Your Name',
    'you@example.com · +1 555 010 1234 · yoursite.com · in/yourname',
    'Fonts from https://fonts.googleapis.com/css2?family=Inter',
    'Lead with the outcome: what changed, by how much, for whom.',
    'Company Name · Your Role Title',
  ].join('\n');
  assert.deepEqual(kinds(clean), []);
});

test('masks values unless asked to reveal them', () => {
  const [f] = scanText('Quuxly', matcher, false);
  assert.match(f.value, /^qu\*+ \(6\)$/);
});
