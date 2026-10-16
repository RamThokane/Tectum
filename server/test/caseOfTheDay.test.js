import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member, makeCase } from './helpers.js';

before(start);
after(stop);

test('Case of the Day: most-discussed until an admin chooses one; members cannot choose or see the choice', async () => {
  const author = await member();
  const admin = await member({ isAdmin: true });
  const reader = await member();
  const busy = await makeCase(author.user, { commentCount: 9 });
  const quiet = await makeCase(author.user, { title: 'Quiet case', commentCount: 0 });

  let r = await reader.api('GET', '/posts/case-of-the-day');
  assert.equal(r.status, 200);
  assert.equal(r.data.post._id, String(busy._id)); // automatic: most discussed
  assert.equal('pinnedId' in r.data, false); // members never learn it was picked

  assert.equal((await reader.api('PUT', '/posts/case-of-the-day', { postId: String(quiet._id) })).status, 403);

  r = await admin.api('PUT', '/posts/case-of-the-day', { postId: String(quiet._id) });
  assert.equal(r.status, 200, JSON.stringify(r.data));

  r = await reader.api('GET', '/posts/case-of-the-day');
  assert.equal(r.data.post._id, String(quiet._id));
  assert.equal(r.data.post.caseStudy?.diagnosis, undefined); // answer still hidden until solved

  r = await admin.api('GET', '/posts/case-of-the-day');
  assert.equal(r.data.pinnedId, String(quiet._id));

  // Back to automatic.
  await admin.api('PUT', '/posts/case-of-the-day', { postId: null });
  r = await reader.api('GET', '/posts/case-of-the-day');
  assert.equal(r.data.post._id, String(busy._id));
});
