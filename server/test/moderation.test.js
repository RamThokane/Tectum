import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member, makeCase } from './helpers.js';

before(start);
after(stop);

test('reports: queue, hide after 3 reporters (2 for patient privacy), author still sees it, keep / remove', async () => {
  const author = await member();
  const viewer = await member();
  const admin = await member({ isAdmin: true });
  const reporters = [await member(), await member(), await member()];
  const c = await makeCase(author.user, { title: 'Reported case' });

  // Own post can't be reported; the app's reason codes and the website's free text both work.
  assert.equal((await author.api('POST', `/posts/${c._id}/report`, { reason: 'spam' })).status, 400);
  await reporters[0].api('POST', `/posts/${c._id}/report`, { reason: 'wrong-information', details: 'Dose is wrong' });
  const again = await reporters[0].api('POST', `/posts/${c._id}/report`, { reason: 'spam' });
  assert.match(again.data.message, /already/);
  await reporters[1].api('POST', `/posts/${c._id}/report`, { reason: 'This looks like spam to me' });
  assert.equal((await viewer.api('GET', `/posts/${c._id}`)).status, 200, 'still visible after 2 reports');
  await reporters[2].api('POST', `/posts/${c._id}/report`, { reason: 'abuse' });

  // Hidden now: not on its page or in feeds for others; the author still sees it and was told.
  assert.equal((await viewer.api('GET', `/posts/${c._id}`)).status, 404);
  const feed = await viewer.api('GET', '/posts?type=case_study&limit=50');
  assert.ok(!feed.data.posts.some((p) => p._id === String(c._id)));
  assert.equal((await author.api('GET', `/posts/${c._id}`)).status, 200);
  const notes = await author.api('GET', '/notifications');
  assert.ok(notes.data.notifications.some((n) => n.type === 'content_hidden'));

  // Moderators see it with the reasons; "keep" shows it again.
  const q = await admin.api('GET', '/admin/reports');
  const queued = q.data.posts.find((p) => p._id === String(c._id));
  assert.equal(queued.hiddenByReports, true);
  assert.deepEqual(queued.reports.map((r) => r.category), ['wrong-information', 'other', 'abuse']);
  assert.equal(queued.reports[0].reason, 'Dose is wrong');
  await admin.api('POST', `/admin/reports/${c._id}/dismiss`);
  assert.equal((await viewer.api('GET', `/posts/${c._id}`)).status, 200);

  // Patient privacy: hidden after 2.
  const c2 = await makeCase(author.user, { title: 'Second' });
  await reporters[0].api('POST', `/posts/${c2._id}/report`, { reason: 'identifiable-patient' });
  await reporters[1].api('POST', `/posts/${c2._id}/report`, { reason: 'identifiable-patient' });
  assert.equal((await viewer.api('GET', `/posts/${c2._id}`)).status, 404);
  // Remove: gone, author told.
  await admin.api('DELETE', `/admin/posts/${c2._id}`);
  assert.equal((await author.api('GET', `/posts/${c2._id}`)).status, 404);
  const notes2 = await author.api('GET', '/notifications');
  assert.ok(notes2.data.notifications.some((n) => n.type === 'content_removed'));
});

test('reported replies: hidden after 3, in the queue, keep and remove', async () => {
  const author = await member();
  const replier = await member();
  const viewer = await member();
  const admin = await member({ isAdmin: true });
  const c = await makeCase(author.user);
  const reply = (await replier.api('POST', `/posts/${c._id}/comments`, { text: 'Rude reply' })).data.comment;
  for (const r of [await member(), await member(), await member()]) {
    await r.api('POST', `/posts/${c._id}/comments/${reply._id}/report`, { reason: 'abuse' });
  }
  const seen = await viewer.api('GET', `/posts/${c._id}`);
  assert.equal(seen.data.comments.length, 0);
  const own = await replier.api('GET', `/posts/${c._id}`);
  assert.equal(own.data.comments.length, 1, 'the author still sees it');
  assert.equal(own.data.comments[0].reports, undefined, 'who reported is never sent');

  const q = await admin.api('GET', '/admin/reports');
  assert.ok(q.data.comments.some((x) => x._id === reply._id && x.hiddenByReports));
  await admin.api('POST', `/admin/comment-reports/${reply._id}/dismiss`);
  assert.equal((await viewer.api('GET', `/posts/${c._id}`)).data.comments.length, 1);
  await admin.api('DELETE', `/admin/comments/${reply._id}`);
  assert.equal((await replier.api('GET', `/posts/${c._id}`)).data.comments.length, 0);
});

test('blocking hides the blocked member\'s replies and posts from me (and mine from them)', async () => {
  const me = await member();
  const other = await member();
  const author = await member();
  const c = await makeCase(author.user);
  await other.api('POST', `/posts/${c._id}/comments`, { text: 'A reply from someone I will block' });
  const theirs = await makeCase(other.user, { title: 'Their case' });
  assert.equal((await me.api('GET', `/posts/${c._id}`)).data.comments.length, 1);
  await me.api('POST', `/users/${other.user._id}/block`);
  assert.equal((await me.api('GET', `/posts/${c._id}`)).data.comments.length, 0);
  assert.equal((await me.api('GET', `/posts/${theirs._id}`)).status, 404);
  assert.equal((await me.api('GET', `/posts/${c._id}/comments`)).data.comments.length, 0);
  // Profile reports go to the moderators as a help request.
  const r = await me.api('POST', `/users/${other.user._id}/report`, { reason: 'spam', details: 'Advertising' });
  assert.equal(r.status, 200);
  const { SupportTicket } = await import('../src/models/SupportTicket.js');
  const t = await SupportTicket.findOne({ user: me.user._id }).lean();
  assert.match(t.message, /Spam or advertising: Advertising/);
});

test('ads: none for blue-tick members', async () => {
  const { Ad } = await import('../src/models/Ad.js');
  await Ad.create({ advertiser: 'Test', title: 'Revise smarter', body: 'Try it', linkUrl: 'https://example.com', placement: 'feed', active: true });
  const plain = await member();
  const blue = await member({ verificationStatus: 'verified' });
  assert.equal((await plain.api('GET', '/ads?placement=feed')).data.ads.length, 1);
  assert.equal((await blue.api('GET', '/ads?placement=feed')).data.ads.length, 0);
});
