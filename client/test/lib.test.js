// Unit tests for the pure helpers. Run: npm test (node's built-in test runner, no extra packages).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { plural, pluralize, truncateWords } from '../src/lib/format.js';
import { consistency, weekChange, daysBetween } from '../src/lib/streakMath.js';
import { sectionFor } from '../src/lib/nav.js';
import { isStrongPassword, passwordProblem } from '../src/lib/passwordRules.js';

test('password rules: 8+ characters, small letter, capital, number, symbol', () => {
  assert.equal(isStrongPassword('Tectum#2026'), true);
  assert.equal(isStrongPassword('Ab1!xyz'), false); // 7 characters
  assert.equal(isStrongPassword('abcdefg1!'), false); // no capital
  assert.equal(isStrongPassword('ABCDEFG1!'), false); // no small letter
  assert.equal(isStrongPassword('Abcdefgh!'), false); // no number
  assert.equal(isStrongPassword('Abcdefg12'), false); // no symbol
  assert.equal(passwordProblem('abcdefg1!'), 'Add one capital letter (A-Z)');
  assert.equal(passwordProblem('Ab1!'), 'Use at least 8 characters');
  assert.equal(passwordProblem('Tectum#2026'), '');
});

test('pluralize', () => {
  assert.equal(pluralize(0, 'follower'), '0 followers');
  assert.equal(pluralize(1, 'follower'), '1 follower');
  assert.equal(pluralize(2, 'follower'), '2 followers');
  assert.equal(pluralize(1, 'member'), '1 member');
  assert.equal(pluralize(1200, 'view'), '1.2K views');
  assert.equal(pluralize(1, 'entry', 'entries'), '1 entry');
  assert.equal(pluralize(3, 'entry', 'entries'), '3 entries');
  assert.equal(pluralize(undefined, 'answer'), '0 answers');
  assert.equal(plural('Follower', 1), 'Follower');
  assert.equal(plural('Follower', 5), 'Followers');
});

test('truncateWords cuts at a word boundary and adds an ellipsis', () => {
  const text = 'A 54-year-old man presents with crushing chest pain radiating to the left arm. He has diabetes and smokes.';
  const out = truncateWords(text, 80);
  assert.ok(out.length <= 81, out);
  assert.ok(out.endsWith('…'));
  assert.ok(text.startsWith(out.slice(0, -1)), 'only whole words');
  assert.ok(!/\s…$/.test(out));
  const lastWord = out.slice(0, -1).split(' ').pop();
  assert.ok(text.split(/\s+/).map((w) => w.replace(/[.,]$/, '')).includes(lastWord.replace(/[.,]$/, '')), `"${lastWord}" is a whole word`);
  assert.equal(truncateWords('Short text', 80), 'Short text');
});

test('week-on-week change never divides by zero', () => {
  assert.deepEqual(weekChange(5, 0), { kind: 'new', label: 'New', direction: 1 });
  assert.equal(weekChange(0, 0).label, '—');
  assert.equal(weekChange(0, 0).direction, 0);
  assert.equal(weekChange(15, 10).label, '+50%');
  assert.equal(weekChange(5, 10).label, '-50%');
  assert.equal(weekChange(10, 10).label, '0%');
});

test('consistency uses min(30, days since joining)', () => {
  // joined today, active today: 1 of 1 day
  assert.deepEqual(consistency(1, '2026-10-02', '2026-10-02'), { window: 1, active: 1, pct: 100 });
  // joined 3 days ago (4 days counting today), active 1
  assert.deepEqual(consistency(1, '2026-09-29', '2026-10-02'), { window: 4, active: 1, pct: 25 });
  // old account: the full 30 days
  assert.deepEqual(consistency(3, '2025-01-01', '2026-10-02'), { window: 30, active: 3, pct: 10 });
  // unknown join date: 30 days
  assert.equal(consistency(6, null, '2026-10-02').window, 30);
  assert.equal(daysBetween('2026-09-29', '2026-10-02'), 3);
});

test('active menu item', () => {
  assert.equal(sectionFor('/discover', '?q=asthma'), 'search');
  assert.equal(sectionFor('/wards'), 'wards');
  assert.equal(sectionFor('/ward/anatomy'), 'wards');
  assert.equal(sectionFor('/collaboration'), 'collab');
  assert.equal(sectionFor('/feed', '?collab=1'), 'collab');
  assert.equal(sectionFor('/feed'), 'home');
  assert.equal(sectionFor('/profile/abc', '', 'abc'), 'profile');
  assert.equal(sectionFor('/profile/xyz', '', 'abc'), '');
});
