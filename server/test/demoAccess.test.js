import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, member } from './helpers.js';

before(start);
after(stop);

test('admins can step into DEMO accounts only; others cannot; isDemo stays hidden from members', async () => {
  const admin = await member({ name: 'Admin', isAdmin: true });
  const plain = await member({ name: 'Plain Member' });
  const demo = await member({ name: 'Demo Student', isDemo: true });
  const real = await member({ name: 'Real Student' });

  // A normal member can't use it at all.
  assert.equal((await plain.api('POST', `/admin/demo/${demo.user._id}/use`)).status, 403);
  // An admin can't enter a real member's account.
  assert.equal((await admin.api('POST', `/admin/demo/${real.user._id}/use`)).status, 403);

  // An admin can enter a demo account and gets a working session for it.
  const used = await admin.api('POST', `/admin/demo/${demo.user._id}/use`);
  assert.equal(used.status, 200);
  assert.equal(used.data.user.name, 'Demo Student');
  assert.equal(used.data.user.isDemo, true);
  const meAsDemo = await fetch(`${(await import('./helpers.js')).apiBase()}/auth/me`, { headers: { Authorization: `Bearer ${used.data.token}` } }).then((r) => r.json());
  assert.equal(meAsDemo.user.name, 'Demo Student');
  assert.equal(meAsDemo.user.isDemo, true);

  // Only admins see the demo flag on profiles.
  assert.equal((await admin.api('GET', `/users/${demo.user._id}`)).data.user.isDemo, true);
  assert.equal('isDemo' in (await plain.api('GET', `/users/${demo.user._id}`)).data.user, false);
  assert.equal('isDemo' in (await plain.api('GET', '/auth/me')).data.user, false);
});

test('admin switch hides demo accounts from Top Contributors and Who to follow, and shows them again', async () => {
  const { makeCase } = await import('./helpers.js');
  const admin = await member({ name: 'Admin Two', isAdmin: true });
  const viewer = await member({ name: 'Viewer', wards: ['ent'] });
  const demo = await member({ name: 'Demo ENT', isDemo: true });
  const real = await member({ name: 'Real ENT' });
  for (let i = 0; i < 3; i++) await makeCase(demo.user, { tags: ['ent'] });
  await makeCase(real.user, { tags: ['ent'] });
  (await import('../src/utils/rankings.js')).invalidateRankings(); // lists are cached for 10 minutes

  const names = async () => (await viewer.api('GET', '/wards/ent')).data.contributors.map((c) => c.user.name);
  const suggested = async () => (await viewer.api('GET', '/users/suggestions')).data.users.map((u) => u.name);

  assert.equal((await viewer.api('PUT', '/admin/settings/hide-demo', { hidden: true })).status, 403);
  assert.ok((await names()).includes('Demo ENT'));
  const before = await suggested();
  assert.ok(before.includes('Demo ENT'), `suggestions were: ${before.join(', ')}`);

  const on = await admin.api('PUT', '/admin/settings/hide-demo', { hidden: true });
  assert.deepEqual(on.data, { hidden: true });
  assert.equal((await admin.api('GET', '/admin/members')).data.hideDemo, true);
  assert.deepEqual(await names(), ['Real ENT']);
  assert.ok(!(await suggested()).includes('Demo ENT'));
  assert.deepEqual((await viewer.api('GET', `/users/${demo.user._id}`)).data.user.topIn, []);

  await admin.api('PUT', '/admin/settings/hide-demo', { hidden: false });
  assert.ok((await names()).includes('Demo ENT'));
});
