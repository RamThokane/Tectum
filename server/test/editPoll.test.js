import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member, makeCase } from './helpers.js';

before(start);
after(stop);

const caseBody = (post, poll) => ({
  caseStudy: { chiefComplaint: post.caseStudy.chiefComplaint, diagnosis: post.caseStudy.diagnosis, ...poll },
});

test('the author can edit the diagnosis poll: reword, add a choice, change the answer', async () => {
  const author = await member();
  const post = await makeCase(author.user);
  const res = await author.api('PUT', `/posts/${post._id}`, caseBody(post, { pollOptions: ['Achalasia', 'Oesophageal cancer', 'Eosinophilic oesophagitis'], correctOption: 2 }));
  assert.equal(res.status, 200);
  assert.deepEqual(res.data.post.caseStudy.pollOptions, ['Achalasia', 'Oesophageal cancer', 'Eosinophilic oesophagitis']);
  assert.equal(res.data.post.caseStudy.correctOption, 2);
});

test('the author can remove the poll when nobody voted', async () => {
  const author = await member();
  const post = await makeCase(author.user);
  const res = await author.api('PUT', `/posts/${post._id}`, caseBody(post, { pollOptions: [] }));
  assert.equal(res.status, 200);
  assert.equal(res.data.post.poll, undefined);
});

test('after votes, choices can be reworded but not added or removed', async () => {
  const author = await member();
  const reader = await member();
  const post = await makeCase(author.user);
  await reader.api('POST', `/posts/${post._id}/vote`, { option: 1 });

  const added = await author.api('PUT', `/posts/${post._id}`, caseBody(post, { pollOptions: ['A', 'B', 'C'], correctOption: 0 }));
  assert.equal(added.status, 400);
  const removed = await author.api('PUT', `/posts/${post._id}`, caseBody(post, { pollOptions: [] }));
  assert.equal(removed.status, 400);

  const reworded = await author.api('PUT', `/posts/${post._id}`, caseBody(post, { pollOptions: ['Achalasia cardia (type II)', 'Oesophageal cancer'], correctOption: 0 }));
  assert.equal(reworded.status, 200);
  assert.equal(reworded.data.post.caseStudy.pollOptions[0], 'Achalasia cardia (type II)');
  assert.equal(reworded.data.post.poll.total, 1); // the vote is kept
});

test('highlight marks are stored as typed', async () => {
  const author = await member();
  const post = await makeCase(author.user);
  const res = await author.api('PUT', `/posts/${post._id}`, { caseStudy: { ...caseBody(post).caseStudy, examinationFindings: 'Tender mass, ==currant jelly stool==' } });
  assert.equal(res.status, 200);
  assert.equal(res.data.post.caseStudy.examinationFindings, 'Tender mass, ==currant jelly stool==');
  assert.equal(res.data.post.caseStudy.pollOptions.length, 2); // poll untouched when not sent
});
