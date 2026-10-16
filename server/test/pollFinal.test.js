import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member, makeCase } from './helpers.js';

before(start);
after(stop);

test('poll votes are final: a second vote or a change is refused, and votes cannot be removed', async () => {
  const author = await member();
  const reader = await member();
  const post = await makeCase(author.user);

  const first = await reader.api('POST', `/posts/${post._id}/vote`, { option: 1 });
  assert.equal(first.status, 200);
  assert.equal(first.data.poll.myVote, 1);

  const again = await reader.api('POST', `/posts/${post._id}/vote`, { option: 1 });
  assert.equal(again.status, 409);
  assert.match(again.data.message, /already voted/);

  const change = await reader.api('POST', `/posts/${post._id}/vote`, { option: 0 });
  assert.equal(change.status, 409);

  const remove = await reader.api('DELETE', `/posts/${post._id}/vote`);
  assert.equal(remove.status, 404); // the old "remove vote" route is gone

  // Two votes sent at the same moment: only one counts.
  const other = await member();
  const both = await Promise.all([0, 1].map((option) => other.api('POST', `/posts/${post._id}/vote`, { option })));
  assert.deepEqual(both.map((r) => r.status).sort(), [200, 409]);

  const { data } = await reader.api('GET', `/posts/${post._id}`);
  assert.equal(data.post.poll.total, 2);
  assert.equal(data.post.poll.myVote, 1);
});
