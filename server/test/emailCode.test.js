import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, apiBase } from './helpers.js';

before(start);
after(stop);

const post = async (url, body) => {
  const res = await fetch(apiBase() + url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, data: await res.json().catch(() => null) };
};
const account = (email, extra = {}) => ({ name: 'New Member', email, password: 'Tectum#2026', role: 'student', course: 'mbbs', country: 'IN', acceptTerms: true, ...extra });

test('sign-up needs the emailed code; a wrong code is refused, the right one lets it through', async () => {
  const email = 'code@test.local';
  assert.equal((await post('/auth/signup', account(email))).status, 400); // no proof

  // The real code is only emailed (hashed in the database), so plant a known one.
  const { EmailCode } = await import('../src/models/EmailCode.js');
  const sent = await post('/auth/signup/send-code', { email });
  assert.equal(sent.status, 200, JSON.stringify(sent.data));
  assert.equal(sent.data.required, true);
  const crypto = await import('node:crypto');
  await EmailCode.updateOne({ email }, { codeHash: crypto.createHash('sha256').update(`${email}:123456`).digest('hex') });

  const wrong = await post('/auth/signup/verify-code', { email, code: '000000' });
  assert.equal(wrong.status, 400);
  assert.match(wrong.data.message, /isn't right/);

  const right = await post('/auth/signup/verify-code', { email, code: '123456' });
  assert.equal(right.status, 200);
  assert.ok(right.data.emailProof);

  // The proof only works for the address it was made for.
  assert.equal((await post('/auth/signup', account('other@test.local', { emailProof: right.data.emailProof }))).status, 400);
  const ok = await post('/auth/signup', account(email, { emailProof: right.data.emailProof }));
  assert.equal(ok.status, 201, JSON.stringify(ok.data));
  assert.equal(ok.data.user.emailVerified, true);

  // Taken addresses don't get a code.
  assert.equal((await post('/auth/signup/send-code', { email })).status, 409);
});

test('asking for codes too quickly is refused', async () => {
  const email = 'quick@test.local';
  assert.equal((await post('/auth/signup/send-code', { email })).status, 200);
  assert.equal((await post('/auth/signup/send-code', { email })).status, 400);
});
