import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member, makeCase } from './helpers.js';

before(start);
after(stop);

const views = async (api, id) => (await api('GET', `/posts/${id}`)).data.post.views;

test('opening a post never changes its view count', async () => {
  const author = await member();
  const reader = await member();
  const post = await makeCase(author.user);
  for (let i = 0; i < 3; i++) await reader.api('GET', `/posts/${post._id}`);
  await reader.api('GET', '/posts');
  assert.equal(await views(reader.api, post._id), 0);
});

test('the same member reporting a view 3 times adds 1', async () => {
  const author = await member();
  const reader = await member();
  const post = await makeCase(author.user);
  for (let i = 0; i < 3; i++) await reader.api('POST', `/posts/${post._id}/view`);
  await reader.api('POST', '/posts/views', { posts: [String(post._id), String(post._id)] });
  assert.equal(await views(reader.api, post._id), 1);
  // a second member adds one more
  const other = await member();
  await other.api('POST', '/posts/views', { posts: [String(post._id)] });
  assert.equal(await views(reader.api, post._id), 2);
});

test("the author's own views don't count", async () => {
  const author = await member();
  const post = await makeCase(author.user);
  const r = await author.api('POST', `/posts/${post._id}/view`);
  assert.equal(r.data.counted, false);
  assert.equal(await views(author.api, post._id), 0);
});

test('comment views count once per member too', async () => {
  const { Comment } = await import('../src/models/Comment.js');
  const author = await member();
  const reader = await member();
  const post = await makeCase(author.user);
  const comment = await Comment.create({ post: post._id, author: author.user._id, text: 'Good case' });
  for (let i = 0; i < 3; i++) await reader.api('POST', '/posts/views', { comments: [String(comment._id)] });
  const c = await Comment.findById(comment._id).lean();
  assert.equal(c.views, 1);
});
