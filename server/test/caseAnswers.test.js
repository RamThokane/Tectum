import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member, makeCase } from './helpers.js';

before(start);
after(stop);

test('search does not match words that appear only in the answer', async () => {
  const author = await member();
  const reader = await member();
  const post = await makeCase(author.user);
  for (const q of ['achalasia', 'manometry', 'myotomy']) {
    const feed = await reader.api('GET', `/posts?q=${q}`);
    assert.equal(feed.data.posts.length, 0, `feed search for "${q}"`);
    const full = await reader.api('GET', `/search?q=${q}`);
    assert.equal(full.data.posts.length, 0, `full search for "${q}"`);
    const suggest = await reader.api('GET', `/search/suggest?q=${q}`);
    assert.equal(suggest.data.posts.length, 0, `suggest for "${q}"`);
  }
  // the question side is still searchable
  const hit = await reader.api('GET', '/posts?q=regurgitation');
  assert.deepEqual(hit.data.posts.map((p) => p._id), [String(post._id)]);
  const full = await reader.api('GET', '/search?q=dysphagia');
  assert.equal(full.data.posts.length, 1);
});

test('answers are hidden from a reader until they reveal', async () => {
  const author = await member();
  const reader = await member();
  const post = await makeCase(author.user);

  const before = (await reader.api('GET', `/posts/${post._id}`)).data.post;
  assert.equal(before.answersHidden, true);
  for (const k of ['diagnosis', 'learningPoint', 'mcqTips', 'correctOption']) assert.equal(before.caseStudy[k], undefined, k);
  assert.equal(before.caseStudy.chiefComplaint, 'Difficulty swallowing solids and liquids for 6 months');
  const listed = (await reader.api('GET', '/posts?type=case_study')).data.posts.find((p) => p._id === String(post._id));
  assert.equal(listed.caseStudy.diagnosis, undefined);

  const revealed = await reader.api('POST', `/posts/${post._id}/reveal`);
  assert.equal(revealed.status, 200);
  assert.equal(revealed.data.answers.diagnosis, 'Achalasia cardia');
  assert.equal(revealed.data.answers.correctOption, 0);

  const after = (await reader.api('GET', `/posts/${post._id}`)).data.post;
  assert.equal(after.answersHidden, false);
  assert.equal(after.solved, true);
  assert.equal(after.caseStudy.diagnosis, 'Achalasia cardia');
});

test('voting on the poll unlocks the answer', async () => {
  const author = await member();
  const reader = await member();
  const post = await makeCase(author.user);
  const vote = await reader.api('POST', `/posts/${post._id}/vote`, { option: 1 });
  assert.equal(vote.data.answers.diagnosis, 'Achalasia cardia');
  assert.equal(vote.data.answers.correctOption, 0);
  assert.equal((await reader.api('GET', `/posts/${post._id}`)).data.post.caseStudy.diagnosis, 'Achalasia cardia');
});

test('authors and admins always get the answer', async () => {
  const author = await member();
  const admin = await member({ isAdmin: true });
  const post = await makeCase(author.user);
  assert.equal((await author.api('GET', `/posts/${post._id}`)).data.post.caseStudy.diagnosis, 'Achalasia cardia');
  assert.equal((await admin.api('GET', `/posts/${post._id}`)).data.post.caseStudy.diagnosis, 'Achalasia cardia');
});

test('reveal only works on cases', async () => {
  const author = await member();
  const reader = await member();
  const { Post } = await import('../src/models/Post.js');
  const text = await Post.create({ author: author.user._id, type: 'text', content: 'hello' });
  assert.equal((await reader.api('POST', `/posts/${text._id}/reveal`)).status, 404);
});
