import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { start, stop, apiBase } from './helpers.js';
import { signupSchema, resetPasswordSchema, changePasswordSchema, loginSchema } from '../src/validators.js';

before(start);
after(stop);

const WEAK = {
  'Ab1!xyz': 'at least 8 characters',
  'abcdefg1!': 'capital letter',
  'ABCDEFG1!': 'small \\(lowercase\\) letter',
  'Abcdefgh!': 'number',
  'Abcdefg12': 'symbol',
};
const STRONG = 'Tectum#2026';

test('reset and change password refuse each kind of weak password', () => {
  for (const [pw, why] of Object.entries(WEAK)) {
    const reset = resetPasswordSchema.safeParse({ token: 'a'.repeat(64), password: pw });
    assert.equal(reset.success, false, pw);
    assert.match(reset.error.issues[0].message, new RegExp(why), pw);
    assert.equal(changePasswordSchema.safeParse({ currentPassword: 'Old#Pass1', newPassword: pw }).success, false, pw);
  }
  assert.equal(resetPasswordSchema.safeParse({ token: 'a'.repeat(64), password: STRONG }).success, true);
  assert.equal(changePasswordSchema.safeParse({ currentPassword: 'Old#Pass1', newPassword: STRONG }).success, true);
});

test('logging in does not re-check the rules (older passwords keep working)', () => {
  assert.equal(loginSchema.safeParse({ email: 'a@b.co', password: 'demo1234' }).success, true);
});

test('sign-up endpoint refuses a weak password and accepts a strong one', async () => {
  const { signEmailProof } = await import('../src/controllers/authController.js');
  const body = (password, email) => ({ name: 'New Member', email, password, role: 'student', course: 'mbbs', country: 'IN', acceptTerms: true, emailProof: signEmailProof(email) });
  const post = (b) => fetch(`${apiBase()}/auth/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
  assert.equal(signupSchema.safeParse(body('abcdefgh', 'x@y.co')).success, false);
  const weak = await post(body('password1', 'weak@test.local'));
  assert.equal(weak.status, 400);
  assert.match(JSON.stringify(await weak.json()), /capital letter/);
  const strong = await post(body(STRONG, 'strong@test.local'));
  const text = await strong.text();
  assert.equal(strong.status, 201, text);
});
