import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member } from './helpers.js';

before(start);
after(stop);

test('home-screen shortcut answer: later, then installed (which sticks); private to the member', async () => {
  const m = await member();
  const other = await member();

  let me = await m.api('GET', `/users/${m.user._id}`);
  assert.equal(me.data.user.appShortcut, undefined); // not asked yet: Home shows the pop-up

  assert.equal((await m.api('PUT', '/users/me/app-shortcut', { status: 'maybe' })).status, 400);

  let r = await m.api('PUT', '/users/me/app-shortcut', { status: 'later' });
  assert.equal(r.status, 200, JSON.stringify(r.data));
  assert.equal(r.data.appShortcut, 'later');
  me = await m.api('GET', `/users/${m.user._id}`);
  assert.equal(me.data.user.appShortcut, 'later');

  // nobody else learns it
  const seen = await other.api('GET', `/users/${m.user._id}`);
  assert.equal('appShortcut' in seen.data.user, false);

  r = await m.api('PUT', '/users/me/app-shortcut', { status: 'installed' });
  assert.equal(r.data.appShortcut, 'installed');
  // "later" from another device doesn't bring the reminder back
  r = await m.api('PUT', '/users/me/app-shortcut', { status: 'later' });
  assert.equal(r.data.appShortcut, 'installed');
});
