import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member, makeCase } from './helpers.js';

before(start);
after(stop);

const SECRETS = ['email', 'followers', 'following', 'preferences', 'blocked', 'muted', 'notInterested', 'isDemo'];

test('who to follow: mixes Ward top contributors, same college, same year and popular members, with reasons', async () => {
  const { invalidateRankings } = await import('../src/utils/rankings.js');
  const college = 'Government Medical College, Kota';
  const me = await member({ role: 'student', studyYear: '2', institution: college, wards: ['pharmacology'] });
  const pharmTop = await member({ name: 'Pharm Topper' });
  const classmate = await member({ name: 'Same College', institution: college });
  const batchmate = await member({ name: 'Same Year', role: 'student', studyYear: '2' });
  const stateMate = await member({ name: 'Same State', institution: 'Jhalawar Medical College, Jhalawar' });
  const popular = await member({ name: 'Popular Person' });
  const followed = await member({ name: 'Already Followed', institution: college });
  const blocked = await member({ name: 'Blocked Person', institution: college });

  for (const fan of [await member(), await member(), await member()]) await fan.api('POST', `/users/${popular.user._id}/follow`);
  for (let i = 0; i < 3; i++) await makeCase(pharmTop.user, { tags: ['pharmacology'] });
  await me.api('POST', `/users/${followed.user._id}/follow`);
  await me.api('POST', `/users/${blocked.user._id}/block`);
  invalidateRankings();

  const { status, data } = await me.api('GET', '/users/suggestions');
  assert.equal(status, 200);
  const reasonOf = Object.fromEntries(data.users.map((u) => [u.name, u.reason]));
  assert.equal(data.users.length, 5);
  assert.equal(reasonOf['Pharm Topper'], 'Top in Pharmacology');
  assert.equal(reasonOf['Same College'], 'Same college');
  assert.equal(reasonOf['Same Year'], '2nd year, like you');
  assert.equal(reasonOf['Same State'], 'From Rajasthan');
  assert.equal(reasonOf['Popular Person'], 'Popular on Tectum');
  for (const name of ['Already Followed', 'Blocked Person']) assert.ok(!(name in reasonOf), `${name} should not be suggested`);
  assert.ok(!data.users.some((u) => u._id === String(me.user._id)), 'never suggests me');
  assert.ok(data.users.every((u) => u.username), 'every suggestion has an @handle');
  for (const u of data.users) for (const secret of SECRETS) assert.equal(secret in u, false, `${u.name} exposes ${secret}`);

  // Same list on a second call the same day (rotation is per day, not per request).
  const again = await me.api('GET', '/users/suggestions');
  assert.deepEqual(again.data.users.map((u) => u._id), data.users.map((u) => u._id));
  void classmate; void batchmate; void stateMate;
});

test('top contributors: score = items x 3 + likes, last 30 days only, top 5, #1 badge on the profile, demo accounts hideable', async () => {
  const { invalidateRankings } = await import('../src/utils/rankings.js');
  const { User } = await import('../src/models/User.js');
  const viewer = await member();
  const people = [];
  for (let i = 0; i < 7; i++) people.push(await member({ name: `Anatomist ${i}` }));
  const likers = (n) => people.slice(0, n).map((p) => p.user._id);

  // Anatomist 0: 2 items + 9 likes = 15. Anatomist 1: 4 items, no likes = 12. Others: 1 item = 3.
  await makeCase(people[0].user, { tags: ['anatomy'], likes: likers(5) });
  await makeCase(people[0].user, { tags: ['anatomy'], likes: likers(4) });
  for (let i = 0; i < 4; i++) await makeCase(people[1].user, { tags: ['anatomy'] });
  for (let i = 2; i < 7; i++) await makeCase(people[i].user, { tags: ['anatomy'] });
  // Old activity doesn't count: 10 cases 40 days ago.
  const old = new Date(Date.now() - 40 * 86400000);
  for (let i = 0; i < 10; i++) {
    const p = await makeCase(people[6].user, { tags: ['anatomy'] });
    await p.collection.updateOne({ _id: p._id }, { $set: { createdAt: old } });
  }
  invalidateRankings();

  const { data } = await viewer.api('GET', '/wards/anatomy');
  const names = data.contributors.map((c) => c.user.name);
  assert.equal(data.contributors.length, 5);
  assert.deepEqual(names.slice(0, 2), ['Anatomist 0', 'Anatomist 1']);
  assert.deepEqual(data.contributors[0], { ...data.contributors[0], rank: 1, cases: 2, posts: 0, likes: 9, score: 15 });
  assert.equal(data.contributors[1].score, 12);

  const profile = await viewer.api('GET', `/users/${people[0].user._id}`);
  assert.deepEqual(profile.data.user.topIn, [{ slug: 'anatomy', label: 'Anatomy' }]);
  const second = await viewer.api('GET', `/users/${people[1].user._id}`);
  assert.deepEqual(second.data.user.topIn, []);

  // Marking the leader as demo and hiding demo accounts drops them from the list.
  await User.updateOne({ _id: people[0].user._id }, { isDemo: true });
  process.env.HIDE_DEMO_IN_RANKINGS = 'true';
  invalidateRankings();
  const hidden = await viewer.api('GET', '/wards/anatomy');
  assert.equal(hidden.data.contributors[0].user.name, 'Anatomist 1');
  delete process.env.HIDE_DEMO_IN_RANKINGS;
  invalidateRankings();
});
