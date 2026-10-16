import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member, makeCase } from './helpers.js';

before(start);
after(stop);

test('account deletion: Google-only accounts confirm by typing DELETE; their flashcards go too', async () => {
  const { ReviewCard } = await import('../src/models/ReviewCard.js');
  const { User } = await import('../src/models/User.js');
  const a = await member();
  const g = await member({ passwordSet: false, googleId: `g-${Date.now()}` });
  const c = await makeCase(a.user);
  await g.api('POST', `/posts/${c._id}/bookmark`);
  await g.api('POST', `/reviews/${c._id}`, { grade: 'good' });
  assert.equal(await ReviewCard.countDocuments({ user: g.user._id }), 1);

  assert.equal((await g.api('DELETE', '/users/me', { confirm: 'delete it' })).status, 400);
  const ok = await g.api('DELETE', '/users/me', { confirm: 'delete' });
  assert.equal(ok.status, 200);
  assert.equal(await User.countDocuments({ _id: g.user._id }), 0);
  assert.equal(await ReviewCard.countDocuments({ user: g.user._id }), 0);

  // Password accounts still need the password.
  assert.equal((await a.api('DELETE', '/users/me', { confirm: 'DELETE' })).status, 400);
});

test('verification decision: the member is notified of the result', async () => {
  const { User } = await import('../src/models/User.js');
  const admin = await member({ isAdmin: true });
  const m = await member();
  await User.updateOne({ _id: m.user._id }, { verificationStatus: 'pending' });
  await admin.api('POST', `/admin/verifications/${m.user._id}`, { status: 'verified' });
  const notes = await m.api('GET', '/notifications');
  const n = notes.data.notifications.find((x) => x.type === 'verification');
  assert.ok(n);
  assert.match(n.note, /You are verified/);
});
